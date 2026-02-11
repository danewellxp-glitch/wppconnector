'use client';

import { cn } from '@/lib/utils';
import { MessageSquare, BarChart3, Users, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', icon: MessageSquare, label: 'Conversas' },
  { href: '/dashboard/metrics', icon: BarChart3, label: 'Metricas' },
  { href: '/dashboard/users', icon: Users, label: 'Usuarios' },
  { href: '/dashboard/audit', icon: Shield, label: 'Auditoria' },
  { href: '/dashboard/settings', icon: Settings, label: 'Configuracoes' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-16 flex-col items-center border-r bg-white py-4">
      {navItems.map((item) => {
        const isActive =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'mb-2 flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              isActive
                ? 'bg-green-100 text-green-700'
                : 'text-muted-foreground hover:bg-gray-100',
            )}
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
          </Link>
        );
      })}
    </aside>
  );
}
