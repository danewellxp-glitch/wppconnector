'use client';

import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessageStatus = useChatStore((s) => s.updateMessageStatus);
  const incrementUnread = useChatStore((s) => s.incrementUnread);
  const selectedConversationId = useChatStore((s) => s.selectedConversationId);
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);
    socketRef.current = socket;

    socket.on('message-received', (data: { message: any; conversationId: string }) => {
      addMessage(data.conversationId, data.message);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (data.conversationId !== selectedConversationId) {
        incrementUnread(data.conversationId);
      }
      // Browser notification when tab is not focused
      if (typeof document !== 'undefined' && document.hidden && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Nova mensagem', {
            body: data.message.content?.slice(0, 100) || 'Nova mensagem recebida',
            icon: '/favicon.ico',
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }
    });

    socket.on('message-sent', (message: any) => {
      addMessage(message.conversationId, message);
    });

    socket.on('message-status-updated', (data: { messageId: string; status: string }) => {
      updateMessageStatus(data.messageId, data.status);
    });

    return () => {
      socket.off('message-received');
      socket.off('message-sent');
      socket.off('message-status-updated');
      disconnectSocket();
    };
  }, [token]);

  const joinConversation = (conversationId: string) => {
    getSocket()?.emit('join-conversation', conversationId);
  };

  const leaveConversation = (conversationId: string) => {
    getSocket()?.emit('leave-conversation', conversationId);
  };

  const emitTypingStart = (conversationId: string) => {
    getSocket()?.emit('typing-start', conversationId);
  };

  const emitTypingStop = (conversationId: string) => {
    getSocket()?.emit('typing-stop', conversationId);
  };

  return {
    socket: socketRef.current,
    joinConversation,
    leaveConversation,
    emitTypingStart,
    emitTypingStop,
  };
}
