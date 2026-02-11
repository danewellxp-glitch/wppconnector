import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, status?: ConversationStatus) {
    return this.prisma.conversation.findMany({
      where: {
        companyId,
        ...(status && { status }),
      },
      include: {
        assignments: {
          where: { unassignedAt: null },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            direction: true,
            sentAt: true,
            type: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { unassignedAt: null },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa nao encontrada');
    }

    return conversation;
  }

  async getMessages(conversationId: string, take = 50, cursor?: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'desc' },
      take,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      include: {
        sentBy: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async assign(conversationId: string, userId: string) {
    // Unassign previous
    await this.prisma.assignment.updateMany({
      where: { conversationId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    // Create new assignment
    const assignment = await this.prisma.assignment.create({
      data: { conversationId, userId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Update conversation status
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'ASSIGNED' },
    });

    return assignment;
  }

  async unassign(conversationId: string) {
    await this.prisma.assignment.updateMany({
      where: { conversationId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'OPEN' },
    });

    return { message: 'Conversa desatribuida' };
  }

  async updateStatus(conversationId: string, status: ConversationStatus) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }

  async markAsRead(conversationId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }

  async updateCustomerName(
    conversationId: string,
    customerName: string | null,
  ) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { customerName: customerName || null },
    });
  }
}
