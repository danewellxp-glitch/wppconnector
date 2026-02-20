'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AgentStatusBar } from '@/components/AgentStatusBar';

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-5 w-5 text-green-600" />
        <span className="font-semibold">Veloce Dashboard</span>
      </div>

      <div className="flex items-center gap-4">
        {(user as any)?.role === 'AGENT' && <AgentStatusBar />}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user?.name}</span>
          <Badge variant="secondary">{user?.role}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
