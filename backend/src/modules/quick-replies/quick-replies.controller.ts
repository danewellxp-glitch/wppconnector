import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { QuickRepliesService } from './quick-replies.service';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('quick-replies')
@UseGuards(JwtAuthGuard)
export class QuickRepliesController {
  constructor(private quickRepliesService: QuickRepliesService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.quickRepliesService.findAll(user.companyId);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateQuickReplyDto) {
    return this.quickRepliesService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuickReplyDto) {
    return this.quickRepliesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quickRepliesService.remove(id);
  }
}
