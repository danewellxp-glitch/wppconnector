'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { NotificationContainer } from '@/components/NotificationContainer';
import { UnreadTitleManager } from '@/components/UnreadTitleManager';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);
  const token = useAuthStore((s) => s.token);

  // Initialize WebSocket connection
  useSocket();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token === null) {
      const timeout = setTimeout(() => {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!stored) {
          router.push('/login');
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [token, router]);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <NotificationContainer />
      <UnreadTitleManager />
    </div>
  );
}
