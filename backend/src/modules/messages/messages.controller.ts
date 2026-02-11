import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post('send')
  send(@CurrentUser() user: any, @Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(user.id, user.companyId, dto, user.name);
  }

  @Get('search')
  search(
    @CurrentUser() user: any,
    @Query('q') query: string,
    @Query('conversationId') conversationId?: string,
  ) {
    return this.messagesService.search(user.companyId, query, conversationId);
  }
}
