'use client';

import { useState } from 'react';
import {
  useDashboardMetrics,
  useConversationMetrics,
  useAgentMetrics,
  type MetricsPeriod,
} from '@/hooks/useMetrics';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  MessagesSquare,
  Clock,
  CheckCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Loader2,
  Inbox,
  Archive,
} from 'lucide-react';

const PERIODS: { value: MetricsPeriod; label: string }[] = [
  { value: '1d', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

export default function MetricsPage() {
  const [period, setPeriod] = useState<MetricsPeriod>('30d');
  const user = useAuthStore((s) => s.user);

  const { data: dashboard, isLoading: loadingDashboard } = useDashboardMetrics(period);
  const { data: convMetrics, isLoading: loadingConv } = useConversationMetrics(period);
  // Only fetch agent metrics if user is admin
  const { data: agents, isLoading: loadingAgents } = useAgentMetrics(period);

  const isLoading = loadingDashboard || loadingConv || (user?.role === 'ADMIN' && loadingAgents);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-[#E8F5E9]">
        <Loader2 className="h-6 w-6 animate-spin text-[#25D366]" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#E8F5E9]">
      {/* WhatsApp-style header strip */}
      <div className="bg-[#075E54] text-white px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Metricas</h1>
            <p className="text-[#A8DAB5] text-sm mt-0.5">Visao geral do atendimento</p>
          </div>
          {/* Period selector */}
          <div className="flex gap-1 bg-[#054D45] rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p.value
                    ? 'bg-white text-[#075E54]'
                    : 'text-white hover:bg-[#075E54]'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Conversation Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Abertas"
            value={dashboard?.conversations.OPEN ?? 0}
            icon={<Inbox className="h-4 w-4 text-[#34B7F1]" />}
            description="Aguardando atendimento"
          />
          <MetricCard
            title="Em Atendimento"
            value={dashboard?.conversations.ASSIGNED ?? 0}
            icon={<MessageSquare className="h-4 w-4 text-[#FFC107]" />}
            description="Atribuidas a atendentes"
          />
          <MetricCard
            title="Resolvidas"
            value={dashboard?.conversations.RESOLVED ?? 0}
            icon={<CheckCircle className="h-4 w-4 text-[#25D366]" />}
            description="Conversas finalizadas"
          />
          <MetricCard
            title="Arquivadas"
            value={dashboard?.conversations.ARCHIVED ?? 0}
            icon={<Archive className="h-4 w-4 text-[#667781]" />}
            description="Conversas arquivadas"
          />
        </div>

        {/* Messages Today + Response Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-l-4 border-l-[#25D366] bg-white shadow-sm border border-[#D1F4E0]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#075E54]">Volume de Mensagens (Hoje)</CardTitle>
              <MessagesSquare className="h-4 w-4 text-[#128C7E]" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mt-2">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-[#075E54]">
                    {dashboard?.messages.inboundToday ?? 0}
                  </span>
                  <span className="text-xs text-[#667781] flex items-center gap-1">
                    <ArrowDownLeft className="h-3 w-3 text-[#34B7F1]" /> Recebidas
                  </span>
                </div>
                <div className="h-8 w-px bg-gray-200"></div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-[#075E54]">
                    {dashboard?.messages.outboundToday ?? 0}
                  </span>
                  <span className="text-xs text-[#667781] flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-[#25D366]" /> Enviadas
                  </span>
                </div>
                <div className="h-8 w-px bg-gray-200"></div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-[#075E54]">
                    {dashboard?.messages.today ?? 0}
                  </span>
                  <span className="text-xs text-[#667781]">Total Hoje</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <MetricCard
            title="Tempo Medio 1a Resposta"
            value={convMetrics?.avgFirstResponseTimeFormatted ?? '0s'}
            icon={<Clock className="h-4 w-4 text-[#128C7E]" />}
            description={`Periodo: ${PERIODS.find((p) => p.value === period)?.label ?? period}`}
            isText
          />
        </div>

        {/* Conversation Trends */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title={`Novas (${PERIODS.find((p) => p.value === period)?.label ?? period})`}
            value={convMetrics?.newConversationsInPeriod ?? convMetrics?.newConversationsLast7Days ?? 0}
            icon={<MessageSquare className="h-4 w-4 text-[#34B7F1]" />}
            description={`Conversas criadas no periodo selecionado`}
          />
          <MetricCard
            title={`Total do Periodo`}
            value={dashboard?.conversations.total ?? 0}
            icon={<MessageSquare className="h-4 w-4 text-[#128C7E]" />}
            description={`Todas as conversas no periodo`}
          />
          <MetricCard
            title={`Resolvidas (${PERIODS.find((p) => p.value === period)?.label ?? period})`}
            value={convMetrics?.resolvedInPeriod ?? convMetrics?.resolvedLast7Days ?? 0}
            icon={<CheckCircle className="h-4 w-4 text-[#25D366]" />}
            description={`Finalizadas no periodo selecionado`}
          />
        </div>

        {/* Agent Performance Table - ADMIN ONLY */}
        {user?.role === 'ADMIN' && (
          <Card className="border border-[#D1F4E0] bg-white shadow-sm">
            <CardHeader className="border-b border-[#E8F5E9] bg-[#F0F9F4]">
              <CardTitle className="flex items-center gap-2 text-[#075E54]">
                <Users className="h-5 w-5 text-[#25D366]" />
                Performance dos Atendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agents && agents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#E8F5E9] hover:bg-[#F0F9F4]">
                      <TableHead className="text-[#075E54]">Atendente</TableHead>
                      <TableHead className="text-center text-[#075E54]">Conversas Ativas</TableHead>
                      <TableHead className="text-center text-[#075E54]">Total Atribuicoes</TableHead>
                      <TableHead className="text-center text-[#075E54]">Mensagens Enviadas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id} className="border-[#E8F5E9] hover:bg-[#F0F9F4]">
                        <TableCell className="font-medium text-[#3B4A54]">{agent.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              agent.activeConversations > 0
                                ? 'bg-[#25D366] hover:bg-[#128C7E] text-white'
                                : 'bg-[#E8F5E9] text-[#075E54]'
                            }
                          >
                            {agent.activeConversations}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-[#3B4A54]">{agent.totalAssignments}</TableCell>
                        <TableCell className="text-center text-[#3B4A54]">{agent.totalMessagesSent}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-[#667781]">
                  Nenhum atendente ativo encontrado
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  description,
  isText,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description: string;
  isText?: boolean;
}) {
  return (
    <Card className="border-l-4 border-l-[#25D366] bg-white shadow-sm hover:shadow-md transition-shadow border border-[#D1F4E0]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[#075E54]">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold text-[#075E54] ${isText ? '' : ''}`}>
          {value}
        </div>
        <p className="text-xs text-[#667781] mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
