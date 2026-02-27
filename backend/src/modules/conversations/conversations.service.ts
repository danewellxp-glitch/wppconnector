import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private moduleRef: ModuleRef,
  ) { }

  private getWebsocketGateway(): WebsocketGateway | null {
    try {
      return this.moduleRef.get(WebsocketGateway, { strict: false });
    } catch (error) {
      return null;
    }
  }

  private getNotificationsService(): NotificationsService | null {
    try {
      return this.moduleRef.get(NotificationsService, { strict: false });
    } catch (error) {
      return null;
    }
  }

  async findAll(
    companyId: string,
    status?: ConversationStatus,
    user?: { role: string; departmentId?: string | null },
  ) {
    const where: any = { companyId, ...(status && { status }) };
    if (user && user.role !== 'ADMIN' && user.departmentId) {
      // Find the root department for this company
      const rootDept = await this.prisma.department.findFirst({
        where: { companyId, isRoot: true },
      });

      if (rootDept) {
        // Agent can see:
        // 1) Conversations in their own department
        // 2) Conversations in the Root department that are unassigned (Offline Queue)
        where.OR = [
          { departmentId: user.departmentId },
          {
            departmentId: rootDept.id,
            assignedUserId: null,
            status: 'OPEN', // Only pending offline queue
          },
        ];
      } else {
        where.departmentId = user.departmentId;
      }
    }
    return this.prisma.conversation.findMany({
      where,
      include: {
        department: {
          select: { id: true, name: true, slug: true, color: true },
        },
        assignedUser: { select: { id: true, name: true, email: true } },
        assignments: {
          where: { unassignedAt: null },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            direction: true,
            sentAt: true,
            type: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async findOne(
    id: string,
    user?: { role: string; departmentId?: string | null },
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, name: true, slug: true, color: true },
        },
        assignedUser: { select: { id: true, name: true, email: true } },
        assignments: {
          where: { unassignedAt: null },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa nao encontrada');
    }

    if (user && user.role !== 'ADMIN' && user.departmentId) {
      if (conversation.departmentId !== user.departmentId) {
        throw new ForbiddenException('Acesso negado a esta conversa');
      }
    }

    return conversation;
  }

  async getContacts(
    companyId: string,
    query?: string,
    take = 50,
    skip = 0,
    user?: { role: string; departmentId?: string | null }
  ) {
    const where: any = { companyId };

    if (user && user.role !== 'ADMIN' && user.departmentId) {
      // Find the root department for this company
      const rootDept = await this.prisma.department.findFirst({
        where: { companyId, isRoot: true },
      });

      if (rootDept) {
        // Agent can see:
        // 1) Contacts in their own department
        // 2) Contacts in the Root department that are unassigned (Offline Queue)
        where.OR = [
          { departmentId: user.departmentId },
          {
            departmentId: rootDept.id,
            assignedUserId: null,
            status: 'OPEN', // Only pending offline queue
          }
        ];
      } else {
        where.departmentId = user.departmentId;
      }
    }

    if (query) {
      const queryFilter = [
        { customerName: { contains: query, mode: 'insensitive' } },
        { customerPhone: { contains: query, mode: 'insensitive' } },
      ];

      if (where.OR) {
        // If we already have an OR condition from department filtering, we need an AND
        where.AND = [{ OR: queryFilter }];
      } else {
        where.OR = queryFilter;
      }
    }

    return this.prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
      include: {
        department: { select: { id: true, name: true, color: true } },
        assignedUser: { select: { id: true, name: true } },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { content: true, sentAt: true }
        }
      }
    });
  }

  async syncContactsFromWhatsapp(companyId: string, userId: string) {
    const agent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, name: true }
    });

    const wahaContacts = await this.whatsappService.getContacts();
    let syncedCount = 0;

    for (const wContact of wahaContacts) {
      if (!wContact.number) continue;

      const customerPhone = wContact.number;
      const customerName = wContact.name || wContact.pushname || customerPhone;

      // We only insert or update the name. We do NOT change status if it already exists.
      // We set new contacts as ARCHIVED so they don't pop up as OPEN for everyone.
      await this.prisma.conversation.upsert({
        where: { companyId_customerPhone: { companyId, customerPhone } },
        update: {
          // update name if they have a better one now
          customerName: customerName,
        },
        create: {
          companyId,
          customerPhone,
          customerName,
          status: 'ARCHIVED',
          flowState: 'RESOLVED',
          departmentId: agent?.departmentId || null,
          unreadCount: 0,
        }
      });

      syncedCount++;
    }

    return { message: 'Contatos sincronizados com sucesso', count: syncedCount };
  }

  async createContactAndStartChat(companyId: string, customerName: string, customerPhone: string, userId: string, initialMessage?: string) {
    let conv = await this.prisma.conversation.findUnique({
      where: { companyId_customerPhone: { companyId, customerPhone } },
      include: { company: true }
    });

    const agent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, name: true }
    });

    if (conv) {
      if (conv.status === 'OPEN' || conv.status === 'ASSIGNED') {
        throw new BadRequestException('Já existe um atendimento em andamento para este número.');
      }

      // Update existing conversation
      await this.prisma.assignment.updateMany({
        where: { conversationId: conv.id, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });

      await this.prisma.assignment.create({
        data: { conversationId: conv.id, userId },
      });

      conv = await this.prisma.conversation.update({
        where: { id: conv.id },
        data: {
          customerName: customerName || conv.customerName,
          status: 'ASSIGNED',
          flowState: 'ASSIGNED',
          assignedUserId: userId,
          assignedAt: new Date(),
          departmentId: agent?.departmentId || null,
          routedAt: new Date(),
          timeoutAt: null,
          unreadCount: 0,
        },
        include: { company: true }
      });
    } else {
      // Create new conversation
      conv = await this.prisma.conversation.create({
        data: {
          companyId,
          customerPhone,
          customerName,
          status: 'ASSIGNED',
          flowState: 'ASSIGNED',
          assignedUserId: userId,
          assignedAt: new Date(),
          departmentId: agent?.departmentId || null,
          routedAt: new Date(),
        },
        include: { company: true }
      });

      await this.prisma.assignment.create({
        data: { conversationId: conv.id, userId },
      });
    }

    if (initialMessage && initialMessage.trim().length > 0 && conv.company) {
      try {
        const response: any = await this.whatsappService.sendTextMessage(
          conv.company.whatsappAccessToken,
          conv.company.whatsappPhoneNumberId,
          customerPhone,
          initialMessage.trim()
        );

        let whatsappMessageId = `out_${Date.now()}`;
        if (response && response.messages && response.messages.length > 0) {
          whatsappMessageId = response.messages[0].id;
        }

        await this.prisma.message.create({
          data: {
            companyId: companyId,
            conversationId: conv.id,
            whatsappMessageId: whatsappMessageId,
            direction: 'OUTBOUND',
            type: 'TEXT',
            content: initialMessage.trim(),
            isBot: false,
            sentById: userId,
            status: 'SENT',
          }
        });
      } catch (err: any) {
        this.logger.error(`[WAHA] Failed to send initial message to ${customerPhone}: ${err.message}`);
        // We don't throw to disrupt the chat creation, we just let it fail silently and login
      }
    }

    const gateway = this.getWebsocketGateway();
    if (gateway && agent?.departmentId) {
      gateway.emitToDepartment(agent?.departmentId, 'conversation-assigned', {
        conversationId: conv.id,
        conversation: conv,
        agentName: agent.name,
      });
    }

    return conv;
  }

  async startChatFromExisting(conversationId: string, userId: string, companyId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conv || conv.companyId !== companyId) {
      throw new NotFoundException('Conversa não encontrada');
    }

    if (conv.status === 'OPEN' || conv.status === 'ASSIGNED') {
      throw new BadRequestException('Esta conversa já está em andamento com um atendente ou na fila.');
    }

    const agent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, name: true }
    });

    await this.prisma.assignment.updateMany({
      where: { conversationId: conv.id, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    await this.prisma.assignment.create({
      data: { conversationId: conv.id, userId },
    });

    const updated = await this.prisma.conversation.update({
      where: { id: conv.id },
      data: {
        status: 'ASSIGNED',
        flowState: 'ASSIGNED',
        assignedUserId: userId,
        assignedAt: new Date(),
        departmentId: agent?.departmentId || conv.departmentId,
        routedAt: new Date(),
        timeoutAt: null,
        unreadCount: 0,
      }
    });

    const gateway = this.getWebsocketGateway();
    if (gateway && updated.departmentId) {
      gateway.emitToDepartment(updated.departmentId, 'conversation-assigned', {
        conversationId: updated.id,
        conversation: updated,
        agentName: agent?.name,
      });
    }

    return updated;
  }

  /**
   * Converte URLs internas do WAHA (localhost:3000 ou host:3101) para o proxy
   * do backend, garantindo que o frontend sempre receba URLs acessíveis.
   * Mensagens salvas antes da implementação do proxy são corrigidas aqui.
   */
  private normalizeMediaUrl(url: string | null): string | null {
    if (!url) return url;
    const backendUrl =
      process.env.BACKEND_URL || 'http://192.168.10.156:4000';
    // Already our backend URL — return as-is (avoid double-processing)
    if (url.startsWith(backendUrl)) return url;
    // WAHA format: http://localhost:3000/api/files/{session}/{filename}
    const match = url.match(/\/api\/files\/([^/]+)\/(.+)$/);
    if (match) {
      const [, session, fileName] = match;
      return `${backendUrl}/api/files/${session}/${encodeURIComponent(fileName)}`;
    }
    return url;
  }

  async getMessages(
    conversationId: string,
    take = 50,
    cursor?: string,
    user?: { role: string; departmentId?: string | null },
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, departmentId: true },
    });
    if (!conv) throw new NotFoundException('Conversa nao encontrada');
    if (user && user.role !== 'ADMIN' && user.departmentId) {
      if (conv.departmentId !== user.departmentId) {
        throw new ForbiddenException('Acesso negado a esta conversa');
      }
    }
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'desc' },
      take,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      include: {
        sentBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Normaliza mediaUrl para mensagens antigas que guardam URL interna do WAHA
    return messages.map((msg) => ({
      ...msg,
      mediaUrl: this.normalizeMediaUrl(msg.mediaUrl),
    }));
  }

  async assign(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { department: true },
    });
    if (!conv) throw new NotFoundException('Conversa nao encontrada');
    const agent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    if (
      !agent ||
      (conv.departmentId && agent.departmentId !== conv.departmentId)
    ) {
      throw new ForbiddenException('Usuario nao pertence ao setor da conversa');
    }

    await this.prisma.assignment.updateMany({
      where: { conversationId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    await this.prisma.assignment.create({
      data: { conversationId, userId },
    });

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'ASSIGNED',
        assignedUserId: userId,
        assignedAt: new Date(),
        flowState: 'ASSIGNED',
        timeoutAt: null,
      },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    return updated;
  }

  async unassign(conversationId: string) {
    await this.prisma.assignment.updateMany({
      where: { conversationId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'OPEN', assignedUserId: null },
    });

    return { message: 'Conversa desatribuida' };
  }

  async transfer(
    conversationId: string,
    departmentId: string,
    userId?: string,
    currentUser: { companyId: string; role: string; name?: string } = {
      companyId: '',
      role: 'AGENT',
    },
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { department: true },
    });
    if (!conv || conv.companyId !== currentUser.companyId) {
      throw new NotFoundException('Conversa nao encontrada');
    }
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId: currentUser.companyId },
    });
    if (!dept) throw new NotFoundException('Departamento nao encontrado');

    // Close any previous assignments
    await this.prisma.assignment.updateMany({
      where: { conversationId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    const updateData: any = {
      departmentId,
      assignedUserId: null,
      assignedAt: null,
      status: 'OPEN',
      flowState: 'DEPARTMENT_SELECTED',
      routedAt: new Date(),
      timeoutAt: new Date(Date.now() + dept.responseTimeoutMinutes * 60 * 1000),
    };

    if (userId) {
      const agent = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true, name: true },
      });
      if (agent?.departmentId === departmentId) {
        updateData.assignedUserId = userId;
        updateData.assignedAt = new Date();
        updateData.flowState = 'ASSIGNED';
        updateData.timeoutAt = null;

        await this.prisma.assignment.create({
          data: { conversationId, userId },
        });
      }
    }

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        department: true,
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    const notifService = this.getNotificationsService();
    if (notifService) {
      notifService.notifyConversationTransferred({
        conversationId,
        customerName: conv.customerName || 'Cliente',
        customerPhone: conv.customerPhone,
        transferredBy: currentUser.name || 'Agente',
        fromDepartmentId: conv.departmentId || '',
        fromDepartmentName: conv.department?.name || 'Desconhecido',
        toDepartmentId: dept.id,
        toDepartmentName: dept.name,
        timestamp: new Date(),
      });
    }

    const gateway = this.getWebsocketGateway();
    if (gateway) {
      gateway.emitToDepartment(dept.id, 'conversation-queued', {
        conversationId,
        reason: 'transfer',
      });

      if (updateData.assignedUserId) {
        gateway.emitToUser(updateData.assignedUserId, 'conversation-assigned', {
          conversationId,
          conversation: updated,
          agentName: updated.assignedUser?.name,
        });
      }
    }

    return updated;
  }

  async updateStatus(conversationId: string, status: ConversationStatus) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }

  /**
   * Resolve a conversation and fully reset its state so the bot restarts
   * from the beginning when the client contacts again.
   */
  async resolve(conversationId: string, sendClosingMessage = true) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { company: true },
    });
    if (!conv) throw new NotFoundException('Conversa nao encontrada');

    // Send closing message before resetting state
    if (sendClosingMessage) {
      try {
        const to = (conv.metadata as any)?.chatId || conv.customerPhone;
        const closingText = conv.company.greetingMessage
          ? `Atendimento encerrado. Obrigado por entrar em contato! 😊`
          : `Atendimento encerrado. Obrigado por entrar em contato! 😊\n\nSe precisar de mais ajuda, é só nos chamar novamente.`;
        await this.whatsappService.sendTextMessage(
          conv.company.whatsappAccessToken,
          conv.company.whatsappPhoneNumberId,
          to,
          closingText,
        );
      } catch (err: any) {
        this.logger.warn(
          `[RESOLVE] Falha ao enviar mensagem de encerramento: ${err.message}`,
        );
      }
    }

    // Close all active assignments
    await this.prisma.assignment.updateMany({
      where: { conversationId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    // Reset conversation state completely so bot restarts on next contact
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'RESOLVED',
        flowState: 'GREETING',
        greetingSentAt: null,
        assignedUserId: null,
        assignedAt: null,
        departmentId: null,
        routedAt: null,
        timeoutAt: null,
        unreadCount: 0,
      },
    });
  }

  async markAsRead(conversationId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }

  async updateCustomerName(
    conversationId: string,
    customerName: string | null,
  ) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { customerName: customerName || null },
    });
  }

  // ===== Internal Notes =====

  async getNotes(conversationId: string) {
    return this.prisma.conversationNote.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async createNote(
    conversationId: string,
    authorId: string,
    companyId: string,
    content: string,
  ) {
    if (!content?.trim())
      throw new BadRequestException('Conteudo da nota nao pode ser vazio');
    return this.prisma.conversationNote.create({
      data: { conversationId, authorId, companyId, content: content.trim() },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async updateNote(
    noteId: string,
    content: string,
    userId: string,
    role: string,
  ) {
    if (!content?.trim())
      throw new BadRequestException('Conteudo da nota nao pode ser vazio');
    const note = await this.prisma.conversationNote.findUnique({
      where: { id: noteId },
    });
    if (!note) throw new NotFoundException('Nota nao encontrada');
    if (note.authorId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException(
        'Voce nao pode editar notas de outros usuarios',
      );
    }
    return this.prisma.conversationNote.update({
      where: { id: noteId },
      data: { content: content.trim() },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async deleteNote(noteId: string, userId: string, role: string) {
    const note = await this.prisma.conversationNote.findUnique({
      where: { id: noteId },
    });
    if (!note) throw new NotFoundException('Nota nao encontrada');
    if (note.authorId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException(
        'Voce nao pode deletar notas de outros usuarios',
      );
    }
    await this.prisma.conversationNote.delete({ where: { id: noteId } });
    return { deleted: true };
  }
}
