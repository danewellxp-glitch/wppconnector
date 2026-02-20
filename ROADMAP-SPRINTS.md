# WPPConnector - Roadmap de Sprints

## Análise do Estado Atual

### O que já está implementado (MVP Funcional)
- Autenticação JWT com roles (ADMIN/AGENT)
- Gestão de conversas e mensagens
- Integração WhatsApp (WAHA + Meta)
- Roteamento inteligente por departamento
- WebSocket para tempo real
- Dashboard de métricas básico
- Sistema de quick replies
- Auditoria de ações
- Multi-tenant básico

### Gaps Identificados
- Falta de testes automatizados
- Sem integração com IA/LLM
- Métricas limitadas
- Sem sistema de tags/categorização
- Falta supervisão em tempo real
- Sem campanhas de mensagens
- Mobile não otimizado
- Falta integração com CRM

---

## Roadmap de Sprints

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VISÃO GERAL DO ROADMAP                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SPRINT 1-2: Estabilidade & Qualidade                                   │
│  ══════════════════════════════════                                     │
│  • Testes automatizados                                                 │
│  • Melhorias de UX                                                      │
│  • Bug fixes                                                            │
│                                                                         │
│  SPRINT 3-4: Produtividade do Agente                                    │
│  ═══════════════════════════════════                                    │
│  • Tags e categorização                                                 │
│  • Atalhos de teclado                                                   │
│  • Templates avançados                                                  │
│                                                                         │
│  SPRINT 5-6: Inteligência & Automação                                   │
│  ════════════════════════════════════                                   │
│  • Integração com IA (ChatGPT/Claude)                                   │
│  • Chatbot configurável                                                 │
│  • Respostas automáticas                                                │
│                                                                         │
│  SPRINT 7-8: Analytics & Supervisão                                     │
│  ═════════════════════════════════                                      │
│  • Dashboard avançado                                                   │
│  • Supervisão em tempo real                                             │
│  • Relatórios exportáveis                                               │
│                                                                         │
│  SPRINT 9-10: Escala & Integrações                                      │
│  ════════════════════════════════                                       │
│  • API pública                                                          │
│  • Webhooks customizados                                                │
│  • Integrações (CRM, Helpdesk)                                          │
│                                                                         │
│  SPRINT 11-12: Mobile & Campanhas                                       │
│  ════════════════════════════════                                       │
│  • App mobile (PWA/React Native)                                        │
│  • Campanhas de mensagens                                               │
│  • Broadcast lists                                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Sprint 1-2: Estabilidade & Qualidade

### Objetivo
Garantir que a base do sistema seja sólida antes de adicionar novas features.

### Sprint 1: Testes e Correções

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 1.1 | Implementar testes unitários para services críticos | Alta | 5 pts |
| 1.2 | Testes E2E para fluxos principais (login, chat, roteamento) | Alta | 8 pts |
| 1.3 | Configurar CI/CD com GitHub Actions | Alta | 3 pts |
| 1.4 | Corrigir edge cases no roteamento | Alta | 5 pts |
| 1.5 | Melhorar tratamento de erros e logs | Média | 3 pts |
| 1.6 | Implementar retry logic para WhatsApp API | Média | 3 pts |

**Entregáveis:**
- Cobertura de testes > 60% nos services críticos
- Pipeline CI/CD funcionando
- Zero bugs críticos conhecidos

### Sprint 2: UX e Performance

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 2.1 | Otimizar carregamento de conversas (virtualização) | Alta | 5 pts |
| 2.2 | Implementar skeleton loaders | Média | 2 pts |
| 2.3 | Melhorar feedback visual (estados de loading, erros) | Média | 3 pts |
| 2.4 | Notificações desktop (browser notifications) | Alta | 3 pts |
| 2.5 | Sons de notificação configuráveis | Baixa | 2 pts |
| 2.6 | Melhorar responsividade mobile | Alta | 5 pts |
| 2.7 | Adicionar dark mode completo | Baixa | 3 pts |

