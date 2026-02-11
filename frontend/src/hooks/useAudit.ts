'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface AuditLogEntry {
  id: string;
  companyId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: any;
  timestamp: string;
  ipAddress: string | null;
  user: { id: string; name: string; email: string } | null;
}

export interface AuditResponse {
  items: AuditLogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function useAuditLogs(filters: {
  userId?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  cursor?: string;
}) {
  const params = new URLSearchParams();
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.action) params.set('action', filters.action);
  if (filters.entity) params.set('entity', filters.entity);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.cursor) params.set('cursor', filters.cursor);
  params.set('limit', '30');

  const queryString = params.toString();

  return useQuery<AuditResponse>({
    queryKey: ['audit', queryString],
    queryFn: async () => {
      const { data } = await apiClient.get(`/audit?${queryString}`);
      return data;
    },
  });
}
