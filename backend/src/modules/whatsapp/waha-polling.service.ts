import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { WhatsappService } from './whatsapp.service';
import { FlowEngineService } from './flow-engine.service';
import { DepartmentRoutingService } from '../departments/department-routing.service';
import { ConversationRoutingService } from '../conversations/conversation-routing.service';

@Injectable()
export class WahaPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WahaPollingService.name);
  private readonly provider: string;
  private readonly wahaApiUrl: string;
  private readonly wahaApiKey: string;
  private readonly wahaSession: string;
  private readonly wahaSessions: string[];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  private readonly backendUrl: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private whatsappService: WhatsappService,
    private flowEngineService: FlowEngineService,
    private departmentRoutingService: DepartmentRoutingService,
    private conversationRoutingService: ConversationRoutingService,
  ) {
    this.provider =
      this.configService.get<string>('WHATSAPP_PROVIDER') || 'META';
    this.wahaApiUrl =
      this.configService.get<string>('WAHA_API_URL') ||
      'http://192.168.10.156:3101';
    this.wahaApiKey = this.configService.get<string>('WAHA_API_KEY') || '';
    this.wahaSession =
      this.configService.get<string>('WAHA_SESSION') || 'default';
    const sessionsEnv =
      this.configService.get<string>('WAHA_SESSIONS') || this.wahaSession;
    this.wahaSessions = sessionsEnv.split(',').map((s) => s.trim());
    this.backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      'http://192.168.10.156:4000';
  }

  /**
   * Converte URL interna do WAHA (ex: http://localhost:3000/api/files/session/nome.oga)
   * para URL do proxy no backend (ex: http://192.168.10.156:4000/api/files/session/nome.oga).
   * O WAHA roda em Docker e usa porta interna diferente da externa.
   */
  private wahaUrlToProxyUrl(wahaUrl: string): string {
    // WAHA format: /api/files/{session}/{filename}
    const match = wahaUrl.match(/\/api\/files\/([^/]+)\/(.+)$/);
    if (match) {
      const [, session, fileName] = match;
      return `${this.backendUrl}/api/files/${session}/${encodeURIComponent(fileName)}`;
    }
    return wahaUrl;
  }

  onModuleInit() {
    if (this.provider !== 'WAHA') return;
    this.logger.log('Starting WAHA polling (every 5s)...');
    this.intervalId = setInterval(() => this.poll(), 30000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private wahaHeaders() {
    return this.wahaApiKey ? { 'X-Api-Key': this.wahaApiKey } : {};
  }

  private async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const company = await this.prisma.company.findFirst();
      if (!company) {
        this.polling = false;
        return;
      }

      for (const session of this.wahaSessions) {
        await this.pollSession(session, company);
      }
    } catch (error: any) {
      this.logger.error(`Polling error: ${error.code || ''} ${error.message}`);
    }
    this.polling = false;
  }

  private async pollSession(session: string, company: any) {
    try {
      this.logger.debug(
        `Polling ${this.wahaApiUrl}/api/${session}/chats/overview`,
      );
      const res = await axios.get(
        `${this.wahaApiUrl}/api/${session}/chats/overview`,
        {
          params: { limit: 50 },
          headers: this.wahaHeaders(),
        },
      );

      const chats: any[] = res.data || [];
      const unreadChats = chats
        .map((c: any) => ({
          ...c,
          unreadCount: c.unreadCount ?? c._chat?.unreadCount ?? 0,
          isGroup: c.isGroup ?? c._chat?.isGroup ?? false,
        }))
        .filter((c: any) => c.unreadCount > 0 && !c.isGroup);

      if (unreadChats.length === 0) return;

      this.logger.log(
        `[${session}] Found ${unreadChats.length} chats with unread messages`,
      );

      for (const chat of unreadChats) {
        await this.processChat(chat, company, session);
      }
    } catch (error: any) {
      this.logger.error(
        `[${session}] Polling error: ${error.code || ''} ${error.message}`,
      );
    }
  }

  private async processChat(chat: any, company: any, session = 'default') {
    try {
      const chatId =
        typeof chat.id === 'string' ? chat.id : chat.id?._serialized || '';
      if (!chatId) return;

      // Skip @lid chats — WAHA returns 500 for these endpoints.
      // These messages are handled correctly by the webhook.
      if (chatId.includes('@lid')) {
        this.logger.debug("[" + session + "] Skipping @lid chat " + chatId + " — handled by webhook");
        return;
      }

      // Fetch recent messages for this chat
      const msgRes = await axios.get(
        `${this.wahaApiUrl}/api/${session}/chats/${encodeURIComponent(chatId)}/messages`,
        {
          params: { limit: chat.unreadCount, downloadMedia: true },
          headers: this.wahaHeaders(),
        },
      );

      const messages: any[] = msgRes.data || [];

      for (const msg of messages) {
        // Skip outbound messages
        if (msg.fromMe) continue;

        const whatsappMessageId =
          typeof msg.id === 'string'
            ? msg.id
            : msg.id?._serialized || msg.id?.id || '';
        if (!whatsappMessageId) continue;

        // Check if already processed (idempotency)
        const existing = await this.prisma.message.findUnique({
          where: { whatsappMessageId },
        });
        if (existing) continue;

        // Resolve LID to real phone
        let customerPhone = chatId;
        let contactProfile: any = null;
        let contactInfo: any = null;

        try {
          contactInfo = await this.whatsappService.getContactInfo(chatId, session);
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
        } catch (err: any) {
          this.logger.warn(
            `[${session}] Não foi possível resolver contato ${chatId}: ${err.message}. Usando ID bruto.`,
          );
        }

        const customerName =
          contactInfo?.pushname ||
          contactInfo?.name ||
          msg._data?.notifyName ||
          chat.name ||
          null;

        // Determine message type and content
        let content = msg.body || '';
        let type = 'TEXT';
        let mediaUrl: string | undefined;

        if (msg.hasMedia && msg.media) {
          const mimetype = msg.media?.mimetype || '';
          const rawUrl = msg.media?.url || undefined;

          let folderType = 'documents';
          if (mimetype.startsWith('image/')) folderType = 'images';
          else if (mimetype.startsWith('audio/')) folderType = 'audios';
          else if (mimetype.startsWith('video/')) folderType = 'videos';

          const now = new Date();
          const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const subPath = `${folderType}/${yearMonth}`;

          // Converte URL interna do WAHA para o proxy do backend ou salva localmente
          if (rawUrl) {
            try {
              // WAHA envia URLs internas com localhost:3000 — substitui pela URL real do WAHA
              const downloadUrl = rawUrl.replace(/https?:\/\/localhost:\d+/, this.wahaApiUrl);
              const response = await axios.get(downloadUrl, { responseType: 'arraybuffer', headers: this.wahaHeaders() });
              const buffer = Buffer.from(response.data);
              let ext = mimetype.split('/')[1]?.split(';')[0];
              if (!ext || ext === 'ogg; codecs=opus') ext = 'ogg';

              const uniqueFilename = `${Date.now()}_${require('crypto').randomUUID().slice(0, 8)}.${ext}`;
              const uploadsDir = require('path').join(process.cwd(), 'uploads', folderType, yearMonth);
              if (!require('fs').existsSync(uploadsDir)) {
                require('fs').mkdirSync(uploadsDir, { recursive: true });
              }
              require('fs').writeFileSync(require('path').join(uploadsDir, uniqueFilename), buffer);
              mediaUrl = `${this.backendUrl}/uploads/${subPath}/${uniqueFilename}`;
            } catch (error) {
              this.logger.error(`Failed to download and save media from ${rawUrl}`, error.message);
              mediaUrl = this.wahaUrlToProxyUrl(rawUrl); // fallback
            }
          } else {
            mediaUrl = undefined;
          }
          if (mimetype.startsWith('image/')) {
            type = 'IMAGE';
            content = msg.body || '[Imagem]';
          } else if (mimetype.startsWith('audio/')) {
            type = 'AUDIO';
            content = '[Audio]';
          } else if (mimetype.startsWith('video/')) {
            type = 'VIDEO';
            content = msg.body || '[Video]';
          } else {
            type = 'DOCUMENT';
            content = msg.media?.filename || msg.body || '[Documento]';
          }
        }

        // Extract quoted message (reply context) if present
        // WAHA envia: msg.hasQuotedMsg=true, msg.replyTo.body e msg._data.quotedMsg.body
        const hasQuoted = msg.hasQuotedMsg || msg._data?.hasQuotedMsg || !!msg.replyTo?.body;
        const replyBody = msg.replyTo?.body || msg._data?.quotedMsg?.body;
        const replyType = msg._data?.quotedMsg?.type || msg.replyTo?._data?.type || 'chat';
        const quotedStanzaId = msg._data?.quotedStanzaID;
        const quotedParticipant = msg._data?.quotedParticipant?._serialized;
        const msgFromMe = msg.from;
        let quotedMsg: { id?: string; body?: string; type?: string; fromMe?: boolean } | undefined;
        if (hasQuoted && replyBody) {
          quotedMsg = {
            id: quotedStanzaId,
            body: replyBody,
            type: replyType,
            fromMe: quotedParticipant ? quotedParticipant !== msgFromMe : false,
          };
        }

        this.logger.log(
          `Processing message: ${whatsappMessageId} from ${customerPhone}`,
        );

        let conversation = await this.messagesService.findOrCreateConversation(
          company.id,
          customerPhone,
          customerName,
          chatId,
          contactProfile,
          session,
        );

        // Re-fetch para garantir estado atualizado (webhook pode ter alterado entre o fetch e agora)
        conversation = (await this.prisma.conversation.findUnique({ where: { id: conversation.id } })) ?? conversation;

        // Reabrir conversa resolvida
        if (conversation.status === 'RESOLVED') {
          this.logger.log(
            `[FLOW] Conversa RESOLVED — reabrindo para ${customerPhone}`,
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
            },
          });
        }

        if (conversation.flowState === 'GREETING') {
          // Salvar a mensagem PRIMEIRO — garante idempotência no próximo ciclo
          // mesmo que o envio de resposta falhe (ex: @lid não resolvível pelo WAHA)
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
            session,
          );

          if (!conversation.greetingSentAt) {
            // Claim atômico: evita duplicidade com o webhook processando o mesmo evento
            const claimed = await this.prisma.conversation.updateMany({
              where: { id: conversation.id, flowState: 'GREETING', greetingSentAt: null },
              data: { greetingSentAt: new Date() },
            });
            if (claimed.count > 0) {
              try {
                await this.flowEngineService.sendGreeting(conversation);
              } catch (err: any) {
                this.logger.warn(`[${session}] Falha ao enviar saudação para ${customerPhone}: ${err.message}`);
              }
            }
          } else {
            const body = (msg.body || '').trim();
            const slugHint = this.flowEngineService.processMenuChoice(body);
            try {
              if (slugHint) {
                const resolvedDept =
                  await this.flowEngineService.resolveDepartmentSlug(
                    company.id,
                    slugHint,
                  );
                if (resolvedDept) {
                  await this.departmentRoutingService.routeToDepartment(
                    conversation.id,
                    resolvedDept.slug,
                    company.id,
                  );
                } else {
                  await this.flowEngineService.handleInvalidChoice(conversation);
                }
              } else {
                await this.flowEngineService.handleInvalidChoice(conversation);
              }
            } catch (err: any) {
              this.logger.warn(`[${session}] Falha ao processar menu para ${customerPhone}: ${err.message}`);
            }
          }
          continue;
        }

        // Resposta à sugestão de roteamento inteligente
        if (conversation.flowState === 'AWAITING_ROUTING_CONFIRMATION') {
          const body = (msg.body || '').trim();
          this.logger.log(
            `[ROUTING] Processando resposta de sugestão de roteamento: "${body}"`,
          );
          const result =
            await this.conversationRoutingService.handleRoutingSuggestionResponse(
              conversation.id,
              body,
            );
          if (result.accepted && result.departmentId) {
            const department = await this.prisma.department.findUnique({
              where: { id: result.departmentId },
            });
            if (department) {
              await this.departmentRoutingService.assignToAgent(
                conversation.id,
                result.departmentId,
              );
            }
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
            session,
          );
          continue;
        }

        // TIMEOUT_REDIRECT: tenta reatribuir silenciosamente
        if (conversation.flowState === 'TIMEOUT_REDIRECT') {
          if (conversation.departmentId) {
            await this.departmentRoutingService.assignToAgent(
              conversation.id,
              conversation.departmentId,
            );
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
            session,
          );
          continue;
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
          session,
        );
      }

      // Mark chat as read in WAHA
      try {
        await axios.post(
          `${this.wahaApiUrl}/api/${session}/chats/${encodeURIComponent(chatId)}/messages/read`,
          {},
          { headers: this.wahaHeaders() },
        );
      } catch {
        // ignore read errors
      }
    } catch (error: any) {
      this.logger.error(`Error processing chat: ${error.message}`);
    }
  }
}
