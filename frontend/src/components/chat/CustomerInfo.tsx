'use client';

import { useState, useRef, useEffect } from 'react';
import { Conversation, ConversationStatus } from '@/types/conversation';
import { cleanPhone } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Phone,
  UserCheck,
  UserX,
  CheckCircle,
  Archive,
  Clock,
  Pencil,
  ArrowRightLeft,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/lib/api-client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useChatStore } from '@/stores/chatStore';
import { ConversationNotes } from './ConversationNotes';

interface CustomerInfoProps {
  conversation: Conversation;
}

const statusLabels: Record<ConversationStatus, string> = {
  [ConversationStatus.OPEN]: 'Aberta',
  [ConversationStatus.ASSIGNED]: 'Atribuida',
  [ConversationStatus.RESOLVED]: 'Resolvida',
  [ConversationStatus.ARCHIVED]: 'Arquivada',
};

const statusColors: Record<ConversationStatus, string> = {
  [ConversationStatus.OPEN]: 'bg-yellow-100 text-yellow-800',
  [ConversationStatus.ASSIGNED]: 'bg-blue-100 text-blue-800',
  [ConversationStatus.RESOLVED]: 'bg-green-100 text-green-800',
  [ConversationStatus.ARCHIVED]: 'bg-gray-100 text-gray-800',
};

