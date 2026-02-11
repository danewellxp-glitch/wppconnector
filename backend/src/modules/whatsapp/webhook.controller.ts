import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { WhatsappService } from './whatsapp.service';

@Controller('webhooks/whatsapp')
@SkipThrottle()
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private whatsappService: WhatsappService,
  ) {}

  // Meta webhook verification (GET)
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken = this.configService.get<string>('WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully');
      return parseInt(challenge, 10);
    }

    this.logger.warn('Webhook verification failed');
    return 'Forbidden';
  }

  // Meta webhook events (POST)
  @Post()
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    this.logger.debug('Webhook received', JSON.stringify(body));

    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) return 'OK';

      // Handle incoming messages
      if (value.messages) {
        for (const message of value.messages) {
          await this.handleIncomingMessage(value, message);
        }
      }

      // Handle status updates (sent, delivered, read)
      if (value.statuses) {
        for (const status of value.statuses) {
          await this.handleStatusUpdate(status);
        }
      }
    } catch (error) {
      this.logger.error('Error processing webhook', error);
    }

    return 'OK';
  }

  private async handleIncomingMessage(value: any, message: any) {
    const phoneNumberId = value.metadata?.phone_number_id;

    // Find company by phone number ID
    const company = await this.prisma.company.findUnique({
      where: { whatsappPhoneNumberId: phoneNumberId },
    });

    if (!company) {
      this.logger.warn(
        `No company found for phone number ID: ${phoneNumberId}`,
      );
      return;
    }

    const customerPhone = message.from;
    const customerName = value.contacts?.[0]?.profile?.name || null;

    let content = '';
    let type = 'TEXT';
    let mediaUrl: string | undefined;

    switch (message.type) {
      case 'text':
        content = message.text?.body || '';
        type = 'TEXT';
        break;
      case 'image': {
        content = message.image?.caption || '[Imagem]';
        type = 'IMAGE';
        const imageMedia = await this.whatsappService.retrieveMedia(
          company.whatsappAccessToken,
          message.image?.id,
        );
        if (imageMedia) mediaUrl = imageMedia.url;
        break;
      }
      case 'document': {
        content = message.document?.filename || '[Documento]';
        type = 'DOCUMENT';
        const docMedia = await this.whatsappService.retrieveMedia(
          company.whatsappAccessToken,
          message.document?.id,
        );
        if (docMedia) mediaUrl = docMedia.url;
        break;
      }
      case 'audio': {
        content = '[Audio]';
        type = 'AUDIO';
        const audioMedia = await this.whatsappService.retrieveMedia(
          company.whatsappAccessToken,
          message.audio?.id,
        );
        if (audioMedia) mediaUrl = audioMedia.url;
        break;
      }
      case 'video': {
        content = message.video?.caption || '[Video]';
        type = 'VIDEO';
        const videoMedia = await this.whatsappService.retrieveMedia(
          company.whatsappAccessToken,
          message.video?.id,
        );
        if (videoMedia) mediaUrl = videoMedia.url;
        break;
      }
      default:
        content = `[${message.type}]`;
        break;
    }

    await this.messagesService.handleIncomingMessage(
      company.id,
      customerPhone,
      message.id,
      content,
      type,
      customerName,
      mediaUrl,
    );

    // Auto mark-as-read on Meta's side
    this.whatsappService
      .markAsRead(
        company.whatsappAccessToken,
        company.whatsappPhoneNumberId,
        message.id,
      )
      .catch(() => {});
  }

  private async handleStatusUpdate(status: any) {
    const statusMap: Record<string, 'SENT' | 'DELIVERED' | 'READ'> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
    };

    const mappedStatus = statusMap[status.status];
    if (!mappedStatus || mappedStatus === 'SENT') return;

    await this.messagesService.updateMessageStatus(status.id, mappedStatus);
  }
}
