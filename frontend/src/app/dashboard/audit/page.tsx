'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAuditLogs } from '@/hooks/useAudit';
import { useUsers } from '@/hooks/useUsers';
import { Role } from '@/types/user';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ChevronRight, Shield } from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  register: 'Registro',
  create: 'Criar',
  update: 'Atualizar',
  delete: 'Excluir',
  assign: 'Atribuir',
  unassign: 'Desatribuir',
};

const ENTITY_LABELS: Record<string, string> = {
  auth: 'Autenticacao',
  user: 'Usuario',
  conversation: 'Conversa',
  message: 'Mensagem',
};

export default function AuditPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === Role.ADMIN;

  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    entity: '',
    startDate: '',
    endDate: '',
    cursor: '',
  });

  const { data: users } = useUsers();
  const { data: auditData, isLoading } = useAuditLogs({
    userId: filters.userId || undefined,
    action: filters.action || undefined,
    entity: filters.entity || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    cursor: filters.cursor || undefined,
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadMore = () => {
    if (auditData?.nextCursor) {
      setFilters((f) => ({ ...f, cursor: auditData.nextCursor! }));
    }
  };

  const resetFilters = () => {
    setFilters({
      userId: '',
      action: '',
      entity: '',
      startDate: '',
      endDate: '',
      cursor: '',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Audit Logs
        </h1>
        <p className="text-muted-foreground">
          Registro de todas as acoes realizadas no sistema
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Select
              value={filters.userId}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, userId: v === 'all' ? '' : v, cursor: '' }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.action}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, action: v === 'all' ? '' : v, cursor: '' }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Acao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="create">Criar</SelectItem>
                <SelectItem value="update">Atualizar</SelectItem>
                <SelectItem value="delete">Excluir</SelectItem>
                <SelectItem value="assign">Atribuir</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.entity}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, entity: v === 'all' ? '' : v, cursor: '' }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="auth">Autenticacao</SelectItem>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="conversation">Conversa</SelectItem>
                <SelectItem value="message">Mensagem</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters((f) => ({ ...f, startDate: e.target.value, cursor: '' }))
              }
              placeholder="Data inicio"
            />

            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, endDate: e.target.value, cursor: '' }))
                }
                placeholder="Data fim"
              />
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acao</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditData?.items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {formatDate(log.timestamp)}
                  </TableCell>
                  <TableCell>{log.user?.name || 'Sistema'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ENTITY_LABELS[log.entity] || log.entity}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.ipAddress || '-'}
                  </TableCell>
                </TableRow>
              ))}
              {(!auditData?.items || auditData.items.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {auditData?.hasMore && (
            <div className="flex justify-center p-4">
              <Button variant="outline" onClick={loadMore}>
                Carregar mais
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
