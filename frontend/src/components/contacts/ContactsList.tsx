'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useChatStore } from '@/stores/chatStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { cn, cleanPhone } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NewContactModal } from './NewContactModal';
// Import Conversation type or declare it structure.
import { Conversation } from '@/types/conversation';

export function ContactsList() {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const selectedId = useChatStore((s) => s.selectedConversationId);
    const selectConversation = useChatStore((s) => s.selectConversation);

    // also inject to conversation list so chat window can use it
    const setConversations = useChatStore((s) => s.setConversations);
    const currentConversations = useChatStore((s) => s.conversations);

    const { data: contacts, isLoading, refetch } = useQuery<Conversation[]>({
        queryKey: ['contacts', search],
        queryFn: async () => {
            const res = await apiClient.get('/conversations/contacts', {
                params: { q: search, take: 50 },
            });
            // We also update the chat store with fetched contacts to allow ChatWindow to see them
            const newMap = new Map(currentConversations.map(c => [c.id, c]));
            res.data.forEach((c: Conversation) => newMap.set(c.id, c));
            setConversations(Array.from(newMap.values()));
            return res.data;
        },
        // We can debounce the query implicitly or via hook in future, for now it searches on typing.
    });

    return (
        <div className="flex h-full w-80 flex-col border-r bg-white">
            {/* Header */}
            <div className="border-b p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">Contatos</h2>
                    <Button
                        size="sm"
                        onClick={() => setIsModalOpen(true)}
                        title="Novo Contato / Iniciar Conversa"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Novo
                    </Button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar contato..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* List */}
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        Buscando...
                    </div>
                ) : !contacts || contacts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        Nenhum contato encontrado
                    </div>
                ) : (
                    contacts.map((conv) => {
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
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="text-sm font-medium truncate">
                                            {conv.customerName || cleanPhone(conv.customerPhone)}
                                        </span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                            {formatDistanceToNow(new Date(conv.lastMessageAt || Date.now()), {
                                                addSuffix: true,
                                                locale: ptBR,
                                            })}
                                        </span>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                        {conv.department && (
                                            <DepartmentBadge department={conv.department} />
                                        )}
                                        <Badge variant="outline" className="text-[10px] h-5 px-1">{conv.status}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <p className="text-xs text-muted-foreground truncate">
                                            {lastMessage?.content || 'Sem mensagens'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </ScrollArea>

            <NewContactModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreated={() => {
                    setIsModalOpen(false);
                    refetch();
                }}
            />
        </div>
    );
}
