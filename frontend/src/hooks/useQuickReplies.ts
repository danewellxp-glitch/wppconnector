'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface QuickReply {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  isActive: boolean;
}

export function useQuickReplies() {
  return useQuery<QuickReply[]>({
    queryKey: ['quick-replies'],
    queryFn: async () => {
      const { data } = await apiClient.get('/quick-replies');
      return data;
    },
  });
}

export function useCreateQuickReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      title: string;
      content: string;
      shortcut?: string;
    }) => {
      const { data } = await apiClient.post('/quick-replies', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
    },
  });
}

export function useDeleteQuickReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/quick-replies/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
    },
  });
}
