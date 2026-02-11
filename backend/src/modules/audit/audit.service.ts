import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateAuditLogDto {
  companyId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: any;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(dto: CreateAuditLogDto) {
    return this.prisma.auditLog.create({
      data: {
        companyId: dto.companyId,
        userId: dto.userId,
        action: dto.action,
        entity: dto.entity,
        entityId: dto.entityId,
        metadata: dto.metadata,
        ipAddress: dto.ipAddress,
      },
    });
  }

  async findAll(
    companyId: string,
    filters: {
      userId?: string;
      action?: string;
      entity?: string;
      startDate?: string;
      endDate?: string;
      cursor?: string;
      limit?: number;
    },
  ) {
    const limit = filters.limit || 50;

    const where: any = { companyId };
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entity) where.entity = filters.entity;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
      if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }

    const queryOptions: any = {
      where,
      orderBy: { timestamp: 'desc' },
      take: limit + 1,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    };

    if (filters.cursor) {
      queryOptions.cursor = { id: filters.cursor };
      queryOptions.skip = 1;
    }

    const results = await this.prisma.auditLog.findMany(queryOptions);
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}
