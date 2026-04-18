'use client';

import { useChatStore } from '@/stores/chatStore';
import { useConversations } from '@/hooks/useConversations';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { cn, cleanPhone } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';


const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'OPEN', label: 'Abertas' },
  { value: 'ASSIGNED', label: 'Em atendimento' },
  { value: 'OFFLINE_QUEUE', label: 'Fila / Aguardando' },
  { value: 'RESOLVED', label: 'Resolvidas' },
  { value: 'ARCHIVED', label: 'Arquivadas' },
] as const;

export function ConversationList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const { isLoading } = useConversations();
  const conversations = useChatStore((s) => s.conversations);
  const selectedId = useChatStore((s) => s.selectedConversationId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const typingUsers = useChatStore((s) => s.typingUsers);

  const filtered = conversations.filter((c) => {
    // Never show contacts synced from phone that never sent a message
    if (!c.lastMessageAt) return false;

    const term = search.toLowerCase();
    const matchesSearch =
      cleanPhone(c.customerPhone).includes(term) ||
      c.customerName?.toLowerCase().includes(term);

    let matchesStatus = true;
    if (statusFilter === 'OFFLINE_QUEUE') {
      matchesStatus = c.status === 'OPEN' && !c.assignedUser && !c.assignedUserId;
    } else if (statusFilter === 'OPEN') {
      matchesStatus = c.status === 'OPEN' && (!c.departmentId || c.flowState !== 'DEPARTMENT_SELECTED');
    } else if (statusFilter) {
      matchesStatus = c.status === statusFilter;
    } else {
      matchesStatus = true;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-full w-[480px] flex-col border-r bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Conversas</h2>
          <Button
            variant={showFilters ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-1 mt-3">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={statusFilter === f.value ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada
          </div>
        ) : (
          filtered.map((conv) => {
            const lastMessage = conv.messages?.[0];
            const initials = (conv.customerName || cleanPhone(conv.customerPhone))
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={cn(
                  'flex cursor-pointer items-start gap-3 border-b p-4 transition-colors hover:bg-gray-50',
                  selectedId === conv.id && 'bg-green-50',
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate min-w-0">
                      {conv.customerName || cleanPhone(conv.customerPhone)}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {conv.department && (
                      <DepartmentBadge department={conv.department} />
                    )}
                    {conv.status === 'RESOLVED' && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1 bg-gray-200 text-gray-700">Resolvido</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    {(() => {
                      const convTyping = typingUsers[conv.id] || {};
                      const typingNames = Object.values(convTyping).map((u) => u.userName);
                      if (typingNames.length > 0) {
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className="flex gap-[3px] items-center">
                              <span className="block w-[5px] h-[5px] rounded-full bg-green-500" style={{ animation: 'typingDot 1.4s infinite ease-in-out', animationDelay: '0s' }} />
                              <span className="block w-[5px] h-[5px] rounded-full bg-green-500" style={{ animation: 'typingDot 1.4s infinite ease-in-out', animationDelay: '0.2s' }} />
                              <span className="block w-[5px] h-[5px] rounded-full bg-green-500" style={{ animation: 'typingDot 1.4s infinite ease-in-out', animationDelay: '0.4s' }} />
                            </span>
                            <span className="text-xs text-green-600 font-medium truncate">
                              {typingNames.length === 1 ? `${typingNames[0]} digitando...` : 'digitando...'}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <p className="text-xs text-muted-foreground truncate">
                          {lastMessage
                            ? (lastMessage.content || (lastMessage.type === 'IMAGE' ? '📷 Imagem' : lastMessage.type === 'AUDIO' ? '🎵 Áudio' : lastMessage.type === 'VIDEO' ? '🎥 Vídeo' : lastMessage.type === 'DOCUMENT' ? '📄 Documento' : '—'))
                            : '—'}
                        </p>
                      );
                    })()}
                    {conv.unreadCount > 0 && (
                      <Badge className="ml-2 bg-green-500 text-white text-xs min-w-[20px] justify-center">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
}
