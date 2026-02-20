import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private polling = false;

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
      this.configService.get<string>('WAHA_API_URL') || 'http://192.168.10.156:3101';
    this.wahaApiKey =
      this.configService.get<string>('WAHA_API_KEY') || '';
    this.wahaSession =
      this.configService.get<string>('WAHA_SESSION') || 'default';
  }

  onModuleInit() {
    if (this.provider !== 'WAHA') return;
    this.logger.log('Starting WAHA polling (every 5s)...');
    this.intervalId = setInterval(() => this.poll(), 5000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private wahaHeaders() {
    return this.wahaApiKey
      ? { 'X-Api-Key': this.wahaApiKey }
      : {};
  }

  private async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      this.logger.debug(`Polling ${this.wahaApiUrl}/api/${this.wahaSession}/chats/overview`);
      // Get chats with unread messages
      const res = await axios.get(
        `${this.wahaApiUrl}/api/${this.wahaSession}/chats/overview`,
        {
          params: { limit: 50 },
          headers: this.wahaHeaders(),
        },
      );

      const chats: any[] = res.data || [];
      // WAHA overview returns unreadCount (and sometimes isGroup) inside _chat
      const unreadChats = chats
        .map((c: any) => ({
          ...c,
          unreadCount: c.unreadCount ?? c._chat?.unreadCount ?? 0,
          isGroup: c.isGroup ?? c._chat?.isGroup ?? false,
        }))
        .filter((c: any) => c.unreadCount > 0 && !c.isGroup);

      if (unreadChats.length === 0) {
        this.polling = false;
        return;
      }

      this.logger.log(
        `Found ${unreadChats.length} chats with unread messages`,
      );

      const company = await this.prisma.company.findFirst();
      if (!company) {
        this.polling = false;
        return;
      }

      for (const chat of unreadChats) {
        await this.processChat(chat, company);
      }
    } catch (error: any) {
      this.logger.error(`Polling error: ${error.code || ''} ${error.message}`);
    }
    this.polling = false;
  }

  private async processChat(chat: any, company: any) {
    try {
      const chatId =
        typeof chat.id === 'string'
          ? chat.id
          : chat.id?._serialized || '';
      if (!chatId) return;

      // Fetch recent messages for this chat
      const msgRes = await axios.get(
        `${this.wahaApiUrl}/api/${this.wahaSession}/chats/${encodeURIComponent(chatId)}/messages`,
        {
          params: { limit: chat.unreadCount, downloadMedia: false },
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

        const contactInfo =
          await this.whatsappService.getContactInfo(chatId);
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
          mediaUrl = msg.media?.url || undefined;
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

        this.logger.log(
          `Processing message: ${whatsappMessageId} from ${customerPhone}`,
        );

        let conversation =
          await this.messagesService.findOrCreateConversation(
            company.id,
            customerPhone,
            customerName,
            chatId,
            contactProfile,
          );

        // Reabrir conversa resolvida
        if (conversation.status === 'RESOLVED') {
          this.logger.log(`[FLOW] Conversa RESOLVED — reabrindo para ${customerPhone}`);
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

        if (conversation.flowState === 'GREETING') {
          if (!conversation.greetingSentAt) {
            await this.flowEngineService.sendGreeting(conversation);
            await this.prisma.conversation.update({
              where: { id: conversation.id },
              data: { greetingSentAt: new Date() },
            });
          } else {
            const body = (msg.body || '').trim();
            const slugHint = this.flowEngineService.processMenuChoice(body);
            if (slugHint) {
              const resolvedDept = await this.flowEngineService.resolveDepartmentSlug(company.id, slugHint);
              if (resolvedDept) {
                await this.departmentRoutingService.routeToDepartment(conversation.id, resolvedDept.slug, company.id);
              } else {
                await this.flowEngineService.handleInvalidChoice(conversation);
              }
            } else {
              await this.flowEngineService.handleInvalidChoice(conversation);
            }
          }
          // Salvar a mensagem ANTES de continuar — garante idempotência no próximo ciclo
          // (sem isso, markAsRead falhar causa reprocessamento a cada 5s → loop de "indisponíveis")
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
          continue;
        }

        // Resposta à sugestão de roteamento inteligente
        if (conversation.flowState === 'AWAITING_ROUTING_CONFIRMATION') {
          const body = (msg.body || '').trim();
          this.logger.log(`[ROUTING] Processando resposta de sugestão de roteamento: "${body}"`);
          const result = await this.conversationRoutingService.handleRoutingSuggestionResponse(conversation.id, body);
          if (result.accepted && result.departmentId) {
            const department = await this.prisma.department.findUnique({ where: { id: result.departmentId } });
            if (department) {
              await this.departmentRoutingService.assignToAgent(conversation.id, result.departmentId);
            }
          }
          await this.messagesService.handleIncomingMessage(
            company.id, customerPhone, whatsappMessageId, content, type, customerName, mediaUrl, chatId, contactProfile,
          );
          continue;
        }

        // TIMEOUT_REDIRECT: tenta reatribuir silenciosamente
        if (conversation.flowState === 'TIMEOUT_REDIRECT') {
          if (conversation.departmentId) {
            await this.departmentRoutingService.assignToAgent(conversation.id, conversation.departmentId);
          }
          await this.messagesService.handleIncomingMessage(
            company.id, customerPhone, whatsappMessageId, content, type, customerName, mediaUrl, chatId, contactProfile,
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
        );
      }

      // Mark chat as read in WAHA
      try {
        await axios.post(
          `${this.wahaApiUrl}/api/${this.wahaSession}/chats/${encodeURIComponent(chatId)}/messages/read`,
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