**Entregáveis:**
- Tempo de carregamento < 2s
- Interface responsiva em tablets
- Notificações funcionando

---

## Sprint 3-4: Produtividade do Agente

### Objetivo
Aumentar a eficiência dos agentes no atendimento diário.

### Sprint 3: Tags e Organização

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 3.1 | Sistema de tags para conversas | Alta | 8 pts |
| 3.2 | Filtros avançados (por tag, data, agente) | Alta | 5 pts |
| 3.3 | Busca global em mensagens | Alta | 5 pts |
| 3.4 | Favoritar conversas | Média | 2 pts |
| 3.5 | Histórico de cliente (todas conversas anteriores) | Alta | 5 pts |
| 3.6 | Ficha do cliente editável (campos customizados) | Média | 5 pts |

**Schema para Tags:**
```prisma
model Tag {
  id        String   @id @default(uuid())
  name      String
  color     String
  companyId String
  
  conversations ConversationTag[]
}

model ConversationTag {
  conversationId String
  tagId          String
  
  @@id([conversationId, tagId])
}
```

### Sprint 4: Templates e Atalhos

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 4.1 | Quick replies com categorias | Alta | 5 pts |
| 4.2 | Variáveis em templates ({{nome}}, {{departamento}}) | Alta | 5 pts |
| 4.3 | Atalhos de teclado (Ctrl+Enter enviar, Esc fechar) | Média | 3 pts |
| 4.4 | Comando /slash para ações rápidas | Média | 5 pts |
| 4.5 | Snippets de código para templates | Baixa | 3 pts |
| 4.6 | Preview de mídia antes de enviar | Alta | 3 pts |

**Exemplo de variáveis:**
```typescript
// Template: "Olá {{nome}}, bem-vindo ao {{departamento}}!"
// Resultado: "Olá João, bem-vindo ao Suporte!"

const processTemplate = (template: string, context: Record<string, string>) => {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
};
```

---

## Sprint 5-6: Inteligência & Automação

### Objetivo
Implementar IA para auxiliar agentes e automatizar tarefas repetitivas.

### Sprint 5: Integração com LLM

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 5.1 | Integração com OpenAI/Claude API | Alta | 8 pts |
| 5.2 | Sugestão de respostas baseada em contexto | Alta | 8 pts |
| 5.3 | Resumo automático de conversas longas | Média | 5 pts |
| 5.4 | Classificação automática de intenção | Alta | 5 pts |
| 5.5 | Tradução automática de mensagens | Baixa | 3 pts |
| 5.6 | Análise de sentimento em tempo real | Média | 5 pts |

**Arquitetura proposta:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mensagem      │────▶│   AI Service    │────▶│   OpenAI API    │
│   Recebida      │     │                 │     │   /Claude API   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Sugestões para  │
                        │    o agente     │
                        └─────────────────┘
```

**Novo módulo:**
```typescript
// backend/src/modules/ai/ai.service.ts
@Injectable()
export class AIService {
  async suggestResponse(conversationId: string): Promise<string[]> {
    const messages = await this.getConversationContext(conversationId);
    const prompt = this.buildPrompt(messages);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt }
      ]
    });
    
    return this.parseResponseSuggestions(response);
  }
  
  async classifyIntent(message: string): Promise<IntentClassification> {
    // Classifica: VENDAS, SUPORTE, RECLAMAÇÃO, DÚVIDA, etc.
  }
  
  async analyzeSentiment(message: string): Promise<SentimentAnalysis> {
    // Retorna: POSITIVO, NEUTRO, NEGATIVO + score
  }
}
```

### Sprint 6: Chatbot Configurável

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 6.1 | Editor visual de fluxos de chatbot | Alta | 13 pts |
| 6.2 | Condições e ramificações no fluxo | Alta | 8 pts |
| 6.3 | Integração do chatbot com IA | Alta | 8 pts |
| 6.4 | Horário de funcionamento por departamento | Média | 3 pts |
| 6.5 | Mensagens de ausência configuráveis | Média | 3 pts |
| 6.6 | Coleta de dados estruturada (nome, email, etc) | Alta | 5 pts |

**Schema para Chatbot:**
```prisma
model ChatbotFlow {
  id          String   @id @default(uuid())
  name        String
  isActive    Boolean  @default(true)
  companyId   String
  
  nodes       ChatbotNode[]
  edges       ChatbotEdge[]
}

