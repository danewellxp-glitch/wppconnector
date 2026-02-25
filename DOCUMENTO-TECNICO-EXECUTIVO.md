# WPPConnector — Documento Técnico-Executivo

> **Versão:** 1.0 · **Data:** Fevereiro 2026 · **Confidencial**

---

## Sumário

1. [Visão Executiva](#1-visão-executiva)
2. [Problema e Solução](#2-problema-e-solução)
3. [Funcionalidades Principais](#3-funcionalidades-principais)
4. [Arquitetura do Sistema](#4-arquitetura-do-sistema)
5. [Stack Tecnológica](#5-stack-tecnológica)
6. [Modelo de Dados](#6-modelo-de-dados)
7. [Fluxos de Negócio](#7-fluxos-de-negócio)
8. [Integrações](#8-integrações)
9. [Segurança e Controle de Acesso](#9-segurança-e-controle-de-acesso)
10. [Infraestrutura e Deploy](#10-infraestrutura-e-deploy)
11. [Métricas e Auditoria](#11-métricas-e-auditoria)
12. [Roadmap e Evolução](#12-roadmap-e-evolução)

---

## 1. Visão Executiva

O **WPPConnector** é uma plataforma de atendimento ao cliente via WhatsApp desenvolvida para operações empresariais que exigem roteamento inteligente de conversas, gestão de múltiplos departamentos e comunicação em tempo real entre agentes.

### O que o sistema entrega

| Benefício | Descrição |
|-----------|-----------|
| **Centralização** | Todos os atendimentos do WhatsApp em uma única interface |
| **Roteamento automático** | Clientes direcionados ao departamento correto sem intervenção humana |
| **Produtividade** | Agentes trabalham em fila organizada com visibilidade de carga |
| **Histórico** | Todo o histórico de conversas e mensagens persistido |
| **Rastreabilidade** | Log completo de todas as ações dos usuários |
| **Tempo real** | Mensagens, notificações e status de entrega instantâneos |

### Contexto de uso atual

O sistema está configurado para a **SIM Estearina**, atendendo quatro departamentos operacionais — **Laboratório**, **Comercial**, **Financeiro** e **Administrativo** — com um menu interativo de seleção enviado automaticamente a cada novo cliente que entra em contato via WhatsApp.

---

## 2. Problema e Solução

### O problema

Empresas que recebem alto volume de mensagens no WhatsApp enfrentam:

- **Falta de organização:** mensagens misturadas sem triagem por área
- **Perda de contexto:** cliente precisa repetir informações em cada contato
- **Sem visibilidade:** gestores não sabem a carga de trabalho por agente
- **Atendimento lento:** sem fila, conversas se perdem ou ficam sem resposta

### A solução

O WPPConnector resolve esses problemas com três pilares:

1. **Menu automático de roteamento** — ao receber a primeira mensagem, o sistema responde com um menu interativo e encaminha o cliente ao departamento selecionado sem necessidade de intervenção humana.

2. **Fila organizada por departamento** — cada departamento possui sua própria fila de atendimento, com visibilidade de quem está aguardando e há quanto tempo.

3. **Roteamento inteligente para clientes recorrentes** — clientes que já foram atendidos anteriormente são reconhecidos e o sistema sugere automaticamente o último departamento/agente que os atendeu.

---

## 3. Funcionalidades Principais

### Para agentes

- **Dashboard de conversas** em tempo real com lista filtrável por status e departamento
- **Janela de chat** com histórico completo, suporte a texto, imagem, áudio, vídeo e documentos
- **Respostas rápidas** — atalhos pré-configurados para mensagens frequentes
- **Notas internas** — anotações visíveis apenas para a equipe, não enviadas ao cliente
- **Transferência de conversa** para outro departamento com notificação automática
- **Indicador de digitação** em tempo real entre agentes e clientes

### Para gestores (ADMIN)

- **Gestão de usuários** — criação, ativação/desativação, atribuição de departamentos
- **Métricas de atendimento** — tempo médio de resposta, volume de conversas, carga por agente
- **Fila de cada departamento** — visibilidade total de conversas pendentes
- **Log de auditoria** — histórico de todas as ações realizadas no sistema
- **Reset de senha** — aprovação de solicitações de redefinição de senha de agentes

### Para o sistema (automático)

- **Menu de boas-vindas** enviado automaticamente na primeira mensagem
- **Timeout de atendimento** — escalada automática quando o departamento não responde dentro do prazo configurado
- **Reconhecimento de cliente recorrente** — sugestão do departamento anterior
- **Atualização de status de mensagem** — entregue, lida, com falha

---

## 4. Arquitetura do Sistema

### Visão geral

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENTES WHATSAPP                        │
└─────────────────────────────┬────────────────────────────────────┘
                              │ mensagens
                   ┌──────────▼──────────┐
                   │   WAHA (Dev)        │   ou   Meta Cloud API (Prod)
                   │   Porta 3101        │         graph.facebook.com
                   └──────────┬──────────┘
                              │ webhook / polling
┌─────────────────────────────▼────────────────────────────────────┐
│                    BACKEND — NestJS (Porta 4000)                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Auth Module │  │  Conv Module │  │  WhatsApp Module     │   │
│  │  JWT/Passport│  │  Roteamento  │  │  FlowEngine + Webhook│   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Dept Module │  │  Msg Module  │  │  WebSocket Gateway   │   │
│  │  Fila/Agentes│  │  Envio/Mídia │  │  Socket.IO           │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Notif Module│  │ Audit Module │  │  Metrics Module      │   │
│  │  Alertas RT  │  │  Rastreab.   │  │  Analytics           │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│              ┌──────────────┬─────────────────┐                 │
│              │  PostgreSQL  │      Redis       │                 │
│              │  Porta 5434  │   Porta 6380     │                 │
│              └──────────────┴─────────────────┘                 │
└──────────────────────────────┬───────────────────────────────────┘
                               │ REST API + WebSocket
┌──────────────────────────────▼───────────────────────────────────┐
│                   FRONTEND — Next.js (Porta 3100)                 │
│                                                                  │
│   Login  │  Dashboard  │  Contatos  │  Métricas  │  Auditoria   │
└──────────────────────────────────────────────────────────────────┘
                               ▲
                    Agentes e Administradores
```

### Módulos do backend

| Módulo | Responsabilidade |
|--------|-----------------|
| `auth` | Autenticação JWT, login, registro |
| `users` | Gestão de usuários e roles |
| `conversations` | Ciclo de vida das conversas, roteamento, transferência |
| `departments` | Gestão de departamentos, fila, agentes |
| `messages` | Envio, recebimento e status de mensagens |
| `whatsapp` | Abstração do provedor (WAHA/Meta), FlowEngine, Webhook |
| `websocket` | Gateway Socket.IO, autenticação, salas |
| `notifications` | Alertas em tempo real para departamentos |
| `audit` | Log de auditoria automático via interceptor |
| `metrics` | Analytics e estatísticas de atendimento |
| `quick-replies` | Templates de respostas rápidas |

---

## 5. Stack Tecnológica

### Backend

| Componente | Tecnologia | Versão |
|------------|-----------|--------|
| Framework | NestJS | 11.x |
| Linguagem | TypeScript | 5.x |
| ORM | Prisma | 6.x |
| Banco de dados | PostgreSQL | 15 |
| Cache / Filas | Redis | 7 |
| Autenticação | JWT + Passport | — |
| WebSocket | Socket.IO | 4.x |
| Validação | class-validator | — |
| Criptografia | bcrypt | — |
| HTTP Client | Axios | — |

### Frontend

| Componente | Tecnologia | Versão |
|------------|-----------|--------|
| Framework | Next.js (App Router) | 15.x |
| UI | React | 19.x |
| Estado cliente | Zustand | 5.x |
| Estado servidor | TanStack Query | 5.x |
| WebSocket | Socket.IO Client | 4.x |
| Estilização | Tailwind CSS | 4.x |
| Componentes UI | shadcn/ui (Radix) | — |
| Notificações | Sonner | — |
| Ícones | Lucide React | — |

### Infraestrutura

| Componente | Tecnologia |
|------------|-----------|
| Containerização | Docker + Docker Compose |
| Proxy reverso | Nginx |
| WhatsApp (dev) | WAHA (devlikeapro/waha-plus) |
| WhatsApp (prod) | Meta Cloud API v21.0 |

---

## 6. Modelo de Dados

### Entidades principais

```
Company (raiz multi-tenant)
  └── Department (departamentos da empresa)
  └── User (agentes e admins)
        └── departmentId → Department
  └── Conversation (conversas com clientes)
        ├── departmentId → Department
        ├── assignedUserId → User
        ├── status: OPEN | ASSIGNED | RESOLVED | ARCHIVED
        └── flowState: GREETING | DEPARTMENT_SELECTED | ASSIGNED |
                       AWAITING_ROUTING_CONFIRMATION | RESOLVED
  └── Message (mensagens da conversa)
        ├── direction: INBOUND | OUTBOUND
        ├── type: TEXT | IMAGE | AUDIO | VIDEO | DOCUMENT
        └── status: PENDING | SENT | DELIVERED | READ | FAILED
  └── Assignment (histórico de atribuições)
  └── QuickReply (respostas rápidas)
  └── ConversationNote (notas internas)
  └── AuditLog (log de ações)
```

### Campos estratégicos da `Conversation`

| Campo | Propósito |
|-------|-----------|
| `flowState` | Estado atual no fluxo de atendimento |
| `timeoutAt` | Prazo para resposta do departamento |
| `lastDepartmentId` | Último departamento que atendeu (roteamento inteligente) |
| `lastAttendantId` | Último agente que atendeu |
| `lastAttendedAt` | Data do último atendimento |
| `metadata` | JSON flexível para dados do WAHA, chatId, sugestões |
| `unreadCount` | Contador de mensagens não lidas |

---

## 7. Fluxos de Negócio

### 7.1 Primeiro contato do cliente

```
Cliente envia mensagem no WhatsApp
         │
         ▼
WAHA recebe e dispara webhook para /webhooks/waha
         │
         ▼
Sistema cria Conversation (status=OPEN, flowState=GREETING)
         │
         ▼
Envia menu automático:
"Olá! Como posso ajudar?
 1 - Laboratório
 2 - Comercial
 3 - Financeiro
 4 - Administrativo"
         │
         ▼
Aguarda seleção do cliente
```

### 7.2 Seleção de departamento e fila

```
Cliente responde "1" (ou "lab", "laboratorio")
         │
         ▼
FlowEngine mapeia para slug do departamento
         │
         ▼
DepartmentRoutingService.routeToDepartment()
  ├── Atualiza Conversation: departmentId, flowState=DEPARTMENT_SELECTED
  ├── Define timeoutAt = agora + responseTimeoutMinutes do departamento
  └── Emite evento WebSocket 'new_conversation' para o departamento
         │
         ▼
Agentes do departamento recebem notificação em tempo real
Conversa aparece na fila do departamento
```

### 7.3 Atribuição e atendimento

```
Agente visualiza fila → clica em "Aceitar"
         │
         ▼
ConversationsService.assignUser()
  ├── Conversation: status=ASSIGNED, assignedUserId, flowState=ASSIGNED
  ├── Cria registro de Assignment
  └── Emite 'conversation-assigned' via WebSocket
         │
         ▼
Agente abre o chat
Mensagens chegam/saem em tempo real via Socket.IO
Prefixo automático nas mensagens: "*Nome - Departamento*: texto"
```

### 7.4 Cliente recorrente (roteamento inteligente)

```
Cliente que já foi atendido envia nova mensagem
         │
         ▼
Sistema consulta último atendimento do cliente
         │
         ├── Encontrou → flowState=AWAITING_ROUTING_CONFIRMATION
         │    └── Envia: "Você foi atendido pelo Laboratório. Deseja retornar?"
         │
         └── Não encontrou → fluxo normal (menu de seleção)
```

### 7.5 Transferência de conversa

```
Agente clica em "Transferir" → seleciona departamento
         │
         ▼
ConversationsService.transferConversation()
  ├── Atualiza: departmentId (novo), assignedUserId=null
  ├── Fecha Assignment anterior (unassignedAt = agora)
  ├── Emite 'conversation_transferred' para ambos os departamentos
  └── Novo departamento recebe notificação
         │
         ▼
Conversa entra na fila do novo departamento
```

### 7.6 Ciclo de vida de uma mensagem

```
Agente envia mensagem
     │
     ▼ status: PENDING (salvo no DB)
     │
     ▼ status: SENT (WAHA confirma envio)
     │
     ▼ status: DELIVERED (WhatsApp entrega ao dispositivo)
     │
     ▼ status: READ (cliente visualiza)
     │
Frontend atualiza o ícone de confirmação (✓ → ✓✓ → ✓✓ azul) via WebSocket
```

---

## 8. Integrações

### WhatsApp via WAHA (ambiente de desenvolvimento)

| Aspecto | Detalhes |
|---------|----------|
| Tipo | API REST local, containerizada |
| Porta | 3101 |
| Autenticação | API Key no header |
| Sessão | `default` (uma sessão WhatsApp conectada) |
| Entrada | Webhook POST `/webhooks/waha` + polling a cada 5s |
| Saída | POST `/api/default/messages/send` |
| Eventos | `message`, `message.ack`, `message.any` |

### WhatsApp via Meta Cloud API (produção)

| Aspecto | Detalhes |
|---------|----------|
| Base URL | `https://graph.facebook.com/v21.0` |
| Autenticação | Bearer token (access token da Meta) |
| Entrada | Webhook oficial da Meta |
| Saída | POST `/{phoneNumberId}/messages` |

### Abstração de provedor

O sistema possui uma camada de abstração (`WhatsappService`) que permite trocar entre WAHA e Meta Cloud API sem alterar o restante do código. A escolha é feita pela variável de ambiente `WHATSAPP_PROVIDER`.

---

## 9. Segurança e Controle de Acesso

### Autenticação

- **JWT (JSON Web Token)** com expiração de 7 dias
- Payload contém: `userId`, `companyId`, `departmentId`, `role`
- Todas as rotas da API exigem Bearer token válido
- WebSocket autenticado via token no handshake

### Autorização por perfil

| Permissão | ADMIN | AGENT |
|-----------|:-----:|:-----:|
| Ver todas as conversas da empresa | ✓ | — |
| Ver conversas do próprio departamento | ✓ | ✓ |
| Ver fila do departamento | ✓ | ✓ |
| Transferir conversas | ✓ | ✓ |
| Gerenciar usuários | ✓ | — |
| Ver métricas | ✓ | — |
| Ver log de auditoria | ✓ | — |
| Configurar departamentos | ✓ | — |

### Multi-tenancy

- Todos os dados são isolados por `companyId`
- Nenhuma query retorna dados de outra empresa
- Agentes não acessam dados fora do seu departamento

### Rate Limiting

- 60 requisições por minuto por IP no backend
- Proteção contra abuso de endpoints públicos

---

## 10. Infraestrutura e Deploy

### Ambiente de desenvolvimento

```yaml
Serviços Docker:
  PostgreSQL 15    → porta 5434  (banco de dados)
  Redis 7          → porta 6380  (cache e filas)
  WAHA             → porta 3101  (API WhatsApp)

Processos Node.js:
  Backend NestJS   → porta 4000  (npm run start:dev)
  Frontend Next.js → porta 3100  (npm run dev -p 3100)
```

### Variáveis de ambiente críticas

```bash
# Banco de dados
DATABASE_URL=postgresql://whatsapp:senha@host:5434/whatsapp_db

# Segurança
JWT_SECRET=<chave de 256 bits>

# WhatsApp (dev)
WHATSAPP_PROVIDER=WAHA
WAHA_API_URL=http://host:3101
WAHA_API_KEY=<chave>

# WhatsApp (prod)
WHATSAPP_PROVIDER=META
WHATSAPP_ACCESS_TOKEN=<token Meta>
WHATSAPP_PHONE_NUMBER_ID=<id>

# URLs
FRONTEND_URL=http://host:3100
NEXT_PUBLIC_API_URL=http://host:4000/api
NEXT_PUBLIC_WS_URL=http://host:4000
```

### Escalabilidade

O backend é stateless — o único estado compartilhado é o banco de dados e o Redis. Isso permite escalar horizontalmente adicionando mais instâncias do backend atrás de um load balancer, desde que:

- O Redis seja compartilhado entre instâncias (já configurado via URL)
- O Socket.IO utilize Redis Adapter para sincronizar eventos entre instâncias

---

## 11. Métricas e Auditoria

### Métricas disponíveis

| Métrica | Descrição |
|---------|-----------|
| Conversas por status | Total OPEN / ASSIGNED / RESOLVED / ARCHIVED |
| Conversas por departamento | Distribuição por setor |
| Tempo médio de resposta | Da entrada na fila até primeira resposta |
| Carga por agente | Quantidade de conversas abertas por agente |
| Volume diário | Número de conversas iniciadas por dia |

### Auditoria

Todo request autenticado é automaticamente registrado pelo `AuditInterceptor` com:

- **Usuário** que executou a ação
- **Ação** realizada (ex: `conversation.transfer`, `user.create`)
- **Entidade** afetada e seu ID
- **Timestamp** e **endereço IP**
- **Metadata** adicional (ex: departamento de origem e destino numa transferência)

---

## 12. Roadmap e Evolução

### Próximas entregas sugeridas

| Prioridade | Feature | Impacto |
|-----------|---------|---------|
| Alta | **SLA e alertas de timeout** — notificar supervisores quando conversa passa do prazo | Operacional |
| Alta | **Relatórios exportáveis** — CSV/PDF de conversas e métricas por período | Gestão |
| Média | **Multi-sessão WhatsApp** — suporte a múltiplos números na mesma empresa | Escalabilidade |
| Média | **Chatbot com IA** — resposta automática para perguntas frequentes | Produtividade |
| Média | **App mobile** — acesso pelo celular para agentes de campo | Mobilidade |
| Baixa | **Integração com CRM** — sincronizar dados de clientes com sistemas externos | Integração |
| Baixa | **Pesquisa de satisfação** — enviar CSAT automaticamente ao fechar conversa | Qualidade |

### Débitos técnicos conhecidos

| Item | Impacto |
|------|---------|
| Backend sem watch mode em produção | Deploy manual necessário a cada alteração |
| Polling WAHA a cada 5s | Aumenta latência do recebimento de mensagens; webhook é mais eficiente |
| Sem testes automatizados de integração | Risco em refatorações |
| Frontend sem PWA | Sem notificações push nativas no mobile |

---

## Apêndice — Portas e Endpoints de Referência

| Serviço | Porta | URL base |
|---------|-------|---------|
| Frontend | 3100 | `http://host:3100` |
| Backend REST API | 4000 | `http://host:4000/api` |
| Backend WebSocket | 4000 | `ws://host:4000/socket.io` |
| PostgreSQL | 5434 | — |
| Redis | 6380 | — |
| WAHA Dashboard | 3101 | `http://host:3101/dashboard` |
| WAHA API | 3101 | `http://host:3101/api` |

### Endpoints REST principais

```
POST   /api/auth/login
POST   /api/auth/register

GET    /api/conversations
GET    /api/conversations/:id
POST   /api/conversations
PATCH  /api/conversations/:id/assign
PATCH  /api/conversations/:id/transfer
PATCH  /api/conversations/:id/status
GET    /api/conversations/:id/messages

POST   /api/messages/send
POST   /api/messages/send-media

GET    /api/departments
GET    /api/departments/:id/queue
GET    /api/departments/:id/agents

GET    /api/users
POST   /api/users
PATCH  /api/users/:id

GET    /api/metrics/conversations
GET    /api/metrics/agents

GET    /api/audit
GET    /api/quick-replies
POST   /api/quick-replies
```

---

*Documento gerado em Fevereiro de 2026. Para dúvidas técnicas ou atualizações, contate o time de desenvolvimento.*
