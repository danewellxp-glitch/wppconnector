'use client';

import {
  useDashboardMetrics,
  useConversationMetrics,
  useAgentMetrics,
} from '@/hooks/useMetrics';
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

export default function MetricsPage() {
  const { data: dashboard, isLoading: loadingDashboard } = useDashboardMetrics();
  const { data: convMetrics, isLoading: loadingConv } = useConversationMetrics();
  const { data: agents, isLoading: loadingAgents } = useAgentMetrics();

  const isLoading = loadingDashboard || loadingConv || loadingAgents;

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
        <h1 className="text-2xl font-bold">Metricas</h1>
        <p className="text-[#A8DAB5] text-sm mt-0.5">Visao geral do atendimento</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Mensagens Hoje"
            value={dashboard?.messages.today ?? 0}
            icon={<MessagesSquare className="h-4 w-4 text-[#128C7E]" />}
            description={`Total: ${dashboard?.messages.total ?? 0}`}
          />
          <Card className="border-l-4 border-l-[#25D366] bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#075E54]">Hoje por Direcao</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4 text-[#34B7F1]" />
                  <span className="text-2xl font-bold text-[#075E54]">
                    {dashboard?.messages.inboundToday ?? 0}
                  </span>
                  <span className="text-xs text-[#667781]">recebidas</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-[#25D366]" />
                  <span className="text-2xl font-bold text-[#075E54]">
                    {dashboard?.messages.outboundToday ?? 0}
                  </span>
                  <span className="text-xs text-[#667781]">enviadas</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <MetricCard
            title="Tempo Medio 1a Resposta"
            value={convMetrics?.avgFirstResponseTimeFormatted ?? '0s'}
            icon={<Clock className="h-4 w-4 text-[#128C7E]" />}
            description="Ultimos 30 dias"
            isText
          />
        </div>

        {/* Conversation Trends */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Novas (7 dias)"
            value={convMetrics?.newConversationsLast7Days ?? 0}
            icon={<MessageSquare className="h-4 w-4 text-[#34B7F1]" />}
            description="Conversas criadas nos ultimos 7 dias"
          />
          <MetricCard
            title="Novas (30 dias)"
            value={convMetrics?.newConversationsLast30Days ?? 0}
            icon={<MessageSquare className="h-4 w-4 text-[#128C7E]" />}
            description="Conversas criadas nos ultimos 30 dias"
          />
          <MetricCard
            title="Resolvidas (7 dias)"
            value={convMetrics?.resolvedLast7Days ?? 0}
            icon={<CheckCircle className="h-4 w-4 text-[#25D366]" />}
            description="Finalizadas nos ultimos 7 dias"
          />
        </div>

        {/* Agent Performance Table */}
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
