'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Conversation } from '@/types/conversation';
import { useChatStore } from '@/stores/chatStore';
import { useEffect } from 'react';

export function useConversations(status?: string) {
  const setConversations = useChatStore((s) => s.setConversations);

  const query = useQuery<Conversation[]>({
    queryKey: ['conversations', status],
    queryFn: async () => {
      const params = status ? { status } : {};
      const res = await apiClient.get('/conversations', { params });
      return res.data;
    },
    refetchInterval: 5000, // Refetch every 5s for real-time feel
  });

  useEffect(() => {
    if (query.data) {
      setConversations(query.data);
    }
  }, [query.data, setConversations]);

  return query;
}
