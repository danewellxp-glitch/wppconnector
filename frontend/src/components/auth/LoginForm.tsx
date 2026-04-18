'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import Image from 'next/image';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { DepartmentSelectorModal } from './DepartmentSelectorModal';
import { Role } from '@/types/user';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [showDeptSelector, setShowDeptSelector] = useState(false);
  const [loginToken, setLoginToken] = useState<string>('');

  const { login } = useAuth();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);

      // If the agent provided a display name at login, persist it
      if (name && name.trim()) {
        try {
          await apiClient.patch('/users/me', { name: name.trim() });
          // Refresh local user object
          const me = await apiClient.get('/auth/me');
          setAuth(me.data, token || data.token);
        } catch (e) {
          // ignore patch errors (non-blocking)
          console.warn('Failed to update user name', e);
        }
      }

      // Show department selector for agents
      if (data.user?.role !== Role.ADMIN) {
        setLoginToken(data.token);
        setShowDeptSelector(true);
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-6 flex justify-center">
          <Image
            src="/Velocelogo.png"
            unoptimized
            alt="Veloce Logo"
            width={517}
            height={173}
            className="h-[138px] w-auto object-contain"
            priority
          />
        </div>
        <CardTitle className="text-2xl text-[#22184c]">Acesso ao Sistema</CardTitle>
        <p className="text-sm text-gray-500">
          Entre com suas credenciais para acessar o painel integrado
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Nome (como aparecerá no chat)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button type="submit" className="w-full bg-[#1893c8] hover:bg-[#147aa6] text-white transition-colors" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar na Plataforma'}
          </Button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(true)}
              className="text-xs text-gray-500 hover:text-[#1893c8] transition-colors"
            >
              Problemas com o acesso? / Esqueci minha senha
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-center text-muted-foreground mb-3">Ambiente de Demonstração</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {[
                { label: 'Admin', email: 'admin@simquimica.com.br' },
                { label: 'Laboratório', email: 'laboratorio@simquimica.com.br' },
                { label: 'Lab2', email: 'lab2@simquimica.com.br' },
                { label: 'Compras', email: 'administrativo@simquimica.com.br' },
                { label: 'Compras2', email: 'administrativo2@simquimica.com.br' },
                { label: 'Vendas', email: 'vendas@simquimica.com.br' },
                { label: 'Vendas2', email: 'vendas2@simquimica.com.br' },
                { label: 'Financeiro', email: 'financeiro@simquimica.com.br' },
                { label: 'Financeiro2', email: 'financeiro2@simquimica.com.br' },
              ].map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => { setEmail(u.email); setPassword('Sim@2024'); }}
                  className="text-xs border rounded-full px-3 py-1 hover:bg-gray-50 transition-colors text-gray-600"
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </CardContent>

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />

      <DepartmentSelectorModal
        open={showDeptSelector}
        token={loginToken}
        onSelected={() => {
          setShowDeptSelector(false);
          router.push('/dashboard');
        }}
      />
    </Card>
  );
}
