'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { Department } from '@/types/user';

interface Props {
  open: boolean;
  token: string;
  onSelected: () => void;
}

export function DepartmentSelectorModal({ open, token, onSelected }: Props) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    apiClient
      .get('/users/me/departments')
      .then((res) => {
        const depts: Department[] = res.data;
        setDepartments(depts);
        // Pre-select previously active departments, or all if none stored
        const prev = user.activeDepartmentIds ?? [];
        const validPrev = prev.filter((id) => depts.some((d) => d.id === id));
        if (validPrev.length > 0) {
          setSelected(new Set(validPrev));
        } else {
          // First login or no prior selection: pre-select all
          setSelected(new Set(depts.map((d) => d.id)));
        }
      })
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, [open, user]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const activeDepartmentIds = Array.from(selected);
      await apiClient.patch('/users/me', { activeDepartmentIds });
      const meRes = await apiClient.get('/auth/me');
      setAuth(meRes.data, token);
    } catch {
      // ignore
    } finally {
      setSaving(false);
      onSelected();
    }
  };

  const handleAll = async () => {
    setSaving(true);
    try {
      await apiClient.patch('/users/me', { activeDepartmentIds: [] });
      const meRes = await apiClient.get('/auth/me');
      setAuth(meRes.data, token);
    } catch {
      // ignore
    } finally {
      setSaving(false);
      onSelected();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Selecione seu(s) setor(es)</DialogTitle>
          <DialogDescription>
            Escolha em quais setores você quer receber mensagens nesta sessão. Pode selecionar mais de um.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {departments.map((dept) => {
              const isSelected = selected.has(dept.id);
              return (
                <button
                  key={dept.id}
                  onClick={() => toggle(dept.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors flex items-center gap-3 ${
                    isSelected
                      ? 'border-[#1893c8] bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span
                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dept.color || '#6366f1' }}
                  />
                  <span className="flex-1 font-medium text-sm">{dept.name}</span>
                  {isSelected && (
                    <Check className="h-4 w-4 text-[#1893c8] flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <Button variant="outline" onClick={handleAll} disabled={saving} className="text-sm">
            Todos os setores
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || selected.size === 0}
            className="bg-[#1893c8] hover:bg-[#147aa6] text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar ({selected.size})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
