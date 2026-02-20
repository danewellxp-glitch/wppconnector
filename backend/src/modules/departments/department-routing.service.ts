import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { FlowState } from '@prisma/client';

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
      this.logger.warn(`Department not found: ${slug} for company ${companyId}`);
      return null;
    }

    // Buscar dados da conversa
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    const timeoutAt = new Date(
      Date.now() + dept.responseTimeoutMinutes * 60 * 1000,
    );

    // SEMPRE definir o departamento e o timeout ANTES de tentar atribuir
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        departmentId: dept.id,
        routedAt: new Date(),
        timeoutAt,
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

    // Setor offline — redirecionar para Admin imediatamente
    this.logger.log(
      `[ROUTING] Setor ${dept.name} sem agentes. Redirecionando para Admin.`,
    );
    await this.redirectToAdmin(conversationId, companyId, 'offline');
    return conversationId;
  }

  async assignToAgent(
    conversationId: string,
    departmentId: string,
  ): Promise<{ id: string; name: string } | null> {
    return await this.prisma.$transaction(
      async (tx) => {
        // Buscar agentes disponíveis COM contagem dentro da transação
        const agents = await tx.user.findMany({
          where: {
            departmentId,
            isActive: true,
            onlineStatus: { in: ['ONLINE', 'BUSY'] },
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
          this.logger.warn(
            `[ASSIGNMENT] Falha ao criar registro: ${err}`,
          );
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
        onlineStatus: { in: ['ONLINE', 'BUSY'] },
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
      (a, b) =>
        a._count.assignedConversations - b._count.assignedConversations,
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
        data: { flowState: 'DEPARTMENT_SELECTED', status: 'OPEN' },
      });
      if (conv.departmentId) {
        await this.assignToAgent(conv.id, conv.departmentId);
      }
    }

    const timedOut = await this.prisma.conversation.findMany({
      where: {
        flowState: 'DEPARTMENT_SELECTED',
        timeoutAt: { lt: new Date() },
      },
      include: { company: true, department: true },
    });

    if (timedOut.length === 0) return;

    this.logger.log(
      `[TIMEOUT] ${timedOut.length} conversa(s) com timeout. Redirecionando...`,
    );

    for (const conv of timedOut) {
      await this.redirectToAdmin(
        conv.id,
        conv.companyId,
        'timeout',
      );
    }
  }

  async redistributeOnAgentOffline(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        assignedUserId: userId,
        status: { in: ['OPEN', 'ASSIGNED'] },
        flowState: { in: ['ASSIGNED', 'DEPARTMENT_SELECTED'] },
      },
    });

    if (conversations.length === 0) return;

    this.logger.log(
      `[REDISTRIBUTE] Agente ${userId} offline. ` +
      `Redistribuindo ${conversations.length} conversa(s)...`,
    );

    for (const conv of conversations) {
      // 1. liberar a conversa sequencialmente
      await this.prisma.conversation.update({
        where: { id: conv.id },
        data: {
          assignedUserId: null,
          flowState: 'DEPARTMENT_SELECTED',
          status: 'OPEN',
        },
      });

      // 2. tentar reatribuir para outro agente do mesmo setor
      if (!conv.departmentId) {
        this.logger.warn(
          `[REDISTRIBUTE] Conversa ${conv.id} sem departmentId`,
        );
        continue;
      }

      const newAgent = await this.assignToAgent(
        conv.id,
        conv.departmentId,
      );

      if (newAgent) {
        this.logger.log(
          `[REDISTRIBUTE] Conversa ${conv.id} → agente ${newAgent.id}`,
        );
        const gateway = this.getWebsocketGateway();
        if (gateway) {
          const convUpdated = await this.prisma.conversation.findUnique({ where: { id: conv.id }, include: { department: true } });
          gateway.emitToUser(newAgent.id, 'conversation-assigned', {
            conversationId: conv.id,
            conversation: convUpdated,
            agentName: newAgent.name,
          });
        }
      } else {
        // nenhum agente disponível: manter visível na fila do setor
        this.logger.log(
          `[REDISTRIBUTE] Conversa ${conv.id} → sem agentes, voltou para fila`,
        );
        const gateway = this.getWebsocketGateway();
        if (gateway) {
          gateway.emitToDepartment(
            conv.departmentId,
            'conversation-queued',
            {
              conversationId: conv.id,
              reason: 'agent_offline',
            },
          );
        }
      }
    }
  }

  private async redirectToAdmin(
    conversationId: string,
    companyId: string,
    reason: 'timeout' | 'offline' | 'all_offline',
  ): Promise<void> {
    // Buscar dados da conversa para notificação
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { department: true },
    });

    const adminDept = await this.prisma.department.findFirst({
      where: { companyId, isRoot: true, isActive: true },
    });

    if (!adminDept) {
      this.logger.error(
        `[ROUTING] Departamento raiz não encontrado para empresa ${companyId}`,
      );
      return;
    }

    const messages = {
      timeout:
        'Tempo de espera esgotado. Redirecionando para o Administrativo...',
      offline:
        'O setor solicitado está indisponível. Redirecionando para o Administrativo...',
      all_offline:
        'Todos os atendentes estão indisponíveis no momento. ' +
        'Sua mensagem foi registrada e entraremos em contato em breve. 🙏',
    };

    // Mover para fila do Admin
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        departmentId: adminDept.id,
        timeoutAt: new Date(Date.now() + 10 * 60 * 1000), // 10min para Admin
        // NÃO setar flowState aqui — assignToAgent vai setar ASSIGNED se tiver agente
      },
    });

    // 🔔 Notificar o setor Admin sobre transferência
    if (conversation) {
      this.notificationsService.notifyConversationTransferred({
        conversationId,
        customerName: conversation.customerName || 'Cliente',
        customerPhone: conversation.customerPhone,
        transferredBy: 'Sistema (Bot)',
        fromDepartmentId: conversation.departmentId || '',
        fromDepartmentName: conversation.department?.name || 'Desconhecido',
        toDepartmentId: adminDept.id,
        toDepartmentName: adminDept.name,
        timestamp: new Date(),
      });
    }

    const gateway = this.getWebsocketGateway();
    if (gateway) {
      gateway.emitToCompany(companyId, 'conversation-transferred', {
        conversationId,
        toDepartmentId: adminDept.id,
        reason,
      });
    }

    const adminAgent = await this.assignToAgent(
      conversationId,
      adminDept.id,
    );

    if (adminAgent) {
      if (gateway) {
        const convUpdated = await this.prisma.conversation.findUnique({ where: { id: conversationId }, include: { department: true } });
        gateway.emitToUser(adminAgent.id, 'conversation-assigned', {
          conversationId,
          conversation: convUpdated,
          agentName: adminAgent.name,
        });
      }
      await this.sendWhatsAppToConversation(
        conversationId,
        messages[reason],
      );
    } else {
      // todos offline — voltar para GREETING para o cliente poder tentar novamente
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          flowState: 'GREETING',
          departmentId: null,
          assignedUserId: null,
          timeoutAt: null,
          status: 'OPEN',
        },
      });
      await this.sendWhatsAppToConversation(
        conversationId,
        messages['all_offline'],
      );
      if (gateway) {
        gateway.emitToDepartment(adminDept.id, 'conversation-queued', {
          conversationId,
          reason,
        });
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
        );
      }
    } catch (err) {
      this.logger.error(
        `[WHATSAPP] Falha ao enviar mensagem para conversa ${conversationId}: ${err}`,
      );
    }
  }
}