export function CustomerInfo({ conversation }: CustomerInfoProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const selectConversation = useChatStore((s) => s.selectConversation);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(
    conversation.customerName || '',
  );
  const [showTransfer, setShowTransfer] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch departments for transfer
  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await apiClient.get('/departments');
      return res.data;
    },
  });

  const assignedUser = conversation.assignments?.[0]?.user;
  const displayName = conversation.customerName || 'Sem nome';
  const initials = (conversation.customerName || cleanPhone(conversation.customerPhone))
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    setEditNameValue(conversation.customerName || '');
  }, [conversation.id, conversation.customerName]);

  useEffect(() => {
    if (isEditingName) inputRef.current?.focus();
  }, [isEditingName]);

  const handleAssignToMe = async () => {
    if (!user) return;
    try {
      await apiClient.post(`/conversations/${conversation.id}/assign`, {
        userId: user.id,
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa atribuida a voce');
    } catch {
      toast.error('Erro ao atribuir conversa');
    }
  };

  const handleUnassign = async () => {
    try {
      await apiClient.post(`/conversations/${conversation.id}/unassign`);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa desatribuida');
    } catch {
      toast.error('Erro ao desatribuir conversa');
    }
  };

  const handleResolve = async () => {
    if (!confirm('Finalizar atendimento? O cliente receberá uma mensagem de encerramento e o bot reiniciará na próxima mensagem.')) return;
    setIsResolving(true);
    try {
      await apiClient.post(`/conversations/${conversation.id}/resolve`, {
        sendMessage: true,
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      selectConversation(null);
      toast.success('Atendimento finalizado! Bot reiniciará na próxima mensagem do cliente.');
    } catch {
      toast.error('Erro ao finalizar atendimento');
    } finally {
      setIsResolving(false);
    }
  };

  const handleTransfer = async (departmentId: string, departmentName: string) => {
    if (!confirm(`Transferir conversa para o setor "${departmentName}"?`)) return;
    setIsTransferring(true);
    try {
      await apiClient.post(`/conversations/${conversation.id}/transfer`, {
        departmentId,
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setShowTransfer(false);
      selectConversation(null);
      toast.success(`Conversa transferida para ${departmentName}`);
    } catch {
      toast.error('Erro ao transferir conversa');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleUpdateStatus = async (status: ConversationStatus) => {
    try {
      await apiClient.patch(`/conversations/${conversation.id}/status`, {
        status,
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(`Status atualizado para ${statusLabels[status]}`);
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleSaveCustomerName = async () => {
    const trimmed = editNameValue.trim();
    setIsEditingName(false);
    if (trimmed === (conversation.customerName || '')) return;
    try {
      await apiClient.patch(`/conversations/${conversation.id}/customer-name`, {
        customerName: trimmed || null,
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Nome do cliente atualizado');
    } catch {
      toast.error('Erro ao atualizar nome');
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveCustomerName();
    if (e.key === 'Escape') {
      setEditNameValue(conversation.customerName || '');
      setIsEditingName(false);
    }
  };

  return (
    <div className="flex w-72 flex-col border-l bg-white overflow-y-auto">
      {/* Customer Header */}
      <div className="flex flex-col items-center p-6">
        <Avatar className="h-16 w-16 mb-3">
          <AvatarFallback className="bg-green-100 text-green-700 text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="w-full flex flex-col items-center gap-1">
          {isEditingName ? (
            <div className="flex items-center gap-1 w-full max-w-[200px]">
              <Input
                ref={inputRef}
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={handleSaveCustomerName}
                onKeyDown={handleNameKeyDown}
                className="h-8 text-sm text-center"
                placeholder="Nome do cliente"
                maxLength={200}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <h3 className="text-sm font-semibold text-center">
                {displayName}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-60 group-hover:opacity-100 transition-opacity"
                title="Alterar nome do cliente"
                aria-label="Alterar nome do cliente"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />
          {cleanPhone(conversation.customerPhone)}
        </div>
        <Badge className={`mt-2 ${statusColors[conversation.status as ConversationStatus]}`}>
          {statusLabels[conversation.status as ConversationStatus]}
        </Badge>
        {conversation.department && (
          <Badge variant="outline" className="mt-1 text-xs">
            {conversation.department.name}
          </Badge>
        )}
      </div>

      <Separator />

      {/* Assignment */}
      <div className="p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Atribuicao
        </h4>
        {assignedUser ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{assignedUser.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnassign}
              className="h-7 text-xs"
            >
              <UserX className="h-3 w-3 mr-1" />
              Remover
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAssignToMe}
            className="w-full text-xs"
          >
            <UserCheck className="h-3 w-3 mr-1" />
            Atribuir a mim
          </Button>
        )}
      </div>

      <Separator />

      {/* Transfer to Department */}
      <div className="p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Transferir Setor
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs justify-between"
          onClick={() => setShowTransfer(!showTransfer)}
          disabled={isTransferring}
          id="transfer-department-btn"
        >
          <span className="flex items-center gap-1">
            <ArrowRightLeft className="h-3 w-3" />
            Transferir para setor
          </span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showTransfer ? 'rotate-180' : ''}`} />
        </Button>
        {showTransfer && (
          <div className="mt-2 border rounded-md overflow-hidden shadow-sm">
            {departments.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">Nenhum setor disponível</p>
            ) : (
              departments
                .filter((d: any) => d.id !== conversation.departmentId && d.isActive !== false)
                .map((dept: any) => (
                  <button
                    key={dept.id}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors border-b last:border-b-0 flex items-center gap-2"
                    onClick={() => handleTransfer(dept.id, dept.name)}
                    disabled={isTransferring}
                  >
                    {dept.color && (
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dept.color }}
                      />
                    )}
                    {dept.name}
                  </button>
                ))
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="p-4 space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Acoes
        </h4>

        {/* Finalizar Atendimento — main action */}
        {conversation.status !== ConversationStatus.RESOLVED && (
          <Button
            variant="default"
            size="sm"
            className="w-full text-xs justify-start bg-green-600 hover:bg-green-700 text-white"
            onClick={handleResolve}
            disabled={isResolving}
            id="resolve-conversation-btn"
          >
            <CheckCircle className="h-3 w-3 mr-2" />
            {isResolving ? 'Finalizando...' : 'Finalizar Atendimento'}
          </Button>
        )}

        {conversation.status === ConversationStatus.RESOLVED && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs justify-start"
            onClick={() => handleUpdateStatus(ConversationStatus.OPEN)}
          >
            <Clock className="h-3 w-3 mr-2 text-yellow-500" />
            Reabrir conversa
          </Button>
        )}

        {conversation.status !== ConversationStatus.ARCHIVED && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs justify-start"
            onClick={() => handleUpdateStatus(ConversationStatus.ARCHIVED)}
          >
            <Archive className="h-3 w-3 mr-2 text-gray-500" />
            Arquivar
          </Button>
        )}
      </div>

      <Separator />

      {/* Internal Notes */}
      <ConversationNotes conversationId={conversation.id} />

      <Separator />

      {/* Info */}
      <div className="p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Informacoes
        </h4>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Mensagens nao lidas</span>
            <span className="font-medium text-foreground">
              {conversation.unreadCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Ultima mensagem</span>
            <span className="font-medium text-foreground">
              {new Date(conversation.lastMessageAt).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          {conversation.flowState && (
            <div className="flex justify-between">
              <span>Estado do bot</span>
              <span className="font-medium text-foreground text-right">
                {conversation.flowState}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
