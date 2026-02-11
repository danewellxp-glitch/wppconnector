import {
  Controller,
  Post,
  Body,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { WhatsappService } from './whatsapp.service';

@Controller('webhooks/waha')
@SkipThrottle()
export class WahaWebhookController {
  private readonly logger = new Logger(WahaWebhookController.name);

  constructor(
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private whatsappService: WhatsappService,
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
        case 'message.any':
          // Ignore outbound messages (fromMe = true)
          if (payload.fromMe) {
            this.logger.debug('Ignoring outbound message');
            return 'OK';
          }
          await this.handleIncomingMessage(payload);
          break;
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

    this.logger.log(`Incoming message from ${chatId}`);

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
        : payload.id?._serialized || payload.id?.id || `waha_${Date.now()}`;

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
