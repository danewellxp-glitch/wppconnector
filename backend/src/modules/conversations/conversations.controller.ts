import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { ConversationsService } from './conversations.service';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { TransferConversationDto } from './dto/transfer-conversation.dto';
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
    return this.conversationsService.findAll(user.companyId, status, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.conversationsService.findOne(id, user);
  }

  @Get(':id/messages')
  getMessages(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.conversationsService.getMessages(
      id,
      take ? parseInt(take, 10) : 50,
      cursor,
      user,
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

  @Post(':id/transfer')
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferConversationDto,
    @CurrentUser() user: any,
  ) {
    return this.conversationsService.transfer(
      id,
      dto.departmentId,
      dto.userId,
      user,
    );
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.conversationsService.updateStatus(id, dto.status);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() body: { sendMessage?: boolean }) {
    return this.conversationsService.resolve(id, body?.sendMessage !== false);
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

  // ===== Internal Notes =====

  @Get(':id/notes')
  getNotes(@Param('id') id: string) {
    return this.conversationsService.getNotes(id);
  }

  @Post(':id/notes')
  createNote(
    @Param('id') id: string,
    @Body('content') content: string,
    @CurrentUser() user: any,
  ) {
    return this.conversationsService.createNote(
      id,
      user.id,
      user.companyId,
      content,
    );
  }

  @Patch(':id/notes/:noteId')
  updateNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body('content') content: string,
    @CurrentUser() user: any,
  ) {
    return this.conversationsService.updateNote(
      noteId,
      content,
      user.id,
      user.role,
    );
  }

  @Delete(':id/notes/:noteId')
  deleteNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: any,
  ) {
    return this.conversationsService.deleteNote(noteId, user.id, user.role);
  }
}
