import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
@Injectable()
export class DepartmentRoutingService {
  private readonly logger = new Logger(DepartmentRoutingService.name);

  constructor(
    private prisma: PrismaService,
    private moduleRef: ModuleRef,
    private notificationsService: NotificationsService,
  ) { }

  private getWebsocketGateway(): WebsocketGateway | null {
    try {
      return this.moduleRef.get(WebsocketGateway, { strict: false });
    } catch (error) {
      return null;
    }
  }

  private getWhatsappService(): WhatsappService | null {
    try {
      return this.moduleRef.get(WhatsappService, { strict: false });
    } catch (error) {
      return null;
    }
  }

  async routeToDepartment(
    conversationId: string,
    slug: string,
    companyId: string,
  ) {
    const dept = await this.prisma.department.findFirst({
      where: { companyId, slug, isActive: true },
    });
    if (!dept) {
      this.logger.warn(
        `Department not found: ${slug} for company ${companyId}`,
      );
      return null;
    }

    // Buscar dados da conversa
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    // SEMPRE definir o departamento ANTES de tentar atribuir
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        departmentId: dept.id,
        routedAt: new Date(),
        flowState: 'DEPARTMENT_SELECTED', // correto: ainda não tem agente
      },
    });

    // 🔔 Notificar o setor sobre nova conversa
    if (conversation) {
      this.notificationsService.notifyNewConversation({
        conversationId,
        customerName: conversation.customerName || 'Cliente',
        customerPhone: conversation.customerPhone,
        departmentId: dept.id,
        departmentName: dept.name,
        timestamp: new Date(),
      });
    }

    // Notificar o setor que tem nova conversa na fila
    const gateway = this.getWebsocketGateway();
    if (gateway) {
      gateway.emitToDepartment(dept.id, 'conversation-queued', {
        conversationId,
        reason: 'new',
      });
    }

    // Tentar atribuir agente do setor escolhido
    const agent = await this.assignToAgent(conversationId, dept.id);

    if (agent) {
      if (gateway) {
        const conv = await this.prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { department: true },
        });
        gateway.emitToUser(agent.id, 'conversation-assigned', {
          conversationId,
          conversation: conv,
          agentName: agent.name,
        });
      }
      await this.sendWhatsAppToConversation(
        conversationId,
        `Conectando com *${agent.name} - ${dept.name}*... Aguarde um momento. 😊`,
      );
      return conversationId;
    }

    // Setor sem agentes disponíveis — manter na fila do próprio setor
    this.logger.log(
      `[ROUTING] Setor ${dept.name} sem agentes disponíveis. Mantendo na fila do setor.`,
    );
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        flowState: 'DEPARTMENT_SELECTED',
        assignedUserId: null,
        status: 'OPEN',
      },
    });
    if (gateway) {
      gateway.emitToDepartment(dept.id, 'conversation-queued', {
        conversationId,
        reason: 'offline',
      });
    }
    return conversationId;
  }

  async assignToAgent(
    conversationId: string,
    departmentId: string,
  ): Promise<{ id: string; name: string } | null> {
    return await this.prisma.$transaction(
      async (tx) => {
        // Buscar dados da conversa e da empresa
        const conv = await tx.conversation.findUnique({
          where: { id: conversationId },
          include: { company: true },
        });

        if (!conv) return null;

        // Se a empresa desativou a atribuição automática, não designar agente
        if (conv.company && !conv.company.autoAssignEnabled) {
          this.logger.log(`[ASSIGNMENT] Atribuição automática desativada para a empresa ${conv.companyId}. Mantendo na fila.`);
          return null;
        }

        // Buscar agentes disponíveis COM contagem dentro da transação
        const agents = await tx.user.findMany({
          where: {
            departmentId,
            isActive: true,
          },
          include: {
            _count: {
              select: {
                assignedConversations: {
                  where: {
                    status: { in: ['OPEN', 'ASSIGNED'] },
                    flowState: { in: ['DEPARTMENT_SELECTED', 'ASSIGNED'] },
                  },
                },
              },
            },
          },
        });

        if (!agents || agents.length === 0) return null;

        // Ordenar por menor carga dentro da transação
        const sorted = [...agents].sort(
          (a, b) =>
            a._count.assignedConversations - b._count.assignedConversations,
        );
        const selected = sorted[0];

        // UPDATE atômico na mesma transação — sem isso não resolve race condition
        await tx.conversation.update({
          where: { id: conversationId },
          data: {
            assignedUserId: selected.id,
            assignedAt: new Date(),
            flowState: 'ASSIGNED',
            status: 'ASSIGNED',
          },
        });

        // Histórico de atribuições se a tabela existir no schema
        try {
          await tx.assignment.create({
            data: {
              conversationId,
              userId: selected.id,
              assignedAt: new Date(),
            },
          });
        } catch (err) {
          // tabela pode não existir ainda, não bloquear o fluxo
          this.logger.warn(`[ASSIGNMENT] Falha ao criar registro: ${err}`);
        }

        return {
          id: selected.id,
          name: selected.name,
        };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async getAvailableAgents(departmentId: string) {
    const agents = await this.prisma.user.findMany({
      where: {
        departmentId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            assignedConversations: {
              where: {
                status: { in: ['OPEN', 'ASSIGNED'] },
                flowState: { in: ['DEPARTMENT_SELECTED', 'ASSIGNED'] },
              },
            },
          },
        },
      },
    });
    agents.sort(
      (a, b) => a._count.assignedConversations - b._count.assignedConversations,
    );
    return agents.map((a) => ({ id: a.id, name: a.name }));
  }

  async checkTimeoutAndRedirect() {
    // Fix orphaned conversations: ASSIGNED state but no agent assigned
    const orphaned = await this.prisma.conversation.findMany({
      where: {
        flowState: 'ASSIGNED',
        assignedUserId: null,
        status: { in: ['OPEN', 'ASSIGNED'] },
      },
    });
    for (const conv of orphaned) {
      this.logger.log(
        `[ROUTING] Conversa ${conv.id} ASSIGNED sem agente. Tentando reatribuir...`,
      );
      await this.prisma.conversation.update({
        where: { id: conv.id },
        data: {
          flowState: 'DEPARTMENT_SELECTED',
          status: 'OPEN',
        },
      });
      if (conv.departmentId) {
        await this.assignToAgent(conv.id, conv.departmentId);
      }
    }
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

      const whatsappService = this.getWhatsappService();
      if (whatsappService) {
        await whatsappService.sendTextMessage(
          conv.company.whatsappAccessToken,
          conv.company.whatsappPhoneNumberId,
          to,
          text,
          conv.wahaSession,
        );
      }
    } catch (err) {
      this.logger.error(
        `[WHATSAPP] Falha ao enviar mensagem para conversa ${conversationId}: ${err}`,
      );
    }
  }
}
