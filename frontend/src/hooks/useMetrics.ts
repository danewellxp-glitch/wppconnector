'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface DashboardMetrics {
  conversations: {
    total: number;
    OPEN: number;
    ASSIGNED: number;
    RESOLVED: number;
    ARCHIVED: number;
  };
  messages: {
    total: number;
    today: number;
    inboundToday: number;
    outboundToday: number;
  };
}

export interface ConversationMetrics {
  newConversationsLast7Days: number;
  newConversationsLast30Days: number;
  resolvedLast7Days: number;
  avgFirstResponseTimeMs: number;
  avgFirstResponseTimeFormatted: string;
}

export interface AgentMetric {
  id: string;
  name: string;
  activeConversations: number;
  totalAssignments: number;
  totalMessagesSent: number;
}

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['metrics', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get('/metrics/dashboard');
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useConversationMetrics() {
  return useQuery<ConversationMetrics>({
    queryKey: ['metrics', 'conversations'],
    queryFn: async () => {
      const { data } = await apiClient.get('/metrics/conversations');
      return data;
    },
    refetchInterval: 60000,
  });
}

export function useAgentMetrics() {
  return useQuery<AgentMetric[]>({
    queryKey: ['metrics', 'agents'],
    queryFn: async () => {
      const { data } = await apiClient.get('/metrics/agents');
      return data;
    },
    refetchInterval: 30000,
  });
}
