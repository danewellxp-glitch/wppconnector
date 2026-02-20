import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type Period = '1d' | '7d' | '30d' | '90d';

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  private getPeriodRange(period?: string): { start: Date; end: Date } {
    const end = new Date();
    const days: Record<Period, number> = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };
    const p = (period as Period) || '30d';
    const ms = (days[p] ?? 30) * 24 * 60 * 60 * 1000;
    return { start: new Date(end.getTime() - ms), end };
  }

  async getDashboard(companyId: string, period?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { start } = this.getPeriodRange(period);

    const [
      conversationsByStatus,
      messagesToday,
      totalConversations,
      totalMessages,
    ] = await Promise.all([
      this.prisma.conversation.groupBy({
        by: ['status'],
        where: { companyId, createdAt: { gte: start } },
        _count: { id: true },
      }),
      this.prisma.message.count({
        where: { companyId, sentAt: { gte: today } },
      }),
      this.prisma.conversation.count({
        where: { companyId, createdAt: { gte: start } },
      }),
      this.prisma.message.count({
        where: { companyId, sentAt: { gte: start } },
      }),
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

  async getConversationMetrics(companyId: string, period?: string) {
    const { start } = this.getPeriodRange(period);
    const halfPeriod = new Date(
      start.getTime() + (Date.now() - start.getTime()) / 2,
    );

    const [conversationsInPeriod, resolvedInPeriod] = await Promise.all([
      this.prisma.conversation.count({
        where: { companyId, createdAt: { gte: start } },
      }),
      this.prisma.conversation.count({
        where: {
          companyId,
          status: 'RESOLVED',
          updatedAt: { gte: start },
        },
      }),
    ]);

    // Average first response time using selected period
    const conversations = await this.prisma.conversation.findMany({
      where: { companyId, createdAt: { gte: start } },
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
      const firstInbound = conv.messages.find((m) => m.direction === 'INBOUND');
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

    // Keep legacy field names for frontend compatibility
    return {
      newConversationsLast7Days: conversationsInPeriod,
      newConversationsLast30Days: conversationsInPeriod,
      resolvedLast7Days: resolvedInPeriod,
      newConversationsInPeriod: conversationsInPeriod,
      resolvedInPeriod,
      avgFirstResponseTimeMs: avgResponseTimeMs,
      avgFirstResponseTimeFormatted: this.formatDuration(avgResponseTimeMs),
      halfPeriodStart: halfPeriod.toISOString(),
    };
  }

  async getAgentMetrics(companyId: string, period?: string) {
    const { start } = this.getPeriodRange(period);

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
