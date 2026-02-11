import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      conversationsByStatus,
      messagesToday,
      totalConversations,
      totalMessages,
    ] = await Promise.all([
      this.prisma.conversation.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.message.count({
        where: { companyId, sentAt: { gte: today } },
      }),
      this.prisma.conversation.count({ where: { companyId } }),
      this.prisma.message.count({ where: { companyId } }),
    ]);

    const statusCounts = {
      OPEN: 0,
      ASSIGNED: 0,
      RESOLVED: 0,
      ARCHIVED: 0,
    };
    for (const row of conversationsByStatus) {
      statusCounts[row.status] = row._count.id;
    }

    const [messagesInToday, messagesOutToday] = await Promise.all([
      this.prisma.message.count({
        where: { companyId, sentAt: { gte: today }, direction: 'INBOUND' },
      }),
      this.prisma.message.count({
        where: { companyId, sentAt: { gte: today }, direction: 'OUTBOUND' },
      }),
    ]);

    return {
      conversations: {
        total: totalConversations,
        ...statusCounts,
      },
      messages: {
        total: totalMessages,
        today: messagesToday,
        inboundToday: messagesInToday,
        outboundToday: messagesOutToday,
      },
    };
  }

  async getConversationMetrics(companyId: string) {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [conversationsLast7, conversationsLast30, resolvedLast7] =
      await Promise.all([
        this.prisma.conversation.count({
          where: { companyId, createdAt: { gte: last7Days } },
        }),
        this.prisma.conversation.count({
          where: { companyId, createdAt: { gte: last30Days } },
        }),
        this.prisma.conversation.count({
          where: {
            companyId,
            status: 'RESOLVED',
            updatedAt: { gte: last7Days },
          },
        }),
      ]);

    // Average first response time: time between first inbound msg and first outbound msg per conversation
    const conversations = await this.prisma.conversation.findMany({
      where: { companyId, createdAt: { gte: last30Days } },
      select: {
        id: true,
        messages: {
          select: { direction: true, sentAt: true },
          orderBy: { sentAt: 'asc' },
          take: 20,
        },
      },
    });

    let totalResponseTime = 0;
    let responseCount = 0;

    for (const conv of conversations) {
      const firstInbound = conv.messages.find(
        (m) => m.direction === 'INBOUND',
      );
      const firstOutbound = conv.messages.find(
        (m) => m.direction === 'OUTBOUND',
      );
      if (firstInbound && firstOutbound) {
        const diff =
          firstOutbound.sentAt.getTime() - firstInbound.sentAt.getTime();
        if (diff > 0) {
          totalResponseTime += diff;
          responseCount++;
        }
      }
    }

    const avgResponseTimeMs =
      responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;

    return {
      newConversationsLast7Days: conversationsLast7,
      newConversationsLast30Days: conversationsLast30,
      resolvedLast7Days: resolvedLast7,
      avgFirstResponseTimeMs: avgResponseTimeMs,
      avgFirstResponseTimeFormatted: this.formatDuration(avgResponseTimeMs),
    };
  }

  async getAgentMetrics(companyId: string) {
    const agents = await this.prisma.user.findMany({
      where: { companyId, role: 'AGENT', isActive: true },
      select: {
        id: true,
        name: true,
        assignments: {
          where: { unassignedAt: null },
          select: { conversationId: true },
        },
        _count: {
          select: { sentMessages: true, assignments: true },
        },
      },
    });

    return agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      activeConversations: agent.assignments.length,
      totalAssignments: agent._count.assignments,
      totalMessagesSent: agent._count.sentMessages,
    }));
  }

  private formatDuration(ms: number): string {
    if (ms === 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
