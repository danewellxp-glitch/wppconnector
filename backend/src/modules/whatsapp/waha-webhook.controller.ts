import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { WhatsappService } from './whatsapp.service';
import { FlowEngineService } from './flow-engine.service';
import { DepartmentRoutingService } from '../departments/department-routing.service';
import { ConversationRoutingService } from '../conversations/conversation-routing.service';

@Controller('webhooks/waha')
@SkipThrottle()
export class WahaWebhookController {
  private readonly logger = new Logger(WahaWebhookController.name);

  constructor(
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private whatsappService: WhatsappService,
    private flowEngineService: FlowEngineService,
    private departmentRoutingService: DepartmentRoutingService,
    private conversationRoutingService: ConversationRoutingService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    this.logger.debug('WAHA webhook received', JSON.stringify(body));

    try {
      const { event, payload } = body;

      if (!payload) return 'OK';

      switch (event) {
        case 'message':
          // Ignore outbound messages (fromMe = true)
          if (payload.fromMe) {
            this.logger.debug('Ignoring outbound message');
            return 'OK';
          }
          await this.handleIncomingMessage(payload);
          break;
        case 'message.any':
          // Ignore message.any completely for now to avoid duplicate processing,
          // since the 'message' event already catches all inbound messages.
          return 'OK';
        case 'message.ack':
          await this.handleStatusUpdate(payload);
          break;
        default:
          this.logger.debug(`Ignoring event: ${event}`);
      }
    } catch (error) {
      this.logger.error('Error processing WAHA webhook', error);
    }

    return 'OK';
  }

