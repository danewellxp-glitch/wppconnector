# WPPConnector - Documentação Técnica Completa

## Visão Geral

O **WPPConnector** é uma plataforma de atendimento ao cliente via WhatsApp, multi-tenant, com roteamento inteligente de conversas, gestão de departamentos e agentes em tempo real.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA DO SISTEMA                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌──────────┐     ┌──────────┐     ┌──────────────────────┐  │
│    │ WhatsApp │────▶│  WAHA/   │────▶│      Backend         │  │
│    │  Users   │◀────│  Meta    │◀────│     (NestJS)         │  │
│    └──────────┘     └──────────┘     └──────────┬───────────┘  │
│                                                  │              │
│                                      ┌───────────┴───────────┐ │
│                                      │                       │ │
│                              ┌───────▼──────┐  ┌────────────┐│ │
│                              │  PostgreSQL  │  │   Redis    ││ │
│                              │  (Database)  │  │  (Cache)   ││ │
│                              └──────────────┘  └────────────┘│ │
│                                      │                       │ │
│                                      └───────────┬───────────┘ │
│                                                  │              │
│    ┌──────────┐     ┌──────────┐     ┌──────────▼───────────┐  │
│    │ Agentes/ │◀───▶│ Frontend │◀───▶│     WebSocket        │  │
│    │ Admins   │     │ (Next.js)│     │   (Socket.IO)        │  │
│    └──────────┘     └──────────┘     └──────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Índice

