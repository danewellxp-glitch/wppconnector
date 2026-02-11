'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Role } from '@/types/user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Settings, Phone, Building, Key, Globe, PowerOff } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

export default function SettingsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === Role.ADMIN;
  const [shuttingDown, setShuttingDown] = useState(false);

  const handleShutdown = async () => {
    if (!confirm('Encerrar o servidor backend agora? O sistema deixará de responder até você iniciar o backend novamente.')) return;
    setShuttingDown(true);
    try {
      await apiClient.post('/system/shutdown');
      toast.success('Servidor encerrado.');
    } catch {
      toast.success('Comando enviado. O servidor está encerrando.');
    } finally {
      setShuttingDown(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Configuracoes
        </h1>
        <p className="text-muted-foreground">
          Configuracoes gerais do sistema
        </p>
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Seu perfil</Label>
              <div className="flex items-center gap-2">
                <span className="font-medium">{currentUser?.name}</span>
                <Badge variant={currentUser?.role === Role.ADMIN ? 'default' : 'secondary'}>
                  {currentUser?.role === Role.ADMIN ? 'Admin' : 'Atendente'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-500" />
            WhatsApp Business API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configuracoes da integracao com a Meta WhatsApp Business Cloud API.
            Estas variaveis sao configuradas no arquivo .env do servidor.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone Number ID</Label>
              <Input disabled value="Configurado no .env" />
            </div>
            <div className="space-y-2">
              <Label>Business Account ID</Label>
              <Input disabled value="Configurado no .env" />
            </div>
            <div className="space-y-2">
              <Label>Access Token</Label>
              <Input disabled type="password" value="************************" />
            </div>
            <div className="space-y-2">
              <Label>Webhook Verify Token</Label>
              <Input disabled type="password" value="************************" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            URL do webhook para configurar no Meta Developer Portal.
          </p>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/webhooks/whatsapp`}
            />
          </div>
          <div className="space-y-2">
            <Label>Campos obrigatorios</Label>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">messages</Badge>
              <Badge variant="secondary">message_deliveries</Badge>
              <Badge variant="secondary">message_reads</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-orange-500" />
            Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Backend</p>
              <p className="font-medium">NestJS 11</p>
            </div>
            <div>
              <p className="text-muted-foreground">Frontend</p>
              <p className="font-medium">Next.js 16</p>
            </div>
            <div>
              <p className="text-muted-foreground">Database</p>
              <p className="font-medium">PostgreSQL 15</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cache</p>
              <p className="font-medium">Redis 7</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shutdown */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <PowerOff className="h-5 w-5" />
            Encerrar aplicacao
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Encerra o servidor backend (Node). O frontend deixara de conectar ate voce iniciar o backend novamente.
          </p>
          <Button
            variant="destructive"
            onClick={handleShutdown}
            disabled={shuttingDown}
          >
            <PowerOff className="h-4 w-4 mr-2" />
            {shuttingDown ? 'Encerrando...' : 'Encerrar servidor'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