model ChatbotNode {
  id       String @id @default(uuid())
  flowId   String
  type     NodeType // MESSAGE, CONDITION, ACTION, INPUT, AI_RESPONSE
  data     Json
  position Json // { x, y }
}

model ChatbotEdge {
  id         String @id @default(uuid())
  flowId     String
  sourceId   String
  targetId   String
  condition  String?
}

enum NodeType {
  MESSAGE
  CONDITION
  ACTION
  INPUT
  AI_RESPONSE
  DEPARTMENT_ROUTE
  WAIT
}
```

---

## Sprint 7-8: Analytics & Supervisão

### Objetivo
Fornecer visibilidade completa para gestores e supervisores.

### Sprint 7: Dashboard Avançado

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 7.1 | Gráficos de tendência (conversas por dia/hora) | Alta | 5 pts |
| 7.2 | Métricas por departamento | Alta | 5 pts |
| 7.3 | Ranking de agentes | Média | 3 pts |
| 7.4 | Tempo médio de primeira resposta | Alta | 3 pts |
| 7.5 | Tempo médio de resolução | Alta | 3 pts |
| 7.6 | Taxa de resolução no primeiro contato | Alta | 3 pts |
| 7.7 | NPS/CSAT após atendimento | Alta | 5 pts |

**Métricas a implementar:**
```typescript
interface DashboardMetrics {
  // Volume
  totalConversations: number;
  conversationsByStatus: Record<Status, number>;
  conversationsByDepartment: Record<string, number>;
  conversationsByHour: number[]; // 24 posições
  
  // Performance
  avgFirstResponseTime: number; // segundos
  avgResolutionTime: number; // segundos
  firstContactResolutionRate: number; // percentual
  
  // Agentes
  agentMetrics: {
    agentId: string;
    name: string;
    conversationsHandled: number;
    avgResponseTime: number;
    avgResolutionTime: number;
    satisfaction: number;
  }[];
  
  // Satisfação
  csat: {
    average: number;
    total: number;
    distribution: Record<1|2|3|4|5, number>;
  };
}
```

### Sprint 8: Supervisão em Tempo Real

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 8.1 | Painel de supervisão (todas conversas ativas) | Alta | 8 pts |
| 8.2 | Visualizar conversa de qualquer agente | Alta | 5 pts |
| 8.3 | Intervir em conversa (assumir/auxiliar) | Alta | 5 pts |
| 8.4 | Alertas de SLA (tempo de espera, sem resposta) | Alta | 5 pts |
| 8.5 | Whisper mode (mensagem só para agente) | Média | 5 pts |
| 8.6 | Exportar relatórios (PDF, Excel) | Média | 5 pts |

**Nova página de supervisão:**
```
┌─────────────────────────────────────────────────────────────────┐
│ PAINEL DE SUPERVISÃO                               [Exportar]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Na Fila: 5   │  │ Atendendo:12 │  │ Alertas: 2   │          │
│  │ ⚠ +3 SLA     │  │ ✓ Normal     │  │ 🔴 Crítico   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ AGENTES ONLINE                                            │ │
│  ├───────────┬────────────┬──────────┬─────────┬────────────┤ │
│  │ Agente    │ Status     │ Conversas│ Tempo   │ Ação       │ │
│  ├───────────┼────────────┼──────────┼─────────┼────────────┤ │
│  │ João      │ 🟢 Online  │ 4        │ 2:30    │ [Ver]      │ │
│  │ Maria     │ 🟡 Busy    │ 6        │ 5:00    │ [Ver]      │ │
│  │ Pedro     │ 🔴 Alerta  │ 3        │ 10:00   │ [Intervir] │ │
│  └───────────┴────────────┴──────────┴─────────┴────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ALERTAS                                                    │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ 🔴 Conversa #123 sem resposta há 10min - João             │ │
│  │ 🟡 Fila do Suporte com 5 conversas - Nenhum agente        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sprint 9-10: Escala & Integrações

