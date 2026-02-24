import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WebhookController } from './webhook.controller';
import { WahaWebhookController } from './waha-webhook.controller';
import { WahaFilesController } from './waha-files.controller';
import { WahaPollingService } from './waha-polling.service';
import { FlowEngineService } from './flow-engine.service';
import { MessagesModule } from '../messages/messages.module';
import { DepartmentsModule } from '../departments/departments.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [
    forwardRef(() => MessagesModule),
    forwardRef(() => DepartmentsModule),
    forwardRef(() => ConversationsModule),
  ],
  controllers: [WebhookController, WahaWebhookController, WahaFilesController],
  providers: [WhatsappService, WahaPollingService, FlowEngineService],
  exports: [WhatsappService, FlowEngineService],
})
export class WhatsappModule {}
