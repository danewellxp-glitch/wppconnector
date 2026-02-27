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
  ) { }

  /**
   * Converte URL interna do WAHA (http://localhost:3000/api/files/session/nome)
   * para URL do proxy no backend (http://host:4000/api/files/session/nome).
   */
  private wahaUrlToProxyUrl(wahaUrl: string): string {
    // WAHA format: /api/files/{session}/{filename}
    const match = wahaUrl.match(/\/api\/files\/([^/]+)\/(.+)$/);
    if (match) {
      const [, session, fileName] = match;
      const backendUrl =
        process.env.BACKEND_URL || 'http://192.168.10.156:4000';
      return `${backendUrl}/api/files/${session}/${encodeURIComponent(fileName)}`;
    }
    return wahaUrl;
  }

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

    // Resolve LID to real phone number
    let customerPhone = chatId;
    let contactProfile: any = null;

    // --- Nova engine de resolução do @lid ---
    if (chatId.includes('@lid')) {
      this.logger.log(`[WAHA] Tentando resolver @lid: ${chatId}`);

      // 1 & 2. Tentar via WAHA API (Endpoints diretos e Contacts)
      const resolvedFromApi = await this.whatsappService.resolveLid(chatId);

      if (resolvedFromApi) {
        customerPhone = resolvedFromApi;
      } else {
        // 3. Fallback do Banco de Dados
        const previousConv = await this.prisma.conversation.findFirst({
          where: {
            companyId: company.id,
            customerPhone: chatId, // Procurando onde o lid foi salvo como customerPhone
          },
          orderBy: { createdAt: 'desc' }
        });

        if (previousConv && previousConv.customerPhone && !previousConv.customerPhone.includes('@lid')) {
          this.logger.log(`[WAHA] @lid resolvido via Banco de Dados: ${chatId} -> ${previousConv.customerPhone}`);
          customerPhone = previousConv.customerPhone;
        } else {
          // Tentativa B: Procurar em metadata
          const metaConv = await this.prisma.conversation.findFirst({
            where: {
              companyId: company.id,
              metadata: { path: ['chatId'], equals: chatId }
            },
            orderBy: { createdAt: 'desc' }
          });

          if (metaConv && metaConv.customerPhone && !metaConv.customerPhone.includes('@lid')) {
            this.logger.log(`[WAHA] @lid resolvido via MetaData BD: ${chatId} -> ${metaConv.customerPhone}`);
            customerPhone = metaConv.customerPhone;
          } else {
            this.logger.warn(`[WAHA] ALERTA: Não foi possível resolver o @lid ${chatId}. Mensagem será salva com ID original.`);
          }
        }
      }
    }

    const contactInfo = await this.whatsappService.getContactInfo(customerPhone === chatId ? chatId : `${customerPhone}@c.us`);
    if (contactInfo?.number) {
      // Se não era lid, ou se conseguimos pegar info do número resolvido
      if (customerPhone === chatId) customerPhone = contactInfo.number;
      contactProfile = {
        pushname: contactInfo.pushname,
        name: contactInfo.name,
        isBusiness: contactInfo.isBusiness,
        profilePictureURL: contactInfo.profilePictureURL,
      };
      this.logger.log(
        `Resolved ${chatId} → ${customerPhone} (${contactInfo.pushname || 'no name'})`,
      );
    } else if (customerPhone !== chatId) {
      // Conseguimos resolver o LID, mas o getContactInfo falhou no novo número. Tudo bem.
      this.logger.log(`Resolved ${chatId} → ${customerPhone} (sem perfil na agenda)`);
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
      const originalMediaUrl = payload.media.url || undefined;
      const base64Data = payload.media.data;

      let folderType = 'documents';
      if (mimetype.startsWith('image/')) folderType = 'images';
      else if (mimetype.startsWith('audio/')) folderType = 'audios';
      else if (mimetype.startsWith('video/')) folderType = 'videos';

      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const subPath = `${folderType}/${yearMonth}`;

      if (base64Data) {
        // Caso 1: WAHA enviou o arquivo em base64 — salva localmente
        try {
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = mimetype.split('/')[1]?.split(';')[0] || 'bin';
          const uniqueFilename = `${Date.now()}_${require('crypto').randomUUID().slice(0, 8)}.${ext}`;
          const uploadsDir = require('path').join(process.cwd(), 'uploads', folderType, yearMonth);
          if (!require('fs').existsSync(uploadsDir)) {
            require('fs').mkdirSync(uploadsDir, { recursive: true });
          }
          require('fs').writeFileSync(
            require('path').join(uploadsDir, uniqueFilename),
            buffer,
          );
          const backendUrl =
            process.env.BACKEND_URL || 'http://192.168.10.156:4000';
          mediaUrl = `${backendUrl}/uploads/${subPath}/${uniqueFilename}`;
        } catch (error) {
          this.logger.error('Failed to save base64 media', error);
        }
      } else if (originalMediaUrl) {
        // Caso 2: WAHA enviou URL. Em vez de proxy, vamos baixar e salvar o arquivo
        // para garantir que replays funcionem corretamente e a URL não expire.
        try {
          // Se for uma URL do WAHA, ele precisa do acesso (e pode precisar do backend rodando)
          // Mas como o WAHA está na mesma rede/máquina, vamos tentar baixar o buffer
          const axios = require('axios');
          const wahaApiKey = process.env.WAHA_API_KEY || '';
          const wahaHeaders = wahaApiKey ? { 'X-Api-Key': wahaApiKey } : {};
          const response = await axios.get(originalMediaUrl, { responseType: 'arraybuffer', headers: wahaHeaders });
          const buffer = Buffer.from(response.data);

          let ext = mimetype.split('/')[1]?.split(';')[0];
          // Tratar extensão de alguns áudios de whatsapp
          if (!ext || ext === 'ogg; codecs=opus') ext = 'ogg';

          const uniqueFilename = `${Date.now()}_${require('crypto').randomUUID().slice(0, 8)}.${ext}`;
          const uploadsDir = require('path').join(process.cwd(), 'uploads', folderType, yearMonth);
          if (!require('fs').existsSync(uploadsDir)) {
            require('fs').mkdirSync(uploadsDir, { recursive: true });
          }
          require('fs').writeFileSync(
            require('path').join(uploadsDir, uniqueFilename),
            buffer,
          );
          const backendUrl =
            process.env.BACKEND_URL || 'http://192.168.10.156:4000';
          mediaUrl = `${backendUrl}/uploads/${subPath}/${uniqueFilename}`;
        } catch (error) {
          this.logger.error(`Failed to download and save media from ${originalMediaUrl}`, error.message);
          // Fallback para o proxy se o download falhar
          mediaUrl = this.wahaUrlToProxyUrl(originalMediaUrl);
        }
      }

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

    // Extract quoted message (reply context) if present
    // WAHA envia: payload.hasQuotedMsg=true, payload.replyTo.body e payload._data.quotedMsg.body
    const hasQuoted = payload.hasQuotedMsg || payload._data?.hasQuotedMsg || !!payload.replyTo?.body;
    const replyBody = payload.replyTo?.body || payload._data?.quotedMsg?.body;
    const replyType = payload._data?.quotedMsg?.type || payload.replyTo?._data?.type || 'chat';
    const quotedStanzaId = payload._data?.quotedStanzaID;
    const quotedParticipant = payload._data?.quotedParticipant?._serialized;
    const fromMe = quotedParticipant ? quotedParticipant !== payload.from : false;
    let quotedMsg: { id?: string; body?: string; type?: string; fromMe?: boolean } | undefined;
    if (hasQuoted && replyBody) {
      quotedMsg = { id: quotedStanzaId, body: replyBody, type: replyType, fromMe };
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
        // Claim atômico: somente quem conseguir setar greetingSentAt (quando ainda null) procede.
        // Evita duplicidade quando webhook e polling processam o mesmo evento simultaneamente.
        const claimed = await this.prisma.conversation.updateMany({
          where: { id: conversation.id, flowState: 'GREETING', greetingSentAt: null },
          data: { greetingSentAt: new Date() },
        });

        if (claimed.count === 0) {
          // Outro handler já enviou o greeting — salva a mensagem e encerra
          await this.messagesService.handleIncomingMessage(
            company.id, customerPhone, whatsappMessageId, content, type, customerName, mediaUrl, chatId, contactProfile,
          );
          return;
        }

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
        if (!this.flowEngineService.isBusinessHours(company)) {
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
        quotedMsg,
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
        quotedMsg,
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
            .catch(() => { });
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
        quotedMsg,
      );

      this.whatsappService
        .markAsRead(
          company.whatsappAccessToken,
          company.whatsappPhoneNumberId,
          whatsappMessageId,
        )
        .catch(() => { });
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
      quotedMsg,
    );

    // Auto mark as read via WAHA
    this.whatsappService
      .markAsRead(
        company.whatsappAccessToken,
        company.whatsappPhoneNumberId,
        whatsappMessageId,
      )
      .catch(() => { });
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