### Objetivo
Preparar o sistema para integrações externas e uso em escala.

### Sprint 9: API Pública

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 9.1 | Documentação OpenAPI/Swagger | Alta | 5 pts |
| 9.2 | Sistema de API Keys | Alta | 5 pts |
| 9.3 | Rate limiting por API key | Alta | 3 pts |
| 9.4 | Webhooks customizados (eventos) | Alta | 8 pts |
| 9.5 | SDK JavaScript para integrações | Média | 5 pts |
| 9.6 | Sandbox/ambiente de testes | Média | 5 pts |

**Webhooks disponíveis:**
```typescript
enum WebhookEvent {
  CONVERSATION_CREATED = 'conversation.created',
  CONVERSATION_ASSIGNED = 'conversation.assigned',
  CONVERSATION_RESOLVED = 'conversation.resolved',
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',
  AGENT_STATUS_CHANGED = 'agent.status_changed',
}

// Exemplo de payload
{
  "event": "conversation.created",
  "timestamp": "2026-02-20T10:30:00Z",
  "data": {
    "conversationId": "uuid",
    "customerPhone": "+5511999999999",
    "customerName": "João",
    "departmentId": "uuid"
  }
}
```

### Sprint 10: Integrações

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 10.1 | Integração com HubSpot CRM | Alta | 8 pts |
| 10.2 | Integração com Pipedrive | Média | 8 pts |
| 10.3 | Integração com Zendesk | Média | 8 pts |
| 10.4 | Integração com Slack (notificações) | Baixa | 5 pts |
| 10.5 | Zapier/Make connector | Alta | 8 pts |
| 10.6 | Import/Export de contatos | Média | 5 pts |

**Arquitetura de integrações:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  WPPConnector   │────▶│  Integration    │────▶│   HubSpot       │
│    Events       │     │    Service      │     │   Pipedrive     │
└─────────────────┘     └────────┬────────┘     │   Zendesk       │
                                 │              └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Webhook       │
                        │   Dispatcher    │
                        └─────────────────┘