  private async handleIncomingMessage(payload: any) {
    const chatId = payload.from || '';
    if (!chatId) {
      this.logger.warn('No phone number in WAHA payload');
      return;
    }

    this.logger.log(`Incoming message from ${chatId} `);

    // Find the first company (WAHA is for testing only)
    const company = await this.prisma.company.findFirst();
    if (!company) {
      this.logger.warn('No company found in database for WAHA webhook');
      return;
    }

    // Resolve LID to real phone number via WAHA contacts API
    let customerPhone = chatId;
    let contactProfile: any = null;

    const contactInfo = await this.whatsappService.getContactInfo(chatId);
    if (contactInfo?.number) {
      customerPhone = contactInfo.number;
      contactProfile = {
        pushname: contactInfo.pushname,
        name: contactInfo.name,
        isBusiness: contactInfo.isBusiness,
        profilePictureURL: contactInfo.profilePictureURL,
      };
      this.logger.log(
        `Resolved ${chatId} → ${customerPhone} (${contactInfo.pushname || 'no name'})`,
      );
    }

    const whatsappMessageId =
      typeof payload.id === 'string'
        ? payload.id
        : payload.id?._serialized || payload.id?.id || `waha_${Date.now()} `;

    const customerName =
      contactInfo?.pushname ||
      contactInfo?.name ||
      payload.notifyName ||
      payload._data?.notifyName ||
      null;

    let content = '';
    let type = 'TEXT';
    let mediaUrl: string | undefined;

    if (payload.hasMedia && payload.media) {
      const mimetype = payload.media.mimetype || '';
      mediaUrl = payload.media.url || undefined;

      if (mimetype.startsWith('image/')) {
        type = 'IMAGE';
        content = payload.body || '[Imagem]';
      } else if (mimetype.startsWith('audio/')) {
        type = 'AUDIO';
        content = '[Audio]';
      } else if (mimetype.startsWith('video/')) {
        type = 'VIDEO';
        content = payload.body || '[Video]';
      } else {
        type = 'DOCUMENT';
        content = payload.media.filename || payload.body || '[Documento]';
      }
    } else {
      content = payload.body || '';
      type = 'TEXT';
    }

    // Find or create conversation (without saving message yet)
    let conversation = await this.messagesService.findOrCreateConversation(
      company.id,
      customerPhone,
      customerName,
      chatId,
      contactProfile,
    );

    // If conversation was RESOLVED, reopen it and restart the bot flow
    if (conversation.status === 'RESOLVED') {
      this.logger.log(
        `[FLOW] Conversation RESOLVED — reopening and restarting bot for ${customerPhone}`,
      );
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'OPEN',
          flowState: 'GREETING',
          greetingSentAt: null,
          assignedUserId: null,
          assignedAt: null,
          departmentId: null,
          routedAt: null,
          timeoutAt: null,
        },
      });
    }

    // --- Flow Engine Logic ---
    if (conversation.flowState === 'GREETING') {
      if (!conversation.greetingSentAt) {
        // First message: check for previous attendance and suggest routing
        this.logger.log(
          `[FLOW] Checking for previous attendance for ${customerPhone}`,
        );
        const hasSuggestion =
          await this.conversationRoutingService.checkAndSuggestPreviousRouting(
            conversation.id,
            customerPhone,
            company.id,
          );

        if (hasSuggestion) {
          // Conversa em estado AWAITING_ROUTING_CONFIRMATION, aguardando resposta
          return;
        }

        // Sem sugestão anterior: verificar horário comercial
        if (!this.flowEngineService.isBusinessHours()) {
          this.logger.log(
            `[FLOW] Out of hours for ${customerPhone}. Sending offline message...`,
          );
          await this.flowEngineService.sendOutOfHoursMessage(conversation);

          // Route immediately to Admin so it stays in the queue for the next business day
          const adminDept = await this.flowEngineService.resolveDepartmentSlug(
            company.id,
            'administrativo',
          );
          if (adminDept) {
            await this.departmentRoutingService.routeToDepartment(
              conversation.id,
              adminDept.slug,
              company.id,
            );
          }
        } else {
          // Horário comercial, prossegue com o menu normal
          this.logger.log(`[FLOW] Sending greeting to ${customerPhone} `);
          await this.flowEngineService.sendGreeting(conversation);
          await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: { greetingSentAt: new Date() },
          });
        }
      } else {
        // Second message: process menu choice
        const body = (content || '').trim();
        const slugHint = this.flowEngineService.processMenuChoice(body);
        if (slugHint) {
          // Resolve slug to actual department for this company (with root fallback)
          const resolvedDept =
            await this.flowEngineService.resolveDepartmentSlug(
              company.id,
              slugHint,
            );
          if (resolvedDept) {
            this.logger.log(
              `[FLOW] Routing ${customerPhone} to department: ${resolvedDept.name} (${resolvedDept.slug})`,
            );
            await this.departmentRoutingService.routeToDepartment(
              conversation.id,
              resolvedDept.slug,
              company.id,
            );
          } else {
            this.logger.warn(
              `[FLOW] No department resolved for slug '${slugHint}' in company ${company.id} `,
            );
            await this.flowEngineService.handleInvalidChoice(conversation);
          }
        } else {
          this.logger.log(
            `[FLOW] Invalid choice from ${customerPhone}: "${body}"`,
          );
          await this.flowEngineService.handleInvalidChoice(conversation);
        }
      }

      // Save the inbound message to DB
      await this.messagesService.handleIncomingMessage(
        company.id,
        customerPhone,
        whatsappMessageId,
        content,
        type,
        customerName,
        mediaUrl,
        chatId,
        contactProfile,
      );
      return;
    }

    // 🔄 Handle intelligent routing suggestion response
    if (conversation.flowState === 'AWAITING_ROUTING_CONFIRMATION') {
      const body = (content || '').trim();
      this.logger.log(
        `[ROUTING] Processing routing suggestion response: "${body}"`,
      );

      const result =
        await this.conversationRoutingService.handleRoutingSuggestionResponse(
          conversation.id,
          body,
        );

      if (result.accepted && result.departmentId) {
        // Cliente aceitou sugestão de retorno
        this.logger.log(
          `[ROUTING] Client accepted routing suggestion.Routing to department: ${result.departmentId} `,
        );

        // Tentar atribuir agente
        const department = await this.prisma.department.findUnique({
          where: { id: result.departmentId },
        });

        if (department) {
          const agent = await this.departmentRoutingService.assignToAgent(
            conversation.id,
            result.departmentId,
          );

          if (agent) {
            this.logger.log(
              `[ROUTING] Agent assigned: ${agent.name} for suggested routing`,
            );
          }
        }
      }

      // Save the inbound message (resposta SIM/NÃO)
      await this.messagesService.handleIncomingMessage(
        company.id,
        customerPhone,
        whatsappMessageId,
        content,
        type,
        customerName,
        mediaUrl,
        chatId,
        contactProfile,
      );
      return; // Don't process further when responding to routing suggestion
    }

    // 🔄 Handle TIMEOUT_REDIRECT: cliente aguardando agente, tenta reatribuir silenciosamente
    if (conversation.flowState === 'TIMEOUT_REDIRECT') {
      this.logger.log(
        `[FLOW] TIMEOUT_REDIRECT: tentando reatribuir conversa ${conversation.id} `,
      );

      if (conversation.departmentId) {
        const dept = await this.prisma.department.findUnique({
          where: { id: conversation.departmentId },
        });

        const agent = await this.departmentRoutingService.assignToAgent(
          conversation.id,
          conversation.departmentId,
        );

        if (agent) {
          this.logger.log(
            `[FLOW] Agente ${agent.name} disponível agora, atribuindo conversa ${conversation.id} `,
          );
          // Notificar cliente que um agente está disponível (sem reenviar o menu)
          const deptName = dept?.name || 'Atendimento';
          const sendTo =
            (conversation.metadata as any)?.chatId ||
            conversation.customerPhone;
          await this.whatsappService
            .sendTextMessage(
              company.whatsappAccessToken,
              company.whatsappPhoneNumberId,
              sendTo,
              `✅ Um atendente do setor * ${deptName} * está disponível!\n\nConectando com * ${agent.name}*... 😊`,
            )
            .catch(() => {});
        }
        // Se ainda sem agentes: salva a mensagem silenciosamente, sem reenviar "indisponíveis"
      }

      await this.messagesService.handleIncomingMessage(
        company.id,
        customerPhone,
        whatsappMessageId,
        content,
        type,
        customerName,
        mediaUrl,
        chatId,
        contactProfile,
      );

      this.whatsappService
        .markAsRead(
          company.whatsappAccessToken,
          company.whatsappPhoneNumberId,
          whatsappMessageId,
        )
        .catch(() => {});
      return;
    }

    // For conversations already routed (DEPARTMENT_SELECTED, ASSIGNED), just save the message
    await this.messagesService.handleIncomingMessage(
      company.id,
      customerPhone,
      whatsappMessageId,
      content,
      type,
      customerName,
      mediaUrl,
      chatId,
      contactProfile,
    );

    // Auto mark as read via WAHA
    this.whatsappService
      .markAsRead(
        company.whatsappAccessToken,
        company.whatsappPhoneNumberId,
        whatsappMessageId,
      )
      .catch(() => {});
  }

  private async handleStatusUpdate(payload: any) {
    // WAHA ack values: 1=SENT, 2=DELIVERED, 3=READ
    const ackMap: Record<number, 'SENT' | 'DELIVERED' | 'READ'> = {
      1: 'SENT',
      2: 'DELIVERED',
      3: 'READ',
    };

    const mappedStatus = ackMap[payload.ack];
    if (!mappedStatus || mappedStatus === 'SENT') return;

    const messageId = payload.id;
    if (!messageId) return;

    await this.messagesService.updateMessageStatus(messageId, mappedStatus);
  }
}
