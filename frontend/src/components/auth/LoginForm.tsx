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

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        </form>
      </CardContent>
    </Card>
  );
}