```

---

## Sprint 11-12: Mobile & Campanhas

### Objetivo
Expandir o alcance do sistema com app mobile e funcionalidades de marketing.

### Sprint 11: Aplicativo Mobile

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 11.1 | PWA com funcionalidades offline básicas | Alta | 8 pts |
| 11.2 | Push notifications mobile | Alta | 5 pts |
| 11.3 | Interface otimizada para touch | Alta | 8 pts |
| 11.4 | Quick actions na notificação | Média | 5 pts |
| 11.5 | React Native app (iOS + Android) | Baixa | 21 pts |
| 11.6 | Biometria para login | Baixa | 3 pts |

**PWA manifest:**
```json
{
  "name": "WPPConnector",
  "short_name": "WPPConnect",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#075E54",
  "theme_color": "#25D366",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Sprint 12: Campanhas de Mensagens

| ID | Task | Prioridade | Esforço |
|----|------|------------|---------|
| 12.1 | Listas de broadcast | Alta | 8 pts |
| 12.2 | Agendamento de mensagens | Alta | 5 pts |
| 12.3 | Templates de campanha (HSM) | Alta | 5 pts |
| 12.4 | Segmentação de contatos | Alta | 8 pts |
| 12.5 | Métricas de campanha (entrega, leitura) | Alta | 5 pts |
| 12.6 | A/B testing de mensagens | Baixa | 8 pts |

**Schema para Campanhas:**
```prisma
model Campaign {
  id          String         @id @default(uuid())
  name        String
  status      CampaignStatus @default(DRAFT)
  templateId  String
  scheduledAt DateTime?
  sentAt      DateTime?
  companyId   String
  
  recipients  CampaignRecipient[]
  metrics     CampaignMetrics?
}

model CampaignRecipient {
  id         String          @id @default(uuid())
  campaignId String
  phone      String
  status     RecipientStatus @default(PENDING)
  sentAt     DateTime?
  deliveredAt DateTime?
  readAt     DateTime?
  error      String?
}

model CampaignMetrics {
  id           String @id @default(uuid())
  campaignId   String @unique
  totalSent    Int    @default(0)
  delivered    Int    @default(0)
  read         Int    @default(0)
  failed       Int    @default(0)
  optOut       Int    @default(0)
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  SENDING
  COMPLETED
  CANCELLED
}
```

---

## Priorização Geral

### Must Have (Sprints 1-4)
- Testes automatizados
- CI/CD
- UX improvements
- Tags e filtros
- Templates avançados

### Should Have (Sprints 5-8)
- Integração com IA
- Chatbot configurável
- Dashboard avançado
- Supervisão em tempo real

### Nice to Have (Sprints 9-12)
- API pública
- Integrações CRM
- App mobile
- Campanhas

---

## Métricas de Sucesso

| Sprint | Métrica | Meta |
|--------|---------|------|
| 1-2 | Cobertura de testes | > 60% |
| 1-2 | Tempo de carregamento | < 2s |
| 3-4 | Tempo médio de resposta do agente | -20% |
| 5-6 | Conversas resolvidas por IA | > 30% |
| 7-8 | Taxa de SLA cumprido | > 95% |
| 9-10 | Integrações ativas | > 3 |
| 11-12 | Usuários mobile | > 40% |

---

## Estimativa de Recursos

| Sprint | Story Points | Dev Backend | Dev Frontend |
|--------|--------------|-------------|--------------|
| 1 | 27 pts | 1 | 0.5 |
| 2 | 23 pts | 0.5 | 1 |
| 3 | 30 pts | 1 | 1 |
| 4 | 24 pts | 0.5 | 1 |
| 5 | 34 pts | 1.5 | 0.5 |
| 6 | 40 pts | 1 | 1 |
| 7 | 27 pts | 1 | 1 |
| 8 | 33 pts | 1 | 1 |
| 9 | 31 pts | 1.5 | 0.5 |
| 10 | 42 pts | 1.5 | 0.5 |
| 11 | 50 pts | 0.5 | 2 |
| 12 | 39 pts | 1 | 1 |

**Total estimado:** 400 story points

---

## Quick Wins (Pode começar agora)

Estas são implementações de alto impacto e baixo esforço:

1. **Notificações desktop** (2-3 pts)
   - Browser Notification API
   - Som configurável

2. **Atalhos de teclado** (3 pts)
   - Enter = enviar
   - Esc = fechar painel
   - Ctrl+K = busca rápida

3. **Skeleton loaders** (2 pts)
   - Melhor percepção de velocidade

4. **Favoritar conversas** (2 pts)
   - Pin no topo da lista

5. **Preview de mídia** (3 pts)
   - Visualizar antes de enviar

---

## Próximos Passos Recomendados

1. **Imediato:** Implementar CI/CD e testes básicos
2. **Curto prazo:** Melhorar UX e adicionar tags
3. **Médio prazo:** Integrar IA para sugestões
4. **Longo prazo:** API pública e integrações

---

*Documento criado em: 20/02/2026*
*Revisão sugerida: Mensal*
