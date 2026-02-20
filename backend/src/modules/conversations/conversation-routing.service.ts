import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ModuleRef } from '@nestjs/core';
import { WebsocketGateway } from '../websocket/websocket.gateway';

/**
 * Serviço de roteamento inteligente de retorno
 * Verifica se cliente retornou e usa atendimento anterior como sugestão
 */
@Injectable()
export class ConversationRoutingService {
  private readonly logger = new Logger(ConversationRoutingService.name);
  private readonly SUGGESTION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private notificationsService: NotificationsService,
    private moduleRef: ModuleRef,
  ) {}

  /**
   * Verifica se cliente teve atendimento anterior e sugere roteamento
   * Retorna true se há sugestão pendente (precisa responder SIM/NÃO)
   * Retorna false se não há sugestão ou cliente aceitou/rejeitou
   */
  async checkAndSuggestPreviousRouting(
    conversationId: string,
    customerPhone: string,
    companyId: string,
  ): Promise<boolean> {
    try {
      // Buscar último atendimento do cliente
      const previousConversation = await this.prisma.conversation.findFirst({
        where: {
          companyId,
          customerPhone,
          lastAttendedAt: { not: null },
          id: { not: conversationId }, // Não a conversa atual
        },
        orderBy: { lastAttendedAt: 'desc' },
        include: { department: true, assignedUser: true },
      });

      if (!previousConversation || !previousConversation.lastDepartmentId) {
        this.logger.log(
          `[ROUTING] Cliente ${customerPhone} - sem atendimento anterior`,
        );
        return false;
      }

      // Atualizar conversa atual com dados do último atendimento
      const lastDept = await this.prisma.department.findUnique({
        where: { id: previousConversation.lastDepartmentId },
      });

      if (!lastDept) {
        this.logger.warn(
          `[ROUTING] Departamento anterior não encontrado: ${previousConversation.lastDepartmentId}`,
        );
        return false;
      }

      // Definir estado como aguardando confirmação de roteamento
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          flowState: 'AWAITING_ROUTING_CONFIRMATION',
          metadata: {
            ...((previousConversation.metadata as any) || {}),
            suggestedDepartmentId: lastDept.id,
            suggestedDepartmentName: lastDept.name,
            suggestedAt: new Date().toISOString(),
          },
        },
      });

      // Enviar mensagem de sugestão
      const suggestMessage = `Identificamos que você foi atendido anteriormente pelo setor *${lastDept.name}*.\n\nDeseja ser direcionado para o mesmo setor?\n\nResponda *SIM* para confirmar ou *NÃO* para continuar com sua nova solicitação.`;

      await this.sendWhatsAppToConversation(conversationId, suggestMessage);

      this.logger.log(
        `[ROUTING] Sugestão enviada para cliente ${customerPhone} - setor ${lastDept.name}`,
      );

      // Agendar timeout de 2 minutos
      this.scheduleRoutingTimeout(conversationId, lastDept.id, companyId);

      return true;
    } catch (error) {
      this.logger.error(
        `[ROUTING] Erro ao verificar roteamento anterior: ${error}`,
      );
      return false;
    }
  }

  /**
   * Processa resposta do cliente (SIM/NÃO) à sugestão de roteamento
   */
  async handleRoutingSuggestionResponse(
    conversationId: string,
    responseText: string,
  ): Promise<{
    accepted: boolean;
    departmentId?: string;
  }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return { accepted: false };
    }

    // Normalizar resposta
    const response = responseText.toUpperCase().trim();
    const metadata = (conversation.metadata as any) || {};
    const suggestedDepartmentId = metadata.suggestedDepartmentId;

    if (!suggestedDepartmentId) {
      return { accepted: false };
    }

    // Verificar se é SIM
    if (response.includes('SIM') || response === '1' || response === 'Y') {
      this.logger.log(
        `[ROUTING] Cliente aceitou sugestão de roteamento para departamento ${suggestedDepartmentId}`,
      );

      // Limpar estado de aguardando confirmação
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          flowState: 'DEPARTMENT_SELECTED',
          departmentId: suggestedDepartmentId,
          metadata: {
            ...metadata,
            routingConfirmed: true,
            routingConfirmedAt: new Date().toISOString(),
          },
        },
      });

      await this.sendWhatsAppToConversation(
        conversationId,
        'Perfeito! Conectando você ao setor anterior... 😊',
      );

      return {
        accepted: true,
        departmentId: suggestedDepartmentId,
      };
    }

    // Tipo de resposta: NÃO
    if (
      response.includes('NÃO') ||
      response.includes('NAO') ||
      response === '0' ||
      response === 'N'
    ) {
      this.logger.log(
        `[ROUTING] Cliente rejeitou sugestão de roteamento. Retornando ao menu inicial.`,
      );

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          flowState: 'GREETING',
          metadata: {
            ...metadata,
            routingRejected: true,
            routingRejectedAt: new Date().toISOString(),
          },
        },
      });

      await this.sendWhatsAppToConversation(
        conversationId,
        'Entendido! Voltando ao menu inicial... \n\nEscolha uma opção:\n1️⃣ Laboratório\n2️⃣ Administrativo\n3️⃣ Comercial\n4️⃣ Financeiro',
      );

      return { accepted: false };
    }

    // Resposta inválida — ignorar e aguardar nova resposta
    this.logger.log(
      `[ROUTING] Resposta inválida: "${responseText}". Aguardando SIM ou NÃO.`,
    );

    return { accepted: false };
  }

  /**
   * Agendar timeout de 2 minutos para roteamento sugerido
   * Se cliente não responde, usa fluxo padrão
   */
  private scheduleRoutingTimeout(
    conversationId: string,
    suggestedDepartmentId: string,
    companyId: string,
  ) {
    setTimeout(async () => {
      try {
        const conversation = await this.prisma.conversation.findUnique({
          where: { id: conversationId },
        });

        // Se ainda está aguardando confirmação, timeout expirou
        if (conversation?.flowState === 'AWAITING_ROUTING_CONFIRMATION') {
          this.logger.log(
            `[ROUTING] Timeout de 2 minutos expirado para roteamento sugerido. Usando fluxo padrão.`,
          );

          // Voltar para GREETING para passar pelo menu normal
          await this.prisma.conversation.update({
            where: { id: conversationId },
            data: {
              flowState: 'GREETING',
              metadata: {
                ...((conversation.metadata as any) || {}),
                routingTimeoutExpired: true,
                routingTimeoutExpiredAt: new Date().toISOString(),
              },
            },
          });

          await this.sendWhatsAppToConversation(
            conversationId,
            'Tempo esgotado! Voltando ao menu inicial...\n\nEscolha uma opção:\n1️⃣ Laboratório\n2️⃣ Administrativo\n3️⃣ Comercial\n4️⃣ Financeiro',
          );
        }
      } catch (error) {
        this.logger.error(
          `[ROUTING] Erro ao processar timeout de roteamento: ${error}`,
        );
      }
    }, this.SUGGESTION_TIMEOUT_MS);
  }

  /**
   * Registrar que uma conversa foi atendida (chamar ao marcar como resolvida)
   */
  async recordAttendance(
    conversationId: string,
    departmentId: string,
    attendantId: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return;
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastDepartmentId: departmentId,
        lastAttendantId: attendantId,
        lastAttendedAt: new Date(),
      },
    });

    this.logger.log(
      `[ROUTING] Atendimento registrado para ${conversation.customerPhone}`,
    );
  }

  private async sendWhatsAppToConversation(
    conversationId: string,
    text: string,
  ): Promise<void> {
    try {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { company: true },
      });
      if (!conv || !conv.company) return;

      const to = (conv.metadata as any)?.chatId || conv.customerPhone;

      await this.whatsappService.sendTextMessage(
        conv.company.whatsappAccessToken,
        conv.company.whatsappPhoneNumberId,
        to,
        text,
      );
    } catch (err) {
      this.logger.error(
        `[WHATSAPP] Falha ao enviar mensagem para conversa ${conversationId}: ${err}`,
      );
    }
  }
}
