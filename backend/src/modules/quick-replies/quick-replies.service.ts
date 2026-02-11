import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';

@Injectable()
export class QuickRepliesService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.quickReply.findMany({
      where: { companyId, isActive: true },
      orderBy: { title: 'asc' },
    });
  }

  async create(companyId: string, dto: CreateQuickReplyDto) {
    return this.prisma.quickReply.create({
      data: {
        companyId,
        title: dto.title,
        content: dto.content,
        shortcut: dto.shortcut,
      },
    });
  }

  async update(id: string, dto: UpdateQuickReplyDto) {
    const existing = await this.prisma.quickReply.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Quick reply not found');

    return this.prisma.quickReply.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.quickReply.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Quick reply not found');

    return this.prisma.quickReply.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
