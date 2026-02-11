import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WebhookController } from './webhook.controller';
import { WahaWebhookController } from './waha-webhook.controller';
import { WahaPollingService } from './waha-polling.service';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [forwardRef(() => MessagesModule)],
  controllers: [WebhookController, WahaWebhookController],
  providers: [WhatsappService, WahaPollingService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
