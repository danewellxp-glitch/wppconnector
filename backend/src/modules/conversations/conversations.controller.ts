import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { ConversationsService } from './conversations.service';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateCustomerNameDto } from './dto/update-customer-name.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: ConversationStatus,
  ) {
    return this.conversationsService.findAll(user.companyId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conversationsService.findOne(id);
  }

  @Get(':id/messages')
  getMessages(
    @Param('id') id: string,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.conversationsService.getMessages(
      id,
      take ? parseInt(take, 10) : 50,
      cursor,
    );
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignConversationDto) {
    return this.conversationsService.assign(id, dto.userId);
  }

  @Post(':id/unassign')
  unassign(@Param('id') id: string) {
    return this.conversationsService.unassign(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.conversationsService.updateStatus(id, dto.status);
  }

  @Patch(':id/customer-name')
  updateCustomerName(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerNameDto,
  ) {
    return this.conversationsService.updateCustomerName(
      id,
      dto.customerName ?? null,
    );
  }

  @Post(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.conversationsService.markAsRead(id);
  }
}
