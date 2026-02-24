import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FlowState } from '@prisma/client';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.department.findMany({
      where: { companyId, isActive: true },
      include: {
        _count: {
          select: {
            users: true,
            conversations: {
              where: {
                flowState: { in: ['DEPARTMENT_SELECTED', 'ASSIGNED'] },
                status: 'OPEN',
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, companyId },
    });
    if (!dept) throw new NotFoundException('Departamento nao encontrado');
    return dept;
  }

  async getAgents(departmentId: string, companyId: string) {
    await this.findOne(departmentId, companyId);
    const users = await this.prisma.user.findMany({
      where: { departmentId, companyId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            assignedConversations: {
              where: {
                status: 'OPEN',
                flowState: { in: ['DEPARTMENT_SELECTED', 'ASSIGNED'] },
              },
            },
          },
        },
      },
    });
    return users.map((u) => {
      const { _count, ...rest } = u;
      return {
        ...rest,
        openConversationsCount: _count.assignedConversations,
      };
    });
  }

  async getQueue(departmentId: string, companyId: string) {
    await this.findOne(departmentId, companyId);
    return this.prisma.conversation.findMany({
      where: {
        departmentId,
        companyId,
        flowState: 'DEPARTMENT_SELECTED',
        status: 'OPEN',
      },
      include: {
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { id: true, content: true, direction: true, sentAt: true },
        },
      },
      orderBy: { routedAt: 'asc' },
    });
  }

  async create(
    companyId: string,
    data: {
      name: string;
      slug: string;
      description?: string;
      color?: string;
      isRoot?: boolean;
      responseTimeoutMinutes?: number;
      maxAgents?: number;
    },
  ) {
    return this.prisma.department.create({
      data: {
        companyId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        color: data.color ?? '#6366f1',
        isRoot: data.isRoot ?? false,
        responseTimeoutMinutes: data.responseTimeoutMinutes ?? 3,
        maxAgents: data.maxAgents ?? 10,
      },
    });
  }

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string | null;
      color: string;
      isRoot: boolean;
      isActive: boolean;
      responseTimeoutMinutes: number;
      maxAgents: number;
    }>,
  ) {
    await this.findOne(id, companyId);
    return this.prisma.department.update({
      where: { id },
      data,
    });
  }
}