1. [Stack Tecnológica](#1-stack-tecnológica)
2. [Estrutura do Projeto](#2-estrutura-do-projeto)
3. [Backend - Arquitetura Detalhada](#3-backend---arquitetura-detalhada)
4. [Frontend - Arquitetura Detalhada](#4-frontend---arquitetura-detalhada)
5. [Banco de Dados](#5-banco-de-dados)
6. [Integração WhatsApp](#6-integração-whatsapp)
7. [Sistema de Roteamento](#7-sistema-de-roteamento)
8. [WebSocket e Tempo Real](#8-websocket-e-tempo-real)
9. [Autenticação e Segurança](#9-autenticação-e-segurança)
10. [API Reference](#10-api-reference)
11. [Infraestrutura e Deploy](#11-infraestrutura-e-deploy)
12. [Configuração de Ambiente](#12-configuração-de-ambiente)
13. [Fluxos de Negócio](#13-fluxos-de-negócio)
14. [Guia de Desenvolvimento](#14-guia-de-desenvolvimento)

---

## 1. Stack Tecnológica

### Backend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| NestJS | 10.x | Framework principal |
| TypeScript | 5.x | Linguagem |
| Prisma | 6.x | ORM para PostgreSQL |
| Socket.IO | 4.x | WebSocket em tempo real |
| Bull | 4.x | Filas (Redis-based) |
| Passport/JWT | - | Autenticação |
| class-validator | - | Validação de DTOs |

### Frontend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Next.js | 16.x | Framework React |
| React | 19.x | UI Library |
| TypeScript | 5.x | Linguagem |
| Zustand | 5.x | State Management |
| TanStack Query | 5.x | Server State |
| Tailwind CSS | 4.x | Estilização |
| shadcn/ui | - | Componentes UI |
| Socket.IO Client | 4.x | WebSocket |

### Infraestrutura
| Tecnologia | Propósito |
|------------|-----------|
| PostgreSQL 15 | Banco de dados principal |
| Redis 7 | Cache e filas |
| WAHA | WhatsApp HTTP API (desenvolvimento) |
| Meta Cloud API | WhatsApp Business (produção) |
| Nginx | Reverse proxy |
| Docker/Docker Compose | Containerização |

---

## 2. Estrutura do Projeto

```
wppconnector/
├── backend/                    # Servidor NestJS
│   ├── src/
│   │   ├── main.ts            # Entry point
│   │   ├── app.module.ts      # Root module
│   │   ├── common/            # Guards, decorators, filters
│   │   ├── prisma/            # Prisma service
│   │   └── modules/
│   │       ├── auth/          # Autenticação JWT
│   │       ├── users/         # Gestão de usuários
│   │       ├── conversations/ # Gestão de conversas
│   │       ├── messages/      # Envio/recebimento de mensagens
│   │       ├── whatsapp/      # Integração WhatsApp
│   │       ├── departments/   # Departamentos e roteamento
│   │       ├── websocket/     # Gateway WebSocket
│   │       ├── notifications/ # Notificações
│   │       ├── metrics/       # Analytics
│   │       ├── audit/         # Logs de auditoria
│   │       ├── quick-replies/ # Respostas rápidas
│   │       ├── health/        # Health checks
│   │       └── system/        # Endpoints de sistema
│   └── prisma/
│       └── schema.prisma      # Schema do banco
│
├── frontend/                   # Aplicação Next.js
│   ├── src/
│   │   ├── app/               # App Router (páginas)
│   │   │   ├── login/         # Página de login
│   │   │   └── dashboard/     # Dashboard principal
│   │   ├── components/        # Componentes React
│   │   │   ├── auth/          # Login form
│   │   │   ├── chat/          # Chat components
│   │   │   ├── layout/        # Header, Sidebar
│   │   │   └── ui/            # shadcn/ui
│   │   ├── hooks/             # Custom hooks
│   │   ├── stores/            # Zustand stores
│   │   ├── lib/               # Utilitários
│   │   └── types/             # TypeScript types
│
├── nginx/                      # Configuração Nginx
├── scripts/                    # Scripts de deploy/backup
├── docker-compose.yml          # Dev environment
├── docker-compose.prod.yml     # Prod environment
└── .env.example               # Variáveis de ambiente
```

---

## 3. Backend - Arquitetura Detalhada

### 3.1 Módulos Principais

#### AuthModule
Responsável pela autenticação via JWT.

```typescript
// Fluxo de autenticação
POST /api/auth/login
  ↓
AuthService.login(email, password)
  ↓
Valida credenciais com bcrypt
  ↓
Gera JWT token (payload: userId, email, role, companyId)
  ↓
Retorna { user, token }
```

**Arquivos principais:**
- `auth.service.ts` - Lógica de autenticação
- `jwt.strategy.ts` - Estratégia Passport JWT
- `auth.controller.ts` - Endpoints de auth

#### ConversationsModule
Gerencia o ciclo de vida das conversas.

**Funcionalidades:**
- Listagem com filtros (status, departamento)
- Atribuição/desatribuição de agentes
- Transferência entre departamentos
- Resolução e arquivamento
- Notas internas

#### MessagesModule
Processa envio e recebimento de mensagens.

**Tipos suportados:**
- `TEXT` - Mensagens de texto
- `IMAGE` - Imagens
- `DOCUMENT` - Documentos (PDF, etc.)
- `AUDIO` - Áudios/voice notes
- `VIDEO` - Vídeos

#### WhatsAppModule
Integração com provedores WhatsApp.

**Componentes:**
- `WhatsappService` - Abstração de envio
- `FlowEngineService` - Motor de fluxo/chatbot
- `WahaWebhookController` - Webhook WAHA
- `WebhookController` - Webhook Meta
- `WahaPollingService` - Polling fallback

#### DepartmentsModule
Gestão de departamentos e roteamento.

**Funcionalidades:**
- CRUD de departamentos
- Roteamento automático de conversas
- Balanceamento de carga entre agentes
- Timeouts e redirecionamentos

### 3.2 Services Críticos

#### FlowEngineService
Motor de conversação baseado em menu.

```typescript
// Estados do fluxo
enum ConversationFlowState {
  GREETING,                    // Menu inicial enviado
  DEPARTMENT_SELECTED,         // Departamento escolhido
  ASSIGNED,                    // Agente atribuído
  AWAITING_ROUTING_CONFIRMATION, // Aguardando confirmação de roteamento
  TIMEOUT_REDIRECT,            // Timeout, redirecionando
  RESOLVED                     // Conversa encerrada
}
```

**Fluxo de processamento:**
```
Mensagem recebida
       ↓
┌──────────────────────┐
│ handleIncomingMessage│
└──────────┬───────────┘
           ↓
    ┌──────────────┐
    │ Conversa     │──No──▶ Criar nova conversa
    │ existe?      │        Enviar menu de boas-vindas
    └──────┬───────┘
           │Yes
           ↓
    ┌──────────────┐
    │ flowState?   │
    └──────┬───────┘
           │
    ┌──────┴──────────────────────────────┐
    │              │                      │
    ▼              ▼                      ▼
 GREETING    AWAITING_ROUTING      Outros estados
    │         CONFIRMATION              │
    ▼              │                    ▼
 Processar         ▼               Registrar
 escolha      Processar            mensagem
 de menu      SIM/NÃO
```

#### DepartmentRoutingService
Roteamento inteligente de conversas.

```typescript
// Algoritmo de atribuição
async assignConversationToDepartment(conversationId, departmentSlug):
  1. Buscar departamento pelo slug
  2. Buscar agentes online do departamento
  3. Se há agentes disponíveis:
     - Ordenar por menor carga (menos conversas ativas)
     - Atribuir ao agente com menor carga
  4. Se não há agentes:
     - Colocar na fila do departamento
     - Definir timeout para reatribuição
```

#### ConversationRoutingService
Sugestões de roteamento baseadas em histórico.

```typescript
// Verifica atendimento anterior
async checkPreviousAttendance(customerPhone):
  1. Buscar última conversa do cliente
  2. Se encontrou e tem lastDepartmentId:
     - Retorna departamento e atendente anterior
     - Define estado AWAITING_ROUTING_CONFIRMATION
  3. Se não encontrou:
     - Segue fluxo normal de menu
```

### 3.3 Agendamento (Cron Jobs)

```typescript
// department-routing.cron.ts

@Cron('*/30 * * * * *')  // A cada 30 segundos
handleTimeouts():
  - Verifica conversas com timeout expirado
  - Redireciona para outro agente/departamento

@Cron('0 * * * * *')     // A cada minuto
checkAgentHeartbeats():
  - Verifica heartbeats de agentes
  - Marca como offline se inativo > 2 minutos
  - Redistribui conversas de agentes offline
```

---

## 4. Frontend - Arquitetura Detalhada

### 4.1 Páginas (App Router)

| Rota | Componente | Descrição |
|------|------------|-----------|
| `/` | `page.tsx` | Redirect para dashboard ou login |
| `/login` | `login/page.tsx` | Página de autenticação |
| `/dashboard` | `dashboard/page.tsx` | Interface principal de chat |
| `/dashboard/users` | `users/page.tsx` | Gestão de usuários (Admin) |
| `/dashboard/metrics` | `metrics/page.tsx` | Dashboard de métricas |
| `/dashboard/audit` | `audit/page.tsx` | Logs de auditoria (Admin) |
| `/dashboard/settings` | `settings/page.tsx` | Configurações (Admin) |

### 4.2 State Management (Zustand)

#### authStore
```typescript
interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;  // Restaura do localStorage
}
```

#### chatStore
```typescript
interface ChatStore {
  conversations: Conversation[];
  selectedConversationId: string | null;
  messages: Record<string, Message[]>;
  
  setConversations: (conversations: Conversation[]) => void;
  selectConversation: (id: string) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessageStatus: (messageId: string, status: string) => void;
  updateConversation: (conversation: Partial<Conversation>) => void;
  incrementUnread: (conversationId: string) => void;
}
```

### 4.3 Hooks Customizados

| Hook | Propósito |
|------|-----------|
| `useAuth` | Login, logout, get current user |
| `useConversations` | Fetch e mutação de conversas |
| `useMessages` | Fetch, envio de mensagens/mídia |
| `useSocket` | Conexão e eventos WebSocket |
| `useUsers` | CRUD de usuários |
| `useMetrics` | Dashboard de métricas |

### 4.4 Componentes Principais

```
Dashboard Layout
┌─────────────────────────────────────────────────────────┐
│ Header (Logo, AgentStatusBar, UserMenu, Logout)        │
├────────┬────────────────────────────┬──────────────────┤
│        │                            │                  │
│ Side   │      ChatWindow            │   CustomerInfo   │
│ bar    │  ┌──────────────────────┐  │  ┌────────────┐ │
│        │  │ Messages List        │  │  │ Phone      │ │
│ • Chat │  │                      │  │  │ Name       │ │
│ • Users│  │ MessageBubble        │  │  │ Department │ │
│ • Stats│  │ MessageBubble        │  │  │ Status     │ │
│ • Audit│  │ MessageBubble        │  │  │            │ │
│        │  │                      │  │  │ Actions:   │ │
│        │  └──────────────────────┘  │  │ - Assign   │ │
│        │  ┌──────────────────────┐  │  │ - Transfer │ │
│        │  │ MessageInput         │  │  │ - Resolve  │ │
│        │  │ [Type message...]    │  │  │            │ │
│        │  └──────────────────────┘  │  │ Notes      │ │
│        │                            │  └────────────┘ │
└────────┴────────────────────────────┴──────────────────┘
```

---

## 5. Banco de Dados

### 5.1 Schema (Prisma)

```prisma
// Empresa (multi-tenant)
model Company {
  id              String   @id @default(uuid())
  name            String
  phoneNumberId   String?  // WhatsApp Business Phone Number ID
  accessToken     String?  // WhatsApp API Token
  greetingMessage String?  // Mensagem de boas-vindas
  
  users         User[]
  conversations Conversation[]
  departments   Department[]
}

// Departamento
model Department {
  id                     String   @id @default(uuid())
  slug                   String   // Identificador único (ex: "vendas")
  name                   String
  color                  String?  // Cor para UI
  isRoot                 Boolean  @default(false)
  responseTimeoutMinutes Int      @default(5)
  maxAgents              Int      @default(10)
  companyId              String
  
  users         User[]
  conversations Conversation[]
}

// Usuário (Agente ou Admin)
model User {
  id           String       @id @default(uuid())
  email        String       @unique
  passwordHash String
  name         String
  role         UserRole     @default(AGENT)
  onlineStatus OnlineStatus @default(OFFLINE)
  isActive     Boolean      @default(true)
  departmentId String?
  companyId    String
  
  assignments  Assignment[]
  messages     Message[]
}

// Conversa
model Conversation {
  id              String                  @id @default(uuid())
  customerPhone   String
  customerName    String?
  status          ConversationStatus      @default(OPEN)
  flowState       ConversationFlowState   @default(GREETING)
  departmentId    String?
  assignedUserId  String?
  companyId       String
  
  // Timestamps de fluxo
  timeoutAt       DateTime?
  routedAt        DateTime?
  assignedAt      DateTime?
  greetingSentAt  DateTime?
  
  // Histórico para roteamento inteligente
  lastDepartmentId  String?
  lastAttendantId   String?
  
  // Metadata (chatId, perfil do contato)
  metadata        Json?
  
  messages     Message[]
  assignments  Assignment[]
  notes        ConversationNote[]
}

// Mensagem
model Message {
  id                String          @id @default(uuid())
  whatsappMessageId String?         @unique
  conversationId    String
  senderId          String?         // null para mensagens do cliente
  direction         MessageDirection
  type              MessageType     @default(TEXT)
  content           String?
  mediaUrl          String?
  status            MessageStatus   @default(PENDING)
  isBot             Boolean         @default(false)
  
  createdAt DateTime @default(now())
}

// Enums
enum UserRole { ADMIN, AGENT }
enum OnlineStatus { ONLINE, BUSY, OFFLINE }
enum ConversationStatus { OPEN, ASSIGNED, RESOLVED, ARCHIVED }
enum ConversationFlowState {
  GREETING
  DEPARTMENT_SELECTED
  ASSIGNED
  AWAITING_ROUTING_CONFIRMATION
  TIMEOUT_REDIRECT
  RESOLVED
}
enum MessageDirection { INBOUND, OUTBOUND }
enum MessageType { TEXT, IMAGE, DOCUMENT, AUDIO, VIDEO }
enum MessageStatus { PENDING, SENT, DELIVERED, READ, FAILED }
```

### 5.2 Relacionamentos

```
Company 1──N User
Company 1──N Department
Company 1──N Conversation

Department 1──N User
Department 1──N Conversation

User 1──N Message (enviadas)
User 1──N Assignment

Conversation 1──N Message
Conversation 1──N Assignment
Conversation 1──N ConversationNote
```

---

## 6. Integração WhatsApp

### 6.1 Provedores Suportados

#### WAHA (Desenvolvimento)
- **URL Base:** `http://192.168.10.156:3101`
- **Vantagens:** Gratuito, local, sem limites
- **Uso:** Desenvolvimento e testes

```typescript
// Envio de mensagem via WAHA
await axios.post(`${WAHA_API_URL}/api/${WAHA_SESSION}/sendText`, {
  chatId: phoneNumber,
  text: message
}, {
  headers: { 'X-Api-Key': WAHA_API_KEY }
});
```

#### Meta Cloud API (Produção)
- **URL Base:** `https://graph.facebook.com/v21.0`
- **Vantagens:** Oficial, confiável, escalável
- **Requisitos:** WhatsApp Business Account

```typescript
// Envio de mensagem via Meta
await axios.post(
  `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
  {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'text',
    text: { body: message }
  },
  {
    headers: { Authorization: `Bearer ${accessToken}` }
  }
);
```

### 6.2 Webhooks

#### WAHA Webhook
```
POST /webhooks/waha

Eventos:
- message: Nova mensagem recebida
- message.ack: Confirmação de entrega/leitura

Payload:
{
  "event": "message",
  "session": "default",
  "payload": {
    "id": "message_id",
    "from": "5511999999999@c.us",
    "body": "Texto da mensagem",
    "type": "chat"
  }
}
```

#### Meta Webhook
```
GET /webhooks/whatsapp   (Verificação)
POST /webhooks/whatsapp  (Eventos)

Eventos:
- messages: Nova mensagem
- statuses: Atualização de status (sent, delivered, read)
```

### 6.3 Fluxo de Mensagem

```
                    RECEBIMENTO
┌─────────┐     ┌──────────┐     ┌─────────────┐
│WhatsApp │────▶│ Webhook  │────▶│ FlowEngine  │
│  User   │     │Controller│     │  Service    │
└─────────┘     └──────────┘     └──────┬──────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │ ConversationSvc │
                               │ - Criar/Atualizar│
                               │ - Registrar msg  │
                               └────────┬────────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │ WebSocketGateway│
                               │ - Notificar UI  │
                               └─────────────────┘

                    ENVIO
┌─────────┐     ┌──────────┐     ┌─────────────┐
│ Frontend│────▶│ Messages │────▶│  WhatsApp   │
│  Agent  │     │Controller│     │  Service    │
└─────────┘     └──────────┘     └──────┬──────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │  WAHA / Meta    │
                               │     API         │
                               └────────┬────────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │   WhatsApp      │
                               │    User         │
                               └─────────────────┘
```

---

## 7. Sistema de Roteamento

### 7.1 Fluxo de Atendimento

```
┌──────────────────────────────────────────────────────────────────┐
│                    FLUXO DE ATENDIMENTO                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CLIENTE ENVIA MENSAGEM                                       │
│     ↓                                                            │
│  2. VERIFICAR HISTÓRICO DE ATENDIMENTO                           │
│     │                                                            │
│     ├──▶ Tem histórico? ───SIM───▶ 3. SUGERIR ROTEAMENTO        │
│     │                              "Deseja falar com [Depto]?"   │
│     │                              Aguardar resposta (2 min)     │
│     │                                      │                     │
│     │                              ┌───────┴───────┐             │
│     │                              │               │             │
│     │                             SIM            NÃO             │
│     │                              │               │             │
│     │                              ▼               ▼             │
│     │                         Rotear para    Enviar menu         │
│     │                         depto anterior  de opções         │
│     │                                                            │
│     └──▶ Não tem ─────────────▶ 4. ENVIAR MENU DE BOAS-VINDAS   │
│                                   "Escolha o departamento:"      │
│                                   1 - Vendas                     │
│                                   2 - Suporte                    │
│                                   3 - Financeiro                 │
│                                   4 - Outro                      │
│                                            │                     │
│                                            ▼                     │
│  5. CLIENTE ESCOLHE DEPARTAMENTO (ou timeout)                    │
│     ↓                                                            │
│  6. BUSCAR AGENTE DISPONÍVEL NO DEPARTAMENTO                     │
│     │                                                            │
│     ├──▶ Agente disponível? ───SIM───▶ 7. ATRIBUIR CONVERSA     │
│     │                                     Status: ASSIGNED       │
│     │                                     Notificar agente       │
│     │                                                            │
│     └──▶ Nenhum disponível ───────────▶ 8. ENTRAR NA FILA      │
│                                            Status: OPEN          │
│                                            Definir timeout       │
│                                                                  │
│  9. CONVERSA EM ANDAMENTO                                        │
│     │                                                            │
│     ├──▶ Agente resolve ──────────────▶ 10. ENCERRAR            │
│     │                                      Status: RESOLVED      │
│     │                                      Salvar histórico      │
│     │                                                            │
│     └──▶ Timeout / Agente offline ────▶ 11. REDIRECIONAR        │
│                                            Buscar outro agente   │
│                                            ou colocar na fila    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Algoritmo de Atribuição

```typescript
async function assignToAgent(departmentId: string): Promise<User | null> {
  // 1. Buscar agentes online do departamento
  const onlineAgents = await prisma.user.findMany({
    where: {
      departmentId,
      onlineStatus: 'ONLINE',
      isActive: true
    }
  });

  if (onlineAgents.length === 0) return null;

  // 2. Calcular carga de cada agente
  const agentsWithLoad = await Promise.all(
    onlineAgents.map(async (agent) => {
      const activeConversations = await prisma.conversation.count({
        where: {
          assignedUserId: agent.id,
          status: 'ASSIGNED'
        }
      });
      return { agent, load: activeConversations };
    })
  );

  // 3. Ordenar por menor carga
  agentsWithLoad.sort((a, b) => a.load - b.load);

  // 4. Retornar agente com menor carga
  return agentsWithLoad[0].agent;
}
```

### 7.3 Menu de Departamentos

```
Bem-vindo à MaxSolucoes! 👋

Escolha o departamento:
1 - 💼 Vendas
2 - 🔧 Suporte Técnico
3 - 💰 Financeiro
4 - 📋 Outros Assuntos

Digite o número da opção desejada.
```

---

## 8. WebSocket e Tempo Real

### 8.1 Gateway

```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/'
})
export class WebsocketGateway {
  // Salas (rooms)
  // - company:{companyId}
  // - department:{departmentId}
  // - user:{userId}
  // - conversation:{conversationId}

  // Eventos emitidos
  @SubscribeMessage('join-company')
  handleJoinCompany(client, companyId)

  @SubscribeMessage('join-conversation')
  handleJoinConversation(client, conversationId)

  @SubscribeMessage('agent-status')
  handleAgentStatus(client, { status })

  @SubscribeMessage('heartbeat')
  handleHeartbeat(client)
}
```

### 8.2 Eventos

| Evento | Direção | Descrição |
|--------|---------|-----------|
| `message-received` | Server→Client | Nova mensagem de cliente |
| `message-sent` | Server→Client | Mensagem enviada pelo agente |
| `message-status` | Server→Client | Atualização de status (read, delivered) |
| `conversation-assigned` | Server→Client | Conversa atribuída ao agente |
| `conversation-queued` | Server→Client | Conversa entrou na fila |
| `conversation-transferred` | Server→Client | Conversa transferida |
| `agent-status` | Client→Server | Agente alterou status |
| `heartbeat` | Client→Server | Heartbeat de atividade |
| `typing` | Bidirecional | Indicador de digitação |

### 8.3 Heartbeat Mechanism

```typescript
// Frontend: Envia heartbeat a cada 30 segundos
useEffect(() => {
  const interval = setInterval(() => {
    socket.emit('heartbeat');
  }, 30000);
  return () => clearInterval(interval);
}, []);

// Backend: Verifica heartbeats a cada minuto
@Cron('0 * * * * *')
async checkHeartbeats() {
  const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutos
  
  const staleAgents = await prisma.user.findMany({
    where: {
      onlineStatus: { not: 'OFFLINE' },
      lastHeartbeat: { lt: threshold }
    }
  });

  for (const agent of staleAgents) {
    await this.setAgentOffline(agent.id);
    await this.redistributeConversations(agent.id);
  }
}
```

---

## 9. Autenticação e Segurança

### 9.1 Fluxo de Autenticação

```
┌─────────────────────────────────────────────────────────┐
│                  AUTENTICAÇÃO JWT                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. LOGIN                                               │
│     POST /api/auth/login                                │
│     { email, password }                                 │
│           │                                             │
│           ▼                                             │
│     ┌─────────────┐                                     │
│     │ Validar     │                                     │
│     │ credenciais │                                     │
│     │ (bcrypt)    │                                     │
│     └──────┬──────┘                                     │
│            │                                            │
│            ▼                                            │
│     ┌─────────────┐                                     │
│     │ Gerar JWT   │                                     │
│     │ Payload:    │                                     │
│     │ - sub       │                                     │
│     │ - email     │                                     │
│     │ - role      │                                     │
│     │ - companyId │                                     │
│     └──────┬──────┘                                     │
│            │                                            │
│            ▼                                            │
│     { user, token }                                     │
│                                                         │
│  2. REQUISIÇÕES AUTENTICADAS                            │
│     Authorization: Bearer <token>                       │
│           │                                             │
│           ▼                                             │
│     ┌─────────────┐                                     │
│     │ JwtStrategy │                                     │
│     │ - Valida    │                                     │
│     │   token     │                                     │
│     │ - Extrai    │                                     │
│     │   payload   │                                     │
│     └──────┬──────┘                                     │
│            │                                            │
│            ▼                                            │
│     ┌─────────────┐                                     │
│     │ RolesGuard  │                                     │
│     │ - Verifica  │                                     │
│     │   permissão │                                     │
│     └─────────────┘                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Guards e Decorators

```typescript
// Proteger rota com autenticação
@UseGuards(JwtAuthGuard)
@Get('protected-route')
async protectedRoute() {}

// Proteger com role específico
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get('admin-only')
async adminRoute() {}

// Obter usuário atual
@Get('me')
async getMe(@CurrentUser() user: User) {
  return user;
}
```

### 9.3 Segurança

| Medida | Implementação |
|--------|---------------|
| Hash de senha | bcrypt (10 rounds) |
| Token JWT | Expira em 7 dias |
| Rate Limiting | 60 req/min (ThrottlerModule) |
| CORS | Configurado para frontend URL |
| Headers | X-Frame-Options, X-XSS-Protection |
| Validação | class-validator em todos os DTOs |

---

## 10. API Reference

### 10.1 Autenticação

```
POST /api/auth/login
Body: { email: string, password: string }
Response: { user: User, token: string }

POST /api/auth/register
Body: { email, password, name, role?, companyId }
Response: { user: User }

GET /api/auth/me
Headers: Authorization: Bearer <token>
Response: User
```

### 10.2 Conversas

```
GET /api/conversations
Query: ?status=OPEN,ASSIGNED&departmentId=xxx&search=xxx
Response: Conversation[]

GET /api/conversations/:id
Response: Conversation (with messages)

GET /api/conversations/:id/messages
Query: ?limit=50&cursor=xxx
Response: { messages: Message[], nextCursor?: string }

POST /api/conversations/:id/assign
Body: { userId?: string }
Response: Conversation

POST /api/conversations/:id/transfer
Body: { departmentId: string }
Response: Conversation

POST /api/conversations/:id/resolve
Response: Conversation

PATCH /api/conversations/:id/customer-name
Body: { name: string }
Response: Conversation
```

### 10.3 Mensagens

```
POST /api/messages/send
Body: { conversationId: string, content: string }
Response: Message

POST /api/messages/send-media
FormData: { conversationId, file, caption? }
Response: Message

GET /api/messages/search
Query: ?query=xxx&conversationId=xxx
Response: Message[]
```

### 10.4 Usuários

```
GET /api/users
Query: ?role=AGENT&status=active&departmentId=xxx
Response: User[]

POST /api/users
Body: { email, password, name, role, departmentId?, companyId }
Response: User

PATCH /api/users/:id
Body: { name?, role?, departmentId?, isActive? }
Response: User

PATCH /api/users/me/status
Body: { status: 'ONLINE' | 'BUSY' | 'OFFLINE' }
Response: User
```

### 10.5 Departamentos

```
GET /api/departments
Response: Department[]

GET /api/departments/:id
Response: Department

GET /api/departments/:id/agents
Response: User[]

GET /api/departments/:id/queue
Response: Conversation[]

POST /api/departments (ADMIN)
Body: { name, slug, color?, responseTimeoutMinutes? }
Response: Department
```

### 10.6 Métricas

```
GET /api/metrics/dashboard
Query: ?period=7d
Response: {
  conversations: { open, assigned, resolved, archived },
  messages: { today, total, inbound, outbound },
  avgFirstResponseTime: number
}

GET /api/metrics/agents
Response: AgentMetrics[]
```

---

## 11. Infraestrutura e Deploy

### 11.1 Docker Compose (Produção)

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "8180:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - frontend
      - backend

  frontend:
    build: ./frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:4000/api
      - NEXT_PUBLIC_WS_URL=http://backend:4000

  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

### 11.2 Nginx Configuration

```nginx
upstream frontend {
    server frontend:3000;
}

upstream backend {
    server backend:4000;
}

server {
    listen 80;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    # API
    location /api/ {
        proxy_pass http://backend;
        limit_req zone=api_limit burst=20 nodelay;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    # Webhooks (sem rate limit)
    location /webhooks/ {
        proxy_pass http://backend;
    }
}
```

### 11.3 Scripts de Deploy

```bash
# scripts/deploy.sh
#!/bin/bash
cd /opt/wppconnect.io
git pull origin main
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Health check
sleep 10
curl -f http://localhost:8180/api/health || exit 1
echo "Deploy completed successfully!"
```

### 11.4 Backup

```bash
# scripts/backup.sh
#!/bin/bash
BACKUP_DIR="/opt/wppconnect.io/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# PostgreSQL
docker exec postgres pg_dump -U postgres wppconnector | \
  gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

# Redis
docker exec redis redis-cli BGSAVE
docker cp redis:/data/dump.rdb "$BACKUP_DIR/redis_$TIMESTAMP.rdb"

# Remover backups > 7 dias
find $BACKUP_DIR -mtime +7 -delete
```

---

## 12. Configuração de Ambiente

### 12.1 Variáveis de Ambiente

```bash
# .env.example

# =============================================================================
# DATABASE
# =============================================================================
DATABASE_URL="postgresql://postgres:postgres@192.168.10.156:5434/wppconnector"

# =============================================================================
# REDIS
# =============================================================================
REDIS_URL="redis://192.168.10.156:6380"

# =============================================================================
# BACKEND
# =============================================================================
PORT=4000
NODE_ENV=development
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRATION="7d"

# =============================================================================
# WHATSAPP - META CLOUD API
# =============================================================================
WHATSAPP_ACCESS_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_BUSINESS_ACCOUNT_ID=""
WHATSAPP_WEBHOOK_VERIFY_TOKEN=""

# =============================================================================
# WHATSAPP - WAHA (Development)
# =============================================================================
WHATSAPP_PROVIDER="WAHA"
WAHA_API_URL="http://192.168.10.156:3101"
WAHA_API_KEY="your-waha-api-key"
WAHA_SESSION="default"

# =============================================================================
# FRONTEND
# =============================================================================
NEXT_PUBLIC_API_URL="http://192.168.10.156:4000/api"
NEXT_PUBLIC_WS_URL="http://192.168.10.156:4000"
FRONTEND_URL="http://192.168.10.156:3100"
```

### 12.2 Configuração por Ambiente

| Variável | Development | Production |
|----------|-------------|------------|
| NODE_ENV | development | production |
| WHATSAPP_PROVIDER | WAHA | META |
| DATABASE_URL | localhost/dev | production URL |
| JWT_SECRET | qualquer valor | valor seguro |
| CORS | * | domínio específico |

---

## 13. Fluxos de Negócio

### 13.1 Novo Cliente

```
1. Cliente envia primeira mensagem
2. Sistema verifica se é cliente recorrente
   - SIM: Sugere departamento anterior
   - NÃO: Envia menu de boas-vindas
3. Cliente escolhe departamento
4. Sistema busca agente disponível
5. Conversa atribuída ou entra na fila
6. Agente recebe notificação
7. Atendimento realizado
8. Agente resolve conversa
9. Histórico salvo para próximo atendimento
```

### 13.2 Cliente Recorrente

```
1. Cliente envia mensagem
2. Sistema detecta atendimento anterior
3. Envia: "Deseja falar com [Departamento]? (SIM/NÃO)"
4. Cliente responde:
   - SIM: Roteia para departamento anterior
   - NÃO: Envia menu de opções
   - TIMEOUT (2min): Envia menu de opções
5. Fluxo continua normalmente
```

### 13.3 Transferência

```
1. Agente clica em "Transferir"
2. Seleciona departamento destino
3. Sistema busca agente disponível no departamento
4. Conversa transferida
5. Novo agente recebe notificação
6. Cliente recebe mensagem de transferência
```

### 13.4 Timeout e Redirecionamento

```
1. Conversa na fila por X minutos
2. Cron job detecta timeout
3. Sistema busca agente em qualquer departamento
4. Se encontrar: Reatribui
5. Se não encontrar: Mantém na fila, notifica supervisores
```

---

## 14. Guia de Desenvolvimento

### 14.1 Setup Local

```bash
# 1. Clonar repositório
git clone https://github.com/danewellxp-glitch/wppconnector.git
cd wppconnector

# 2. Iniciar infraestrutura
docker compose up -d

# 3. Configurar backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run start:dev

# 4. Configurar frontend (novo terminal)
cd frontend
cp .env.example .env
npm install
npm run dev -- -p 3100
```

### 14.2 Comandos Úteis

```bash
# Backend
npm run start:dev          # Desenvolvimento
npm run build              # Build
npm run test               # Testes
npx prisma studio          # GUI do banco
npx prisma migrate dev     # Criar migration

# Frontend
npm run dev                # Desenvolvimento
npm run build              # Build
npm run lint               # Linter

# Docker
docker compose up -d       # Iniciar serviços
docker compose down        # Parar serviços
docker compose logs -f     # Ver logs
```

### 14.3 Estrutura de Commits

```
feat: adiciona nova funcionalidade
fix: corrige bug
refactor: refatoração de código
docs: atualiza documentação
style: formatação, sem mudança de código
test: adiciona ou corrige testes
chore: tarefas de manutenção
```

### 14.4 Criando Novo Módulo (Backend)

```bash
# 1. Gerar módulo NestJS
nest g module modules/my-module
nest g controller modules/my-module
nest g service modules/my-module

# 2. Estrutura
src/modules/my-module/
├── my-module.module.ts
├── my-module.controller.ts
├── my-module.service.ts
├── dto/
│   ├── create-my-module.dto.ts
│   └── update-my-module.dto.ts
└── entities/
    └── my-module.entity.ts

# 3. Registrar no AppModule
```

---

## Conclusão

O WPPConnector é uma plataforma robusta de atendimento via WhatsApp com:

- **Arquitetura moderna**: NestJS + Next.js + TypeScript
- **Tempo real**: WebSocket com Socket.IO
- **Roteamento inteligente**: Baseado em histórico e carga de agentes
- **Multi-tenant**: Suporte a múltiplas empresas
- **Escalável**: Docker, Redis, PostgreSQL
- **Seguro**: JWT, rate limiting, validação

Para dúvidas ou contribuições, consulte a documentação específica de cada módulo ou entre em contato com a equipe de desenvolvimento.

---

*Documento gerado em: 20/02/2026*  
*Versão: 1.0.0*
