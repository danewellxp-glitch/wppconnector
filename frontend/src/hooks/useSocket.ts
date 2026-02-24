'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  onConnectionStatusChange,
  type ConnectionStatus,
} from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useNotificationStore } from '@/stores/notificationStore';

type SocketInstance = ReturnType<typeof connectSocket>;

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessageStatus = useChatStore((s) => s.updateMessageStatus);
  const incrementUnread = useChatStore((s) => s.incrementUnread);
  const selectedConversationId = useChatStore((s) => s.selectedConversationId);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const socketRef = useRef<SocketInstance | null>(null);
  const [socketInstance, setSocketInstance] = useState<SocketInstance | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);
    socketRef.current = socket;
    setSocketInstance(socket);

    // Escuta mudanças de status da conexão (conectado, reconectando, falhou)
    const unsubscribeStatus = onConnectionStatusChange((status) => {
      setConnectionStatus(status);
      if (status === 'failed') {
        toast.error('Conexão com o servidor perdida. Recarregue a página para reconectar.', {
          duration: Infinity,
          id: 'socket-connection-failed',
          action: {
            label: 'Recarregar',
            onClick: () => window.location.reload(),
          },
        });
      } else if (status === 'reconnecting') {
        toast.loading('Reconectando ao servidor...', {
          id: 'socket-reconnecting',
          duration: 4000,
        });
      } else if (status === 'connected') {
        toast.dismiss('socket-connection-failed');
        toast.dismiss('socket-reconnecting');
      }
    });

    socket.on('message-received', (data: { message: any; conversationId: string }) => {
      addMessage(data.conversationId, data.message);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (data.conversationId !== selectedConversationId) {
        incrementUnread(data.conversationId);
      }
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

    socket.on('conversation-assigned', () => {
      toast.info('Nova conversa atribuída a você!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    socket.on('conversation-queued', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    socket.on('conversation-transferred', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    // 🔔 Novo evento de conversa recebida no setor
    socket.on('new_conversation', (data: {
      conversationId: string;
      customerName: string;
      customerPhone: string;
      departmentName: string;
      timestamp: string;
    }) => {
      addNotification({
        type: 'new_conversation',
        title: '📞 Nova Conversa',
        message: `Conversa do cliente ${data.customerName} chegou no seu setor`,
        conversationId: data.conversationId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        departmentName: data.departmentName,
        autoDissmiss: true,
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    // 🔄 Novo evento de conversa transferida para o setor
    socket.on('conversation_transferred', (data: {
      conversationId: string;
      customerName: string;
      customerPhone: string;
      transferredBy: string;
      fromDepartmentName: string;
      toDepartmentName: string;
      timestamp: string;
    }) => {
      addNotification({
        type: 'conversation_transferred',
        title: '🔄 Conversa Transferida',
        message: `Conversa de ${data.customerName} foi transferida por ${data.transferredBy} do setor ${data.fromDepartmentName}`,
        conversationId: data.conversationId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        transferredBy: data.transferredBy,
        autoDissmiss: true,
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    return () => {
      unsubscribeStatus();
      socket.off('message-received');
      socket.off('message-sent');
      socket.off('message-status-updated');
      socket.off('conversation-assigned');
      socket.off('conversation-queued');
      socket.off('conversation-transferred');
      socket.off('new_conversation');
      socket.off('conversation_transferred');
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
    socket: socketInstance,
    connectionStatus,
    joinConversation,
    leaveConversation,
    emitTypingStart,
    emitTypingStop,
  };
}
