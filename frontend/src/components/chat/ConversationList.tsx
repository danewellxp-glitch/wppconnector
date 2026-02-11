'use client';

import { useChatStore } from '@/stores/chatStore';
import { useConversations } from '@/hooks/useConversations';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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

  const filtered = conversations.filter((c) => {
    const term = search.toLowerCase();
    const matchesSearch =
      cleanPhone(c.customerPhone).includes(term) ||
      c.customerName?.toLowerCase().includes(term);
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-full w-80 flex-col border-r bg-white">
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
      <ScrollArea className="flex-1">
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

                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">
                      {conv.customerName || cleanPhone(conv.customerPhone)}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground truncate">
                      {lastMessage?.content || 'Sem mensagens'}
                    </p>
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
