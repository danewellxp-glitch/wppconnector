'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { User, Department } from '@/types/user';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  user: User | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function ManageDepartmentsModal({ user, onClose, onUpdated }: Props) {
  const queryClient = useQueryClient();
  const [allDepts, setAllDepts] = useState<Department[]>([]);
  const [userDepts, setUserDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    Promise.all([
      apiClient.get('/departments'),
      apiClient.get(`/users/${user.id}/departments`),
    ])
      .then(([allRes, userRes]) => {
        setAllDepts(allRes.data);
        setUserDepts(userRes.data);
      })
      .catch(() => toast.error('Erro ao carregar setores'))
      .finally(() => setLoading(false));
  }, [user]);

  const isAssigned = (deptId: string) => userDepts.some((d) => d.id === deptId);

  const handleToggle = async (dept: Department) => {
    if (!user) return;
    setSaving(dept.id);
    try {
      if (isAssigned(dept.id)) {
        const res = await apiClient.delete(`/users/${user.id}/departments/${dept.id}`);
        setUserDepts(res.data);
        toast.success(`Setor "${dept.name}" removido`);
      } else {
        const res = await apiClient.post(`/users/${user.id}/departments/${dept.id}`);
        setUserDepts(res.data);
        toast.success(`Setor "${dept.name}" adicionado`);
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onUpdated();
    } catch {
      toast.error('Erro ao atualizar setor');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Setores — {user?.name}</DialogTitle>
          <DialogDescription>Adicione ou remova setores para este usuário.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {allDepts.map((dept) => {
              const assigned = isAssigned(dept.id);
              const isSaving = saving === dept.id;
              return (
                <div
                  key={dept.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dept.color || '#6366f1' }}
                    />
                    <span className="text-sm font-medium">{dept.name}</span>
                    {assigned && (
                      <Badge variant="secondary" className="text-xs">Ativo</Badge>
                    )}
                  </div>
                  <Button
                    variant={assigned ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => handleToggle(dept)}
                    disabled={!!saving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : assigned ? (
                      <X className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
