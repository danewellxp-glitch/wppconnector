'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Message, Direction, MessageType, MessageStatus } from '@/types/message';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { useEffect } from 'react';

export function useMessages(conversationId: string | null) {
  const setMessages = useChatStore((s) => s.setMessages);

  const query = useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const res = await apiClient.get(
        `/conversations/${conversationId}/messages`,
      );
      const list = res.data.reverse(); // API returns desc, we want asc
      // Deduplicate by id (e.g. when multiple clients load the same conversation)
      const seen = new Set<string>();
      return list.filter((m: Message) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    },
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (query.data && conversationId) {
      setMessages(conversationId, query.data);
    }
  }, [query.data, conversationId, setMessages]);

  return query;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const addMessage = useChatStore((s) => s.addMessage);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (data: {
      conversationId: string;
      content: string;
      type?: string;
    }) => {
      // Optimistic: show message immediately as PENDING
      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId: data.conversationId,
        direction: Direction.OUTBOUND,
        type: (data.type as MessageType) || MessageType.TEXT,
        content: data.content,
        status: MessageStatus.PENDING,
        sentAt: new Date().toISOString(),
        sentBy: user ? { id: user.id, name: user.name } : undefined,
      };
      addMessage(data.conversationId, optimisticMsg);

      const res = await apiClient.post('/messages/send', data);
      return { real: res.data as Message, optimisticId: optimisticMsg.id };
    },
    onSuccess: ({ real, optimisticId }) => {
      // Replace optimistic message with real one
      const messages = useChatStore.getState().messages;
      const convMessages = messages[real.conversationId] || [];
      const updated = convMessages
        .filter((m) => m.id !== optimisticId)
        .concat(real);
      useChatStore.getState().setMessages(real.conversationId, updated);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (_error, variables) => {
      // Mark optimistic message as failed
      const messages = useChatStore.getState().messages;
      const convMessages = messages[variables.conversationId] || [];
      const updated = convMessages.map((m) =>
        m.id.startsWith('optimistic-') ? { ...m, status: MessageStatus.FAILED } : m,
      );
      useChatStore.getState().setMessages(variables.conversationId, updated);
    },
  });
}

export function useSendMedia() {
  const queryClient = useQueryClient();
  const addMessage = useChatStore((s) => s.addMessage);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (data: {
      conversationId: string;
      file: File;
      caption?: string;
    }) => {
      const ext = data.file.name.split('.').pop()?.toLowerCase() || '';
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const audioExts = ['mp3', 'ogg', 'wav', 'webm'];
      let type = MessageType.DOCUMENT;
      if (imageExts.includes(ext)) type = MessageType.IMAGE;
      else if (audioExts.includes(ext)) type = MessageType.AUDIO;

      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId: data.conversationId,
        direction: Direction.OUTBOUND,
        type,
        content: data.caption || data.file.name,
        status: MessageStatus.PENDING,
        sentAt: new Date().toISOString(),
        sentBy: user ? { id: user.id, name: user.name } : undefined,
      };
      addMessage(data.conversationId, optimisticMsg);

      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('conversationId', data.conversationId);
      if (data.caption) formData.append('caption', data.caption);

      const res = await apiClient.post('/messages/send-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { real: res.data as Message, optimisticId: optimisticMsg.id };
    },
    onSuccess: ({ real, optimisticId }) => {
      const messages = useChatStore.getState().messages;
      const convMessages = messages[real.conversationId] || [];
      const updated = convMessages
        .filter((m) => m.id !== optimisticId)
        .concat(real);
      useChatStore.getState().setMessages(real.conversationId, updated);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (_error, variables) => {
      const messages = useChatStore.getState().messages;
      const convMessages = messages[variables.conversationId] || [];
      const updated = convMessages.map((m) =>
        m.id.startsWith('optimistic-') ? { ...m, status: MessageStatus.FAILED } : m,
      );
      useChatStore.getState().setMessages(variables.conversationId, updated);
    },
  });
}
