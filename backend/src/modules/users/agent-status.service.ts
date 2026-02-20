import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class AgentStatusService {
  private readonly logger = new Logger(AgentStatusService.name);

  constructor(
    private prisma: PrismaService,
    private moduleRef: ModuleRef,
  ) {}

  private getWebsocketGateway(): WebsocketGateway | null {
    try {
      return this.moduleRef.get(WebsocketGateway, { strict: false });
    } catch (error) {
      return null;
    }
  }

  async setStatus(userId: string, status: UserStatus) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { onlineStatus: status, lastHeartbeatAt: new Date() },
      include: { department: true },
    });
    if (user.departmentId) {
      const gateway = this.getWebsocketGateway();
      if (gateway) {
        gateway.emitToDepartment(user.departmentId, 'agent-status-changed', {
          userId,
          status,
          user: { id: user.id, name: user.name, email: user.email },
        });
      }
    }
    return user;
  }

  async getStatus(userId: string): Promise<UserStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onlineStatus: true },
    });
    return user?.onlineStatus ?? null;
  }

  async heartbeat(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastHeartbeatAt: new Date() },
    });
  }

  async checkAndMarkOffline() {
    const timeoutSeconds = 120; // 2 minutes
    const cutoff = new Date(Date.now() - timeoutSeconds * 1000);

    // Find agents that will be marked offline before updating
    const agentsToOffline = await this.prisma.user.findMany({
      where: {
        role: 'AGENT',
        onlineStatus: { in: ['ONLINE', 'BUSY'] },
        lastHeartbeatAt: { lt: cutoff },
      },
      select: { id: true },
    });

    if (agentsToOffline.length === 0) return;

    await this.prisma.user.updateMany({
      where: { id: { in: agentsToOffline.map((a) => a.id) } },
      data: { onlineStatus: 'OFFLINE' },
    });

    this.logger.log(
      `Marked ${agentsToOffline.length} agents as OFFLINE (heartbeat timeout)`,
    );

    // Release conversations assigned to agents that just went offline
    for (const agent of agentsToOffline) {
      const released = await this.prisma.conversation.updateMany({
        where: {
          assignedUserId: agent.id,
          status: { in: ['OPEN', 'ASSIGNED'] },
          flowState: { in: ['ASSIGNED', 'DEPARTMENT_SELECTED'] },
        },
        data: {
          assignedUserId: null,
          flowState: 'DEPARTMENT_SELECTED',
          status: 'OPEN',
        },
      });
      if (released.count > 0) {
        this.logger.log(
          `Released ${released.count} conversation(s) from offline agent ${agent.id}`,
        );
      }
    }
  }
}
