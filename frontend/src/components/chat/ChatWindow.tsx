'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useMessages } from '@/hooks/useMessages';
import { useSocket } from '@/hooks/useSocket';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Paperclip } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { cleanPhone } from '@/lib/utils';

const EMPTY_MESSAGES: any[] = [];

export function ChatWindow() {
  const selectedId = useChatStore((s) => s.selectedConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const allMessages = useChatStore((s) => s.messages);
  const resetUnread = useChatStore((s) => s.resetUnread);
  const messages = selectedId ? allMessages[selectedId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES;
  const { joinConversation, leaveConversation } = useSocket();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const conversation = conversations.find((c) => c.id === selectedId);

  useMessages(selectedId);

  // Typing indicator listener
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTyping = (data: {
      userId: string;
      conversationId: string;
      isTyping: boolean;
    }) => {
      if (data.conversationId !== selectedId) return;
      setTypingUsers((prev) => {
        if (data.isTyping) {
          return { ...prev, [data.userId]: data.userId };
        }
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
    };

    socket.on('user-typing', handleTyping);
    return () => {
      socket.off('user-typing', handleTyping);
    };
  }, [selectedId]);

  // Join/leave conversation room
  useEffect(() => {
    if (!selectedId) return;
    joinConversation(selectedId);
    setTypingUsers({});
    isAtBottomRef.current = true;

    // Reset badge immediately and notify server
    resetUnread(selectedId);
    apiClient.post(`/conversations/${selectedId}/read`).catch(() => { });

    return () => {
      leaveConversation(selectedId);
    };
  }, [selectedId]);

  // Track if user is near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll: always on conversation switch, only if at bottom on new messages
  useEffect(() => {
    if (!scrollRef.current) return;
    if (isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setDroppedFile(e.dataTransfer.files[0]);
    }
  };

  if (!selectedId || !conversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg">Selecione uma conversa</p>
          <p className="text-sm mt-1">
            Escolha uma conversa na lista ao lado para comecar
          </p>
        </div>
      </div>
    );
  }

  const initials = (conversation.customerName || cleanPhone(conversation.customerPhone))
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex flex-1 flex-col bg-gray-50 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-green-100/90 border-4 border-dashed border-green-500 backdrop-blur-sm m-4 rounded-lg pointer-events-none transition-all">
          <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center gap-3">
            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
              <Paperclip className="h-8 w-8" />
            </div>
            <p className="text-gray-900 font-semibold text-xl">
              Solte o arquivo para enviar
            </p>
            <p className="text-gray-500 text-sm">
              Anexe documentos, imagens ou planilhas a esta conversa.
            </p>
          </div>
        </div>
      )}
      {/* Chat Header */}
      <div className="flex items-center gap-3 border-b bg-white px-6 py-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-green-100 text-green-700">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">
            {conversation.customerName || cleanPhone(conversation.customerPhone)}
          </h3>
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {cleanPhone(conversation.customerPhone)}
            </span>
          </div>
        </div>
        <Badge
          variant={
            conversation.status === 'OPEN'
              ? 'default'
              : conversation.status === 'ASSIGNED'
                ? 'secondary'
                : 'outline'
          }
        >
          {conversation.status}
        </Badge>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda
          </div>
        ) : (
          messages.map((msg, index) => (
            <MessageBubble
              key={`${msg.id}-${index}`}
              message={msg}
              departmentName={conversation.department?.name}
            />
          ))
        )}
        {Object.keys(typingUsers).length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <span className="flex gap-1">
              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
            </span>
            digitando
          </div>
        )}
      </div>

      {/* Input */}
      {conversation.status === 'RESOLVED' || conversation.status === 'ARCHIVED' ? (
        <div className="flex flex-col items-center justify-center p-6 bg-gray-100 border-t">
          <p className="text-gray-500 mb-3 text-sm">Esta conversa foi finalizada.</p>
          <Button
            onClick={async () => {
              try {
                await apiClient.post(`/conversations/${selectedId}/start`);
                // socket will handle state update, or we can just fetch
              } catch (err) {
                console.error('Failed to restart chat', err);
              }
            }}
          >
            Iniciar Novo Atendimento
          </Button>
        </div>
      ) : (
        <MessageInput
          conversationId={selectedId}
          droppedFile={droppedFile}
          onClearDroppedFile={() => setDroppedFile(null)}
        />
      )}
    </div>
  );
}
