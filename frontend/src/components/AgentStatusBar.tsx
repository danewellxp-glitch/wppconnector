'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Circle } from 'lucide-react';
import apiClient from '@/lib/api-client';

type Status = 'ONLINE' | 'BUSY' | 'OFFLINE';

const STATUS_OPTIONS: { value: Status; label: string; color: string }[] = [
  { value: 'ONLINE', label: 'Online', color: 'text-green-600' },
  { value: 'BUSY', label: 'Ocupado', color: 'text-amber-600' },
  { value: 'OFFLINE', label: 'Offline', color: 'text-gray-400' },
];

export function AgentStatusBar() {
  const user = useAuthStore((s) => s.user);
  const status = user?.onlineStatus ?? 'OFFLINE';

  useEffect(() => {
    // Instead of forcing ONLINE, we just ensure the socket knows our current status.
    const socket = getSocket();
    if (socket?.connected) {
      if (status === 'ONLINE') socket.emit('agent-online');
      else if (status === 'BUSY') socket.emit('agent-busy');
      else socket.emit('agent-offline');
    }
  }, [status]);

  const handleStatusChange = (value: Status) => {
    getSocket()?.emit(
      value === 'ONLINE' ? 'agent-online' : value === 'BUSY' ? 'agent-busy' : 'agent-offline',
    );
    apiClient
      .patch('/users/me/status', { status: value })
      .then((res) => {
        const updated = res.data;
        const { user: currentUser, token: t } = useAuthStore.getState();
        if (t && currentUser && updated) {
          useAuthStore.getState().setAuth({ ...currentUser, ...updated }, t);
        }
      })
      .catch(() => { });
  };

  const current = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[2];

  return (
    <Select value={status} onValueChange={(v) => handleStatusChange(v as Status)}>
      <SelectTrigger className="w-[130px] h-8">
        <div className="flex items-center gap-2">
          <Circle className={`h-2 w-2 fill-current ${current.color}`} />
          <SelectValue placeholder="Status" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="flex items-center gap-2">
              <Circle className={`h-2 w-2 fill-current ${opt.color}`} />
              {opt.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
