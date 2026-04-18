'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Message, Direction, MessageType, MessageStatus } from '@/types/message';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { useEffect, useState, useRef } from 'react';

function dedup(list: Message[]): Message[] {
  const seen = new Set<string>();
  return list.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function mergeSorted(base: Message[], extra: Message[]): Message[] {
  const ids = new Set(base.map((m) => m.id));
  return [...base, ...extra.filter((m) => !ids.has(m.id))].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );
}

export function useMessages(conversationId: string | null) {
  const setMessages = useChatStore((s) => s.setMessages);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  // Reset pagination state when conversation changes
  useEffect(() => {
    setCursor(null);
    setHasMore(false);
    setIsLoadingMore(false);
    loadingMoreRef.current = false;
  }, [conversationId]);

  const query = useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const res = await apiClient.get(`/conversations/${conversationId}/messages`);
      const { items, nextCursor, hasMore: more } = res.data;
      setCursor(nextCursor);
      setHasMore(more);
      return dedup([...items].reverse());
    },
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (query.data && conversationId) {
      const existing = useChatStore.getState().messages[conversationId] || [];
      setMessages(conversationId, mergeSorted(query.data, existing));
    }
  }, [query.data, conversationId, setMessages]);

  const loadOlderMessages = async () => {
    if (!conversationId || !cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const res = await apiClient.get(
        `/conversations/${conversationId}/messages?cursor=${cursor}`,
      );
      const { items, nextCursor, hasMore: more } = res.data;
      setCursor(nextCursor);
      setHasMore(more);
      const older = dedup([...items].reverse());
      const existing = useChatStore.getState().messages[conversationId] || [];
      // Prepend older messages, keeping newest socket messages at end
      const existingIds = new Set(existing.map((m) => m.id));
      const newOnes = older.filter((m) => !existingIds.has(m.id));
      setMessages(conversationId, [...newOnes, ...existing].sort(
        (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
      ));
    } finally {
      setIsLoadingMore(false);
      loadingMoreRef.current = false;
    }
  };

  return { ...query, hasMore, isLoadingMore, loadOlderMessages };
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
      // Bug 4: filter real.id too in case socket already delivered it
      const messages = useChatStore.getState().messages;
      const convMessages = messages[real.conversationId] || [];
      const updated = convMessages
        .filter((m) => m.id !== optimisticId && m.id !== real.id)
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
      // Bug 4: filter real.id too in case socket already delivered it
      const messages = useChatStore.getState().messages;
      const convMessages = messages[real.conversationId] || [];
      const updated = convMessages
        .filter((m) => m.id !== optimisticId && m.id !== real.id)
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
