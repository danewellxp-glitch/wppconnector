import { Module, forwardRef } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationRoutingService } from './conversation-routing.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    forwardRef(() => WhatsappModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => WebsocketModule),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationRoutingService],
  exports: [ConversationsService, ConversationRoutingService],
})
export class ConversationsModule {}
