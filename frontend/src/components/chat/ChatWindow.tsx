'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useMessages } from '@/hooks/useMessages';
import { useSocket } from '@/hooks/useSocket';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Paperclip, ChevronUp, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { cleanPhone } from '@/lib/utils';

const EMPTY_MESSAGES: any[] = [];
const EMPTY_TYPING: Record<string, { userName: string }> = {};

export function ChatWindow() {
  const selectedId = useChatStore((s) => s.selectedConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const allMessages = useChatStore((s) => s.messages);
  const resetUnread = useChatStore((s) => s.resetUnread);
  const clearTyping = useChatStore((s) => s.clearTyping);
  const allTypingUsers = useChatStore((s) => s.typingUsers);
  const typingUsers = (selectedId && allTypingUsers[selectedId]) || EMPTY_TYPING;
  const messages = selectedId ? allMessages[selectedId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES;
  const { joinConversation, leaveConversation } = useSocket();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const hasMoreRef = useRef(false);
  const isLoadingMoreRef = useRef(false);

  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const conversation = conversations.find((c) => c.id === selectedId);

  const { hasMore, isLoadingMore, loadOlderMessages } = useMessages(selectedId);

  // Keep refs in sync so scroll handler has fresh values without stale closure
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { isLoadingMoreRef.current = isLoadingMore; }, [isLoadingMore]);

  const handleLoadOlder = useCallback(async () => {
    if (!scrollRef.current) return;
    prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    await loadOlderMessages();
  }, [loadOlderMessages]);

  // Join/leave conversation room
  useEffect(() => {
    if (!selectedId) return;
    joinConversation(selectedId);
    clearTyping(selectedId);
    isAtBottomRef.current = true;
    prevScrollHeightRef.current = 0;

    // Reset badge immediately and notify server
    resetUnread(selectedId);
    apiClient.post(`/conversations/${selectedId}/read`).catch(() => { });

    return () => {
      leaveConversation(selectedId);
    };
  }, [selectedId]);

  // Track scroll: bottom detection + auto-load older when near top
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (el.scrollTop < 80 && hasMoreRef.current && !isLoadingMoreRef.current) {
        prevScrollHeightRef.current = el.scrollHeight;
        loadOlderMessages();
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [loadOlderMessages]);

  // After older messages are prepended: restore scroll position so view doesn't jump
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || prevScrollHeightRef.current === 0) return;
    const delta = el.scrollHeight - prevScrollHeightRef.current;
    if (delta > 0) {
      el.scrollTop = delta;
      prevScrollHeightRef.current = 0;
    }
  }, [messages]);

  // Auto-scroll to bottom: on conversation switch (always) or new message (if at bottom)
  useEffect(() => {
    if (!scrollRef.current) return;
    if (isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-scroll when typing indicator appears
  const typingCount = Object.keys(typingUsers).length;
  useEffect(() => {
    if (typingCount > 0 && isAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [typingCount]);

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

  const typingNames = Object.values(typingUsers).map((u) => u.userName);

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
            {typingNames.length > 0 ? (
              <span className="text-xs text-green-600 font-medium animate-pulse">
                {typingNames.join(', ')} digitando...
              </span>
            ) : (
              <>
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {cleanPhone(conversation.customerPhone)}
                </span>
              </>
            )}
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
        {/* Load older messages controls */}
        {messages.length > 0 && (
          <div className="flex justify-center mb-3">
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white rounded-full px-3 py-1.5 shadow-sm border">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando mensagens anteriores...
              </div>
            ) : hasMore ? (
              <button
                onClick={handleLoadOlder}
                className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-full px-3 py-1.5 transition-colors"
              >
                <ChevronUp className="h-3 w-3" />
                Carregar mensagens anteriores
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground/50">Início da conversa</span>
            )}
          </div>
        )}

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
        {typingNames.length > 0 && <TypingBubble names={typingNames} />}
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

/** WhatsApp-style typing indicator bubble */
function TypingBubble({ names }: { names: string[] }) {
  const label = names.length === 1
    ? `${names[0]} digitando`
    : `${names.join(', ')} digitando`;

  return (
    <div className="flex items-end gap-2 mb-2">
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100 max-w-[240px]">
        <div className="flex items-center gap-3">
          {/* Animated dots */}
          <div className="flex gap-[5px] items-center">
            <span
              className="block w-[7px] h-[7px] rounded-full bg-green-500"
              style={{ animation: 'typingDot 1.4s infinite ease-in-out', animationDelay: '0s' }}
            />
            <span
              className="block w-[7px] h-[7px] rounded-full bg-green-500"
              style={{ animation: 'typingDot 1.4s infinite ease-in-out', animationDelay: '0.2s' }}
            />
            <span
              className="block w-[7px] h-[7px] rounded-full bg-green-500"
              style={{ animation: 'typingDot 1.4s infinite ease-in-out', animationDelay: '0.4s' }}
            />
          </div>
          <span className="text-xs text-gray-500 font-medium truncate">{label}</span>
        </div>
      </div>
    </div>
  );
}
