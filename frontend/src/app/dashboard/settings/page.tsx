'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Role } from '@/types/user';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Settings, Phone, Building, Key, Globe, PowerOff, Clock, Users } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

export default function SettingsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === Role.ADMIN;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    greetingMessage: '',
    autoAssignEnabled: true,
    businessHoursEnabled: false,
    businessHoursStart: '08:00',
    businessHoursEnd: '18:00',
    businessDays: '1,2,3,4,5',
    outOfOfficeMessage: '',
  });

  useEffect(() => {
    if (isAdmin) {
      loadSettings();
    }
  }, [isAdmin]);

  const loadSettings = async () => {
    try {
      const res = await apiClient.get('/settings');
      setSettings({
        greetingMessage: res.data.greetingMessage || '',
        autoAssignEnabled: res.data.autoAssignEnabled ?? true,
        businessHoursEnabled: res.data.businessHoursEnabled ?? false,
        businessHoursStart: res.data.businessHoursStart || '08:00',
        businessHoursEnd: res.data.businessHoursEnd || '18:00',
        businessDays: res.data.businessDays || '1,2,3,4,5',
        outOfOfficeMessage: res.data.outOfOfficeMessage || '',
      });
    } catch (error) {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/settings', settings);
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof typeof settings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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

      {/* Ticket Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            Distribuição de Atendimentos
          </CardTitle>
          <CardDescription>
            Controle de roleta automática (Round-Robin) para distribuir novos clientes para os atendentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Atribuição Automática</Label>
              <p className="text-sm text-muted-foreground">
                Se ativado, novas conversas serão entregues ao atendente com menos chats abertos.
                Se desativado, ficarão na fila esperando alguém aceitar manualmente.
              </p>
            </div>
            <Switch
              checked={settings.autoAssignEnabled}
              onCheckedChange={(c: boolean) => updateSetting('autoAssignEnabled', c)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Horário Comercial
          </CardTitle>
          <CardDescription>
            Ative para barrar mensagens fora do expediente com um recado automático.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Habilitar Horário Comercial</Label>
              <p className="text-sm text-muted-foreground">
                Controla se o robô filtra atendimentos por hora e dia da semana.
              </p>
            </div>
            <Switch
              checked={settings.businessHoursEnabled}
              onCheckedChange={(c: boolean) => updateSetting('businessHoursEnabled', c)}
            />
          </div>

          {settings.businessHoursEnabled && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-2 max-w-sm gap-4">
                <div className="space-y-2">
                  <Label>Abertura</Label>
                  <Input
                    type="time"
                    value={settings.businessHoursStart}
                    onChange={(e) => updateSetting('businessHoursStart', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fechamento</Label>
                  <Input
                    type="time"
                    value={settings.businessHoursEnd}
                    onChange={(e) => updateSetting('businessHoursEnd', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mensagem de Ausência (Out of Office)</Label>
                <Textarea
                  value={settings.outOfOfficeMessage}
                  onChange={(e) => updateSetting('outOfOfficeMessage', e.target.value)}
                  placeholder="Ex: Estamos fechados agora. Voltaremos segunda-feira."
                />
              </div>
            </div>
          )}
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

      {/* Action footer */}
      <div className="flex justify-end pt-4 pb-8">
        <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
          {saving ? 'Salvando...' : 'Salvar Alteracoes'}
        </Button>
      </div>
    </div>
  );
}
