'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { useChatStore } from '@/stores/chatStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { cn, cleanPhone } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Plus, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NewContactModal } from './NewContactModal';
import { Conversation } from '@/types/conversation';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

import { toast } from 'sonner';

export function ContactsTableView() {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const router = useRouter();
    const selectConversation = useChatStore((s) => s.selectConversation);

    const { data: contacts, isLoading, refetch } = useQuery<Conversation[]>({
        queryKey: ['contacts', search],
        queryFn: async () => {
            const res = await apiClient.get('/conversations/contacts', {
                params: { q: search, take: 50 },
            });
            return res.data;
        },
    });

    const handleStartChat = (convId: string) => {
        selectConversation(convId);
        router.push('/dashboard');
    };

    const handleSyncContacts = async () => {
        setIsSyncing(true);
        toast.loading('Sincronizando contatos do celular...', { id: 'sync-contacts' });
        try {
            const res = await apiClient.post('/conversations/sync-contacts');
            toast.success(res.data?.message || 'Contatos sincronizados!', { id: 'sync-contacts' });
            refetch();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Erro interno do WAHA (Aguardar atualização da engine).';
            toast.error(`Falha: ${msg}`, { id: 'sync-contacts', duration: 5000 });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex h-full w-full flex-col bg-white">
            {/* Header */}
            <div className="border-b p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Contatos</h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            Gerencie e busque por contatos da sua empresa.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleSyncContacts} disabled={isSyncing}>
                            {/* We use an impromptu icon if RefreshCw is not imported, let's use lucide-react RefreshCw, but I'll add it to the import list */}
                            <svg className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                            {isSyncing ? 'Sincronizando...' : 'Sincronizar Celular'}
                        </Button>
                        <Button onClick={() => setIsModalOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Contato
                        </Button>
                    </div>
                </div>
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome ou número..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-gray-50/50"
                    />
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-auto p-6">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow>
                                <TableHead className="w-[300px]">Contato</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Setor</TableHead>
                                <TableHead>Atendente</TableHead>
                                <TableHead>Última Interação</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        Buscando contatos...
                                    </TableCell>
                                </TableRow>
                            ) : !contacts || contacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        Nenhum contato encontrado
                                    </TableCell>
                                </TableRow>
                            ) : (
                                contacts.map((conv) => {
                                    const rawPhone = conv.customerPhone;
                                    const cleanedPhone = cleanPhone(rawPhone);
                                    const displayName = conv.customerName || cleanedPhone;
                                    const initials = displayName.slice(0, 2).toUpperCase();

                                    return (
                                        <TableRow key={conv.id} className="hover:bg-gray-50/50 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                                                            {initials}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col max-w-[200px]">
                                                        <span className="font-medium truncate" title={displayName}>
                                                            {displayName}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground truncate" title={rawPhone}>
                                                            {rawPhone}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className={cn(
                                                        "font-normal text-xs",
                                                        conv.status === 'OPEN' && "bg-blue-100 text-blue-800 hover:bg-blue-100",
                                                        conv.status === 'ASSIGNED' && "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
                                                        conv.status === 'RESOLVED' && "bg-green-100 text-green-800 hover:bg-green-100"
                                                    )}
                                                >
                                                    {conv.status === 'OPEN' ? 'ABERTO' : conv.status === 'ASSIGNED' ? 'EM ATENDIMENTO' : 'RESOLVIDO'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {conv.department ? (
                                                    <DepartmentBadge department={conv.department} />
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">
                                                    {conv.assignedUser?.name || '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-muted-foreground whitespace-nowrap">
                                                    {formatDistanceToNow(new Date(conv.lastMessageAt || Date.now()), {
                                                        addSuffix: true,
                                                        locale: ptBR,
                                                    })}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                                    onClick={() => handleStartChat(conv.id)}
                                                >
                                                    <MessageSquare className="h-4 w-4 mr-2" />
                                                    Conversar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <NewContactModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreated={(newConv) => {
                    setIsModalOpen(false);
                    refetch();
                    if (newConv?.id) {
                        handleStartChat(newConv.id);
                    }
                }}
            />
        </div>
    );
}
