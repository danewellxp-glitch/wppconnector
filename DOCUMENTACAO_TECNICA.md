# WPPConnector — Documentação Técnica Completa

> Sistema de atendimento WhatsApp multi-setor da SIM Química / SIM Estearina  
> Versão do documento: 2026-04-19

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Infraestrutura e Ambientes](#2-infraestrutura-e-ambientes)
3. [Arquitetura Backend (NestJS)](#3-arquitetura-backend-nestjs)
4. [Schema de Banco de Dados (Prisma)](#4-schema-de-banco-de-dados-prisma)
5. [Integração WhatsApp (WAHA e Meta Cloud API)](#5-integração-whatsapp-waha-e-meta-cloud-api)
6. [Flow Engine — Robô de Atendimento](#6-flow-engine--robô-de-atendimento)
7. [Tipos de Roteamento](#7-tipos-de-roteamento)
8. [Máquina de Estados das Conversas](#8-máquina-de-estados-das-conversas)
9. [Fluxo Completo de Mensagens](#9-fluxo-completo-de-mensagens)
10. [Módulo WebSocket (Tempo Real)](#10-módulo-websocket-tempo-real)
11. [Arquitetura Frontend (Next.js)](#11-arquitetura-frontend-nextjs)
12. [Todos os Endpoints da API](#12-todos-os-endpoints-da-api)
13. [Docker e Deploy](#13-docker-e-deploy)
14. [Domínios: velocewpp.online](#14-domínios-velocewpponline)
15. [Segurança e Autenticação](#15-segurança-e-autenticação)
16. [Testes Robot Framework](#16-testes-robot-framework)
17. [Referência de Arquivos-Chave](#17-referência-de-arquivos-chave)

---

## 1. Visão Geral do Sistema

O WPPConnector é uma plataforma de atendimento ao cliente via WhatsApp com suporte a múltiplos setores (multi-departamento) e múltiplos agentes. O sistema automatiza o roteamento de mensagens recebidas pelo WhatsApp para os departamentos e agentes certos, com interface de atendimento em tempo real para os agentes humanos.

### Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 11 + TypeScript |
| ORM | Prisma 6 |
| Banco de dados | PostgreSQL 15 |
| Cache | Redis 7 |
| Frontend | Next.js 16 + React 19 |
| Estado global | Zustand 5 |
| Fetching | TanStack Query 5 |
| Tempo real | Socket.IO 4 |
| WhatsApp (dev) | WAHA (WhatsApp HTTP API) |
| WhatsApp (prod) | Meta Cloud API |
| Estilização | Tailwind CSS 4 + shadcn/ui + Radix UI |
| Deploy | Docker Compose + Nginx |
| Proxy reverso (SaaS) | Traefik |

### Modelo de multi-tenancy

O sistema é multi-tenant em banco único: cada registro no banco tem `companyId`, e todos os queries são filtrados por esse campo. O JWT emitido no login carrega `{ sub: userId, companyId, departmentId }`, garantindo isolamento entre empresas na mesma instância.

---

## 2. Infraestrutura e Ambientes

### Portas e serviços

| Serviço | DEV | PROD (interno) |
|---------|-----|----------------|
| PostgreSQL | 5720 | 5432 (interno) |
| Redis | 5721 | 6379 (interno) |
| WAHA | 5722 | — (só no dev) |
| Backend (NestJS) | 5723 | 4000 (interno) |
| Frontend (Next.js) | 5724 | 3000 (interno) |
| Nginx (prod) | — | 8180 |

### Endereços de acesso

| Ambiente | Frontend | Backend/API |
|----------|----------|-------------|
| DEV | http://192.168.10.156:5724 | http://192.168.10.156:5723 |
| PROD (LAN) | http://192.168.10.156:3100 | http://192.168.10.156:4000 |
| PROD (domínio) | https://velocewpp.online | https://api.velocewpp.online |

### Variáveis de ambiente DEV (`.env`)

```env
POSTGRES_USER=whatsapp
POSTGRES_PASSWORD=dev_password
POSTGRES_DB=whatsapp_db_dev

PORT=5723
NODE_ENV=development
JWT_SECRET=db14fb65d8d27a23f3b8520db849cabd7c499e8f7a4750c1260fd6b1cb2550d3
JWT_EXPIRES_IN=7d

WHATSAPP_PROVIDER=WAHA
WAHA_API_KEY=wpp_waha_dev_key_2024
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=Le98yqbl@
WAHA_SESSION=default
WAHA_SESSION_LAB=default2
WAHA_SESSIONS=default,default2

FRONTEND_URL=http://192.168.10.156:5724
NEXT_PUBLIC_API_URL=http://192.168.10.156:5723/api
NEXT_PUBLIC_WS_URL=ws://192.168.10.156:5723
LOG_LEVEL=debug
```

### Variáveis de ambiente PROD (`.env.production.example`)

```env
POSTGRES_DB=whatsapp_db
POSTGRES_USER=whatsapp
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

JWT_SECRET=CHANGE_ME_RANDOM_256BIT_STRING
JWT_EXPIRES_IN=7d

WHATSAPP_ACCESS_TOKEN=your_meta_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

NEXT_PUBLIC_API_URL=https://api.velocewpp.online/api
NEXT_PUBLIC_WS_URL=wss://api.velocewpp.online
FRONTEND_URL=https://velocewpp.online
```

---

## 3. Arquitetura Backend (NestJS)

### Árvore de módulos (`app.module.ts`)

```
AppModule (Root)
├── ConfigModule          (global, lê .env)
├── ScheduleModule        (tarefas cron)
├── ThrottlerModule       (rate limiting: 60 req/s)
├── PrismaModule          (ORM, global)
├── AuthModule
├── UsersModule
├── ConversationsModule
├── MessagesModule
├── WhatsappModule
├── WebsocketModule
├── DepartmentsModule
├── NotificationsModule
├── HealthModule
├── MetricsModule
├── AuditModule
├── QuickRepliesModule
├── SettingsModule
└── SystemModule
```

---

### 3.1 AuthModule (`auth/`)

**Responsabilidade:** autenticação JWT, login, registro, reset de senha.

**Endpoints:**
```
POST /api/auth/register         Cria novo usuário
POST /api/auth/login            Login (retorna JWT)
GET  /api/auth/me               Perfil do usuário logado [Protegido]
POST /api/auth/forgot-password  Solicita reset de senha
```

**Comportamento:**
- JWT expira em 7 dias (configurável)
- Senha armazenada com bcrypt (10 rounds)
- Roles disponíveis: `ADMIN` e `AGENT`
- Cada usuário pertence a uma `Company` (multi-tenant)

**Arquivos:**
- `auth.controller.ts` — rotas REST
- `auth.service.ts` — lógica de negócio
- `jwt.strategy.ts` — validação Passport JWT
- `dto/login.dto.ts`, `dto/register.dto.ts`

---

### 3.2 UsersModule (`users/`)

**Responsabilidade:** CRUD de usuários, atribuição a departamentos, controle de roles.

**Endpoints:**
```
GET    /api/users                          Lista todos [Admin]
GET    /api/users/:id                      Detalhe [Admin]
POST   /api/users                          Cria usuário [Admin]
PATCH  /api/users/:id                      Atualiza [Admin]
DELETE /api/users/:id                      Desativa [Admin]
PATCH  /api/users/me                       Atualiza próprio perfil [Protegido]
GET    /api/users/me/departments           Meus departamentos [Protegido]
GET    /api/users/:id/departments          Departamentos do usuário [Admin]
POST   /api/users/:id/departments/:deptId  Atribui dept ao user [Admin]
DELETE /api/users/:id/departments/:deptId  Remove dept do user [Admin]
```

**Destaques:**
- Suporte a múltiplos departamentos por agente (tabela `UserDepartment`)
- Campo `activeDepartmentIds: String[]` para departamentos ativos no momento

---

### 3.3 ConversationsModule (`conversations/`)

**Responsabilidade:** ciclo de vida das conversas — criação, roteamento, atribuição, status.

**Endpoints:**
```
GET  /api/conversations                     Lista conversas [Protegido]
GET  /api/conversations/:id                 Detalhe da conversa [Protegido]
GET  /api/conversations/:id/messages        Mensagens com paginação [Protegido]
GET  /api/conversations/contacts            Busca contatos [Protegido]
POST /api/conversations/sync-contacts       Sincroniza contatos do WhatsApp [Protegido]
POST /api/conversations/contacts            Cria contato + inicia chat [Protegido]
POST /api/conversations/:id/assign          Atribui a agente [Protegido]
POST /api/conversations/:id/unassign        Remove atribuição [Protegido]
POST /api/conversations/:id/transfer        Transfere para dept/agente [Protegido]
PATCH /api/conversations/:id/status         Altera status [Protegido]
POST /api/conversations/:id/resolve         Resolve conversa [Protegido]
PATCH /api/conversations/:id/customer-name  Atualiza nome do cliente [Protegido]
POST /api/conversations/:id/read            Marca como lida [Protegido]
```

**Services importantes:**
- `conversations.service.ts` — lógica principal
- `conversation-routing.service.ts` — roteamento inteligente para clientes que retornam

**Fluxo de `resolve()`:**
1. Marca `status = RESOLVED` e `flowState = RESOLVED`
2. Registra `lastDepartmentId`, `lastAttendantId`, `lastAttendedAt` (via `recordAttendance()`)
3. Opcionalmente envia mensagem de encerramento ao cliente

---

### 3.4 MessagesModule (`messages/`)

**Responsabilidade:** envio/recebimento de mensagens, upload de mídia, rastreamento de status.

**Endpoints:**
```
POST /api/messages/send        Envia mensagem de texto [Protegido]
POST /api/messages/send-media  Envia mídia (upload) [Protegido]
```

**Tipos de mensagem:**
| Tipo | Descrição |
|------|-----------|
| `TEXT` | Texto simples |
| `IMAGE` | Imagem (jpg, png, gif, webp) |
| `DOCUMENT` | PDF, Office, texto |
| `AUDIO` | Áudio de voz (.ogg, .mp3, .wav) |
| `VIDEO` | Vídeo |

**Status de mensagem:**
| Status | Significado |
|--------|-------------|
| `PENDING` | Salvo, aguardando envio ao WhatsApp |
| `SENT` | Entregue à API do WhatsApp |
| `DELIVERED` | Entregue no celular do cliente |
| `READ` | Lido pelo cliente |
| `FAILED` | Falha no envio |

**Prefixo de agente em mensagens outbound:**
> Formato: `*Nome Agente - Departamento*: Texto da mensagem`

**Armazenamento de mídia:**
- Salvo localmente em `/uploads/{type}/{YYYY-MM}/`
- Máx. 10 MB por arquivo
- URL servida via proxy: `GET /api/files/{session}/{filename}`

---

### 3.5 WhatsappModule (`whatsapp/`)

**Responsabilidade:** camada de abstração WhatsApp, webhooks, polling, flow engine.

**Arquivos:**
- `whatsapp.service.ts` — abstração WAHA/Meta (seleciona provider pelo env)
- `waha-webhook.controller.ts` — recebe eventos do WAHA em `POST /webhooks/waha`
- `waha-polling.service.ts` — polling de 30s quando provider é WAHA
- `waha-files.controller.ts` — proxy de mídia em `GET /api/files/...`
- `webhook.controller.ts` — recebe eventos da Meta Cloud API
- `flow-engine.service.ts` — robô de saudação e roteamento

**Detecção de provider:**
```typescript
if (process.env.WHATSAPP_PROVIDER === 'WAHA') {
  // Chama endpoints WAHA (porta 3000 interna)
} else {
  // Chama Meta Cloud API (produção)
}
```

**`WhatsappService` — métodos principais:**
```typescript
sendTextMessage(token, phoneNumberId, to, text, session?)
sendMediaMessage(token, phoneNumberId, to, base64, filename, caption?, session?)
markAsRead(token, phoneNumberId, messageId, session?)
getContactInfo(contactId, session?)   // → { number, pushname, name, isBusiness, profilePictureURL }
getContacts()                          // → todos os contatos do celular
resolveLid(chatId, session?)           // → número real (resolve formato @lid)
retrieveMedia(token, mediaId)
```

---

### 3.6 DepartmentsModule (`departments/`)

**Responsabilidade:** CRUD de departamentos, filas, roteamento e balanceamento de carga.

**Endpoints:**
```
GET   /api/departments             Lista todos [Protegido]
GET   /api/departments/:id         Detalhe [Protegido]
GET   /api/departments/:id/agents  Agentes ativos [Protegido]
GET   /api/departments/:id/queue   Fila do departamento [Protegido]
POST  /api/departments             Cria departamento [Admin]
PATCH /api/departments/:id         Atualiza [Admin]
```

**`DepartmentRoutingService` — lógica de roteamento:**

```typescript
routeToDepartment(conversationId, slug, companyId)
// 1. Busca departamento pelo slug
// 2. Seta departmentId na conversa
// 3. Notifica departamento via WebSocket
// 4. Tenta atribuir agente disponível (balanceamento por carga)
// 5. Envia mensagem de confirmação ao cliente

assignToAgent(conversationId, departmentId)
// Usa isolamento Serializable para evitar race condition
// Seleciona agente com MENOR número de conversas ativas
// Atualiza em transação atômica

getAvailableAgents(departmentId)
// Agentes ordenados por carga (ascending)
```

**Balanceamento de carga:**
- Conta conversas ativas por agente (`status IN [OPEN, ASSIGNED]`)
- Sempre atribui ao agente com menor carga
- Usa `Serializable` isolation level para concorrência

**`DepartmentRoutingCron`:**
- Detecta conversas `ASSIGNED` sem `assignedUserId` (órfãs)
- Tenta reatribuição automaticamente

---

### 3.7 WebsocketModule (`websocket/`)

Detalhado na [Seção 10](#10-módulo-websocket-tempo-real).

---

### 3.8 NotificationsModule (`notifications/`)

**Responsabilidade:** notificações em tempo real via WebSocket para os agentes.

**Métodos:**
```typescript
notifyNewConversation({ conversationId, customerName, customerPhone, departmentId, departmentName, timestamp })
notifyConversationTransferred({ conversationId, customerName, transferredBy, fromDept, toDept, timestamp })
notifyAudit(companyId, message, metadata?)
```

---

### 3.9 MetricsModule (`metrics/`)

**Responsabilidade:** KPIs, analytics e dados para o dashboard.

**Endpoints:**
```
GET /api/metrics/dashboard?period=day|week|month   KPIs gerais
GET /api/metrics/conversations?period=...           Métricas de conversas
GET /api/metrics/agents?period=...                  Performance por agente
```

**Métricas disponíveis:**
- Total de conversas por status (OPEN, ASSIGNED, RESOLVED, ARCHIVED)
- Tempo médio de resposta
- Taxa de resolução
- Média de mensagens por conversa
- Performance por agente/departamento
- Volume de mensagens ao longo do tempo

---

### 3.10 AuditModule (`audit/`)

**Responsabilidade:** log de compliance de todas as ações do sistema.

**Endpoint:**
```
GET /api/audit?userId=X&action=Y&entity=Z&startDate=...&cursor=...&limit=50
// Paginação por cursor | Admin only
```

**Eventos registrados:**
- Login/logout de usuários
- Atribuição e transferência de conversas
- Envio/recebimento de mensagens
- Mudanças de status
- Gestão de usuários (criar, editar, desativar)
- Alterações em departamentos
- Atualização de configurações

**Campos do registro:**
```typescript
id, companyId, userId?, action, entity, entityId?, metadata, timestamp, ipAddress
```

---

### 3.11 QuickRepliesModule (`quick-replies/`)

**Responsabilidade:** templates de respostas rápidas para os agentes.

**Endpoints:**
```
GET    /api/quick-replies         Lista todos
POST   /api/quick-replies         Cria
PATCH  /api/quick-replies/:id     Atualiza
DELETE /api/quick-replies/:id     Remove
```

---

### 3.12 SettingsModule (`settings/`)

**Responsabilidade:** configurações da empresa (WhatsApp, horário comercial, saudação).

**Endpoints:**
```
GET /api/settings   Lê configurações [Admin]
PUT /api/settings   Atualiza configurações [Admin]
```

**Campos configuráveis:**
| Campo | Descrição |
|-------|-----------|
| `greetingMessage` | Mensagem de saudação personalizada |
| `outOfOfficeMessage` | Mensagem fora do horário |
| `autoAssignEnabled` | Atribuição automática de agentes |
| `businessHoursEnabled` | Habilita controle de horário |
| `businessHoursStart` | Início do expediente (ex: `"08:00"`) |
| `businessHoursEnd` | Fim do expediente (ex: `"18:00"`) |
| `businessDays` | Dias úteis em CSV (ex: `"1,2,3,4,5"` = seg-sex) |
| `whatsappAccessToken` | Token Meta Cloud API |
| `whatsappPhoneNumberId` | ID do número Meta |
| `webhookVerifyToken` | Token de verificação do webhook |

---

### 3.13 Health e System

```
GET  /api/health           Verifica status dos serviços (DB, Redis)
POST /api/system/shutdown  Desligamento graceful [Admin]
```

---

## 4. Schema de Banco de Dados (Prisma)

**Arquivo:** `backend/prisma/schema.prisma`

### Company (multi-tenant root)

```prisma
model Company {
  id                     String    @id @default(uuid())
  name                   String
  whatsappPhoneNumberId  String    @unique
  whatsappAccessToken    String
  webhookVerifyToken     String
  greetingMessage        String?
  outOfOfficeMessage     String?
  autoAssignEnabled      Boolean   @default(true)
  businessHoursEnabled   Boolean   @default(false)
  businessHoursStart     String    @default("08:00")
  businessHoursEnd       String    @default("18:00")
  businessDays           String    @default("1,2,3,4,5")
  isActive               Boolean   @default(true)
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  users                User[]
  conversations        Conversation[]
  messages             Message[]
  auditLogs            AuditLog[]
  quickReplies         QuickReply[]
  departments          Department[]
  conversationNotes    ConversationNote[]
  passwordResetRequests PasswordResetRequest[]
}
```

### Department

```prisma
model Department {
  id          String    @id @default(uuid())
  companyId   String
  name        String
  slug        String                          // único por empresa
  description String?
  color       String    @default("#6366f1")
  isRoot      Boolean   @default(false)       // dept de overflow
  isActive    Boolean   @default(true)
  maxAgents   Int       @default(2)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  company         Company
  activeUsers     User[]
  conversations   Conversation[]
  userDepartments UserDepartment[]
}
```

### User

```prisma
model User {
  id                  String    @id @default(uuid())
  companyId           String
  departmentId        String?                    // dept primário
  email               String    @unique
  passwordHash        String
  name                String
  role                Role                       // ADMIN | AGENT
  activeDepartmentIds String[]  @default([])     // multi-dept
  isActive            Boolean   @default(true)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  company              Company
  department           Department?
  userDepartments      UserDepartment[]
  assignments          Assignment[]
  sentMessages         Message[]         @relation("SentMessages")
  auditLogs            AuditLog[]
  assignedConversations Conversation[]  @relation("AssignedConversations")
  conversationNotes    ConversationNote[]
  passwordResetRequests PasswordResetRequest[]
}
```

### UserDepartment (tabela de junção para multi-dept)

```prisma
model UserDepartment {
  userId       String
  departmentId String
  @@id([userId, departmentId])
}
```

### Conversation

```prisma
model Conversation {
  id              String            @id @default(uuid())
  companyId       String
  customerPhone   String
  customerName    String?
  wahaSession     String            @default("default")
  status          ConversationStatus  // OPEN | ASSIGNED | RESOLVED | ARCHIVED
  departmentId    String?
  assignedUserId  String?
  flowState       FlowState           // ver seção 8
  routedAt        DateTime?
  assignedAt      DateTime?
  greetingSentAt  DateTime?
  lastMessageAt   DateTime          @default(now())
  unreadCount     Int               @default(0)
  metadata        Json?             // chatId (LID), contactProfile, routing metadata
  lastDepartmentId  String?
  lastAttendantId   String?
  lastAttendedAt    DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@unique([companyId, customerPhone, wahaSession])
  @@index([companyId, status, lastMessageAt])
  @@index([departmentId])
  @@index([assignedUserId])
}
```

### Message

```prisma
model Message {
  id                 String          @id @default(uuid())
  companyId          String
  conversationId     String
  whatsappMessageId  String?         @unique   // idempotência
  direction          Direction       // INBOUND | OUTBOUND
  type               MessageType     // TEXT | IMAGE | DOCUMENT | AUDIO | VIDEO
  content            String
  mediaUrl           String?
  status             MessageStatus   // PENDING | SENT | DELIVERED | READ | FAILED
  isBot              Boolean         @default(false)
  sentById           String?
  sentAt             DateTime        @default(now())
  deliveredAt        DateTime?
  readAt             DateTime?
  metadata           Json?

  @@index([conversationId, sentAt])
  @@index([companyId, sentAt])
}
```

### Assignment (histórico de atribuições)

```prisma
model Assignment {
  id               String    @id @default(uuid())
  conversationId   String
  userId           String
  assignedAt       DateTime  @default(now())
  unassignedAt     DateTime?

  @@index([conversationId, userId])
}
```

### ConversationNote

```prisma
model ConversationNote {
  id               String    @id @default(uuid())
  conversationId   String
  companyId        String
  authorId         String
  content          String
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([conversationId])
}
```

### AuditLog

```prisma
model AuditLog {
  id          String    @id @default(uuid())
  companyId   String
  userId      String?
  action      String
  entity      String
  entityId    String?
  metadata    Json?
  timestamp   DateTime  @default(now())
  ipAddress   String?

  @@index([companyId, timestamp])
  @@index([userId, timestamp])
}
```

### QuickReply

```prisma
model QuickReply {
  id         String    @id @default(uuid())
  companyId  String
  title      String
  content    String
  shortcut   String?
  isActive   Boolean   @default(true)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([companyId])
}
```

### PasswordResetRequest

```prisma
model PasswordResetRequest {
  id         String              @id @default(uuid())
  companyId  String
  userId     String
  reason     String
  status     ResetStatus         // PENDING | RESOLVED
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt

  @@index([companyId, status])
  @@index([userId])
}
```

### Enums

```prisma
enum Role                { ADMIN  AGENT }
enum ConversationStatus  { OPEN   ASSIGNED   RESOLVED   ARCHIVED }
enum FlowState           { GREETING  DEPARTMENT_SELECTED  ASSIGNED
                          AWAITING_ROUTING_CONFIRMATION  TIMEOUT_REDIRECT  RESOLVED }
enum Direction           { INBOUND   OUTBOUND }
enum MessageType         { TEXT  IMAGE  DOCUMENT  AUDIO  VIDEO }
enum MessageStatus       { PENDING   SENT   DELIVERED   READ   FAILED }
enum ResetStatus         { PENDING   RESOLVED }
```

---

## 5. Integração WhatsApp (WAHA e Meta Cloud API)

### 5.1 WAHA (ambiente DEV)

**O que é:** WhatsApp HTTP API — wrapper HTTP em torno do WhatsApp Web (via WWebJS).  
**Porta interna:** 3000  
**Porta externa (dev):** 5722

#### Endpoints WAHA utilizados

| Método | Endpoint | Finalidade |
|--------|----------|-----------|
| GET | `/api/{session}/chats/overview?limit=50` | Lista chats com contagem de não lidos |
| GET | `/api/{session}/chats/{chatId}/messages?limit=50` | Mensagens de um chat |
| POST | `/api/{session}/chats/{chatId}/messages/read` | Marca como lida |
| GET | `/api/contacts?session={s}&contactId={id}` | Info do contato (resolve LID) |
| GET | `/api/contacts/profile-picture?session={s}&contactId={id}` | Foto de perfil |
| GET | `/api/contacts/all?session={s}` | Exporta todos os contatos |
| POST | `/api/sendText` | Envia mensagem de texto |
| POST | `/api/sendSeen` | Marca mensagem como lida |
| POST | `/api/sendFile` | Envia arquivo/mídia |

#### Sessões WAHA

```env
WAHA_SESSION=default         # Sessão principal
WAHA_SESSION_LAB=default2    # Sessão do laboratório
WAHA_SESSIONS=default,default2  # Sessões a serem polled
```

#### Webhook WAHA → Backend

**Endpoint receptor:** `POST /webhooks/waha` (excluído do prefixo `/api`)

**Payload de entrada:**
```json
{
  "event": "message",
  "session": "default",
  "payload": {
    "id": "message_id",
    "from": "5511999998888@c.us",
    "to": "...",
    "fromMe": false,
    "type": "chat",
    "body": "Texto da mensagem",
    "timestamp": 1234567890,
    "hasMedia": false,
    "notifyName": "Nome do Contato",
    "_data": { "notifyName": "..." }
  }
}
```

**Eventos tratados:**
- `message` → mensagem recebida (ignorado se `fromMe = true`)
- `message.ack` → atualização de status (entregue, lido)
- `message.any` → ignorado (redundante)

#### Polling WAHA (`WahaPollingService`)

Ativo quando `WHATSAPP_PROVIDER === 'WAHA'`.

**Ciclo (30 segundos):**
1. Consulta `GET /api/{session}/chats/overview?limit=50`
2. Filtra chats com `unreadCount > 0` e `!isGroup`
3. Para cada chat: busca mensagens, processa as inbound
4. Marca como lidas: `POST /api/{session}/chats/{chatId}/messages/read`

**Idempotência:** verifica se `whatsappMessageId` já existe no banco antes de criar.

#### Resolução de LID (`@lid`)

O WhatsApp usa identificadores temporários `@lid` para alguns contatos. Cadeia de resolução:

```
1. Tenta GET /api/contacts?contactId={lid} na WAHA
2. Fallback: busca metadata.chatId no banco
3. Fallback: busca por metadata.chatId no registro de conversas
4. Último recurso: usa o LID como número (com aviso no log)
```

### 5.2 Meta Cloud API (ambiente PROD)

**Endpoint receptor:** `POST /webhooks/whatsapp`

**Configuração:**
```env
WHATSAPP_PROVIDER=META
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WEBHOOK_VERIFY_TOKEN=...
```

Verificação GET do webhook Meta é tratada automaticamente pelo `webhook.controller.ts`.

---

## 6. Flow Engine — Robô de Atendimento

**Arquivo:** `backend/src/modules/whatsapp/flow-engine.service.ts`

### Mapeamento do menu (MENU_ALIASES)

| Input do cliente | Slug resolvido | Departamento |
|-----------------|----------------|--------------|
| `1`, `lab`, `laboratorio`, `laudo`, `analise`, `qualidade`, `tecnico` | `laboratorio` | Laboratório |
| `2`, `vendas`, `comercial`, `pedido`, `cotacao`, `amostra`, `entrega`, `preco` | `vendas` | Vendas — Thays |
| `3`, `financeiro`, `boleto`, `nota`, `nf`, `pagamento`, `fatura`, `cobranca`, `manutencao` | `compras-rose` | Compras Rose (Manutenção) |
| `4`, `insumo`, `insumos`, `materia`, `materia prima` | `compras-thays` | Compras Thays (Insumos) |
| `5`, `producao`, `fabricacao`, `processo` | `producao` | Produção |
| `6`, `atendente`, `humano`, `falar`, `adm`, `administrativo`, `rh`, `fornecedor`, `geral` | `atendente` | Falar com Atendente |

**Matching:** case-insensitive, remove acentos (normalize NFD + remove diacríticos).

### Mensagem de saudação padrão

```
Olá! 👋 Seja bem-vindo(a) à *SIM Estearina*!

Como podemos te ajudar hoje? Por favor, digite o *número* da área desejada:

*1️⃣ Laboratório*
Análises técnicas, laudos, controle de qualidade, especificações e certificados de produtos.

*2️⃣ Vendas — Thays*
Pedidos, cotações, disponibilidade de produtos, amostras, novos negócios e prazo de entrega.

*3️⃣ Compras - Rose (Manutenção)*
Boletos, notas fiscais, prazos de pagamento, conciliações e questões financeiras.

*4️⃣ Compras Thays (Insumos/Matéria Prima)*
[Insumos e matéria prima]

*5️⃣ Produção*
Processo produtivo, questões técnicas de fabricação.

*6️⃣ Falar com um Atendente 👤*
Transferência direta para um atendente humano disponível.

_⏰ Nosso horário de atendimento é de segunda a sexta, das 8h às 18h._
```

### Horário comercial

```typescript
if (company.businessHoursEnabled) {
  // Timezone: America/Sao_Paulo
  // Dias: businessDays (CSV: "1,2,3,4,5" = seg-sex)
  // Horário: businessHoursStart até businessHoursEnd

  if (dentroDo horário) {
    // Envia saudação + menu
  } else {
    // Envia mensagem fora do horário
  }
} else {
  // Sempre envia saudação
}
```

**Mensagem padrão fora do horário:**
```
Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.
Sua mensagem foi registrada e retornaremos o contato em nosso horário comercial. 🙏
```

### Métodos do FlowEngineService

```typescript
processMenuChoice(input: string): string | null
// Normaliza input e retorna slug correspondente ou null

resolveDepartmentSlug(companyId, slug): Department | null
// Busca departamento ativo pelo slug

getDefaultGreeting(companyName): string
// Retorna a mensagem completa de saudação

isBusinessHours(company): boolean
// Verifica se está dentro do horário

getOutOfHoursMessage(company): string
// Retorna mensagem customizada ou padrão
```

---

## 7. Tipos de Roteamento

O sistema possui **três tipos distintos de roteamento**, cada um com seu próprio mecanismo:

---

### 7.1 Roteamento por Menu (Escolha do Cliente)

**Trigger:** cliente novo envia qualquer mensagem  
**Fluxo:**
1. Sistema detecta conversa nova → envia menu (1-6)
2. Cliente digita número ou palavra-chave
3. `FlowEngineService.processMenuChoice()` normaliza e mapeia para um slug
4. `DepartmentRoutingService.routeToDepartment()` atribui departamento
5. `assignToAgent()` busca agente disponível (menor carga)
6. Sistema confirma: *"Conectando com [Agente] - [Departamento]..."*

**Estado da conversa:**
```
GREETING → DEPARTMENT_SELECTED → ASSIGNED
```

---

### 7.2 Roteamento por Histórico (Cliente que Retorna)

**Trigger:** cliente que já foi atendido antes abre nova conversa  
**Implementação:** `ConversationRoutingService.checkAndSuggestPreviousRouting()`

**Fluxo:**
1. Nova mensagem chega de cliente com `lastDepartmentId` preenchido
2. Sistema detecta atendimento anterior → pergunta ao cliente:
   > *"Detectamos que você foi atendido anteriormente pelo setor [Departamento]. Deseja ser atendido pelo mesmo setor? (SIM / NÃO)"*
3. `handleRoutingSuggestionResponse()` processa a resposta:
   - `SIM` → roteia direto ao último departamento → `assignToAgent()`
   - `NÃO` → reseta para GREETING → envia menu completo novamente

**Estado da conversa:**
```
GREETING → AWAITING_ROUTING_CONFIRMATION → (SIM) DEPARTMENT_SELECTED → ASSIGNED
                                         → (NÃO) GREETING
```

**Campos usados:**
```typescript
conversation.lastDepartmentId   // último departamento atendente
conversation.lastAttendantId    // último agente
conversation.lastAttendedAt     // quando foi atendido
```

---

### 7.3 Roteamento Manual (Agente/Admin)

**Trigger:** ação humana no dashboard

**Subtipos:**

#### a) Atribuição direta
```
POST /api/conversations/:id/assign
{ "userId": "agent-uuid" }
```
- Agente ou admin atribui conversa a um agente específico
- `status → ASSIGNED`, `assignedUserId → userId`
- Emite WebSocket `conversation-assigned` ao agente

#### b) Desatribuição
```
POST /api/conversations/:id/unassign
```
- Remove agente da conversa
- `status → OPEN`, `assignedUserId → null`

#### c) Transferência
```
POST /api/conversations/:id/transfer
{ "departmentId": "...", "userId"?: "..." }
```
- Transfere para outro departamento (e opcionalmente para um agente específico)
- `NotificationsModule` notifica o departamento/agente receptor
- Registrado no `AuditLog`

---

### 7.4 Roteamento de Balanceamento de Carga

**Trigger:** automático ao rotear conversa para departamento

```typescript
// DepartmentRoutingService.assignToAgent()
// Isolamento Serializable para evitar race conditions

SELECT agent
FROM users
WHERE departmentId = X AND isActive = true
ORDER BY (
  SELECT COUNT(*) FROM conversations
  WHERE assignedUserId = users.id
  AND status IN ['OPEN', 'ASSIGNED']
) ASC
LIMIT 1
```

- Agente com **menos conversas ativas** recebe a nova conversa
- Transação com isolamento `Serializable` previne dupla atribuição simultânea

---

### Resumo dos roteamentos

| Tipo | Quem inicia | Como | Estado resultante |
|------|-------------|------|------------------|
| Por menu | Cliente (mensagem) | Digita número/palavra-chave | `ASSIGNED` |
| Por histórico | Cliente (retorno) | Confirma SIM/NÃO | `ASSIGNED` |
| Manual — atribuição | Agente/Admin | Dashboard | `ASSIGNED` |
| Manual — transferência | Agente/Admin | Dashboard | `ASSIGNED` (outro dept) |
| Balanceamento de carga | Automático | Menor carga | `ASSIGNED` |

---

## 8. Máquina de Estados das Conversas

### FlowState (estado do fluxo do robô)

```
GREETING
  ↓ (cliente envia qualquer mensagem → menu enviado)
  ├── [novo cliente] → aguarda escolha 1-6
  └── [cliente que retorna] → AWAITING_ROUTING_CONFIRMATION
        ├── SIM → skip menu → DEPARTMENT_SELECTED
        └── NÃO → volta ao GREETING

AWAITING_ROUTING_CONFIRMATION
  ↓ (cliente responde)
  ├── SIM → DEPARTMENT_SELECTED
  └── NÃO → GREETING

DEPARTMENT_SELECTED
  ↓ (conversa em fila do dept)
  └── agente disponível → ASSIGNED

ASSIGNED
  ↓ (chat ativo com agente)
  └── agente resolve → RESOLVED

TIMEOUT_REDIRECT
  (conversa ASSIGNED sem agente → cron reatribui)

RESOLVED
  ↓ (cliente envia nova mensagem)
  └── conversa reabre → OPEN (status) + GREETING (flowState)
```

### ConversationStatus (status operacional)

```
OPEN       → Ativa, sem agente atribuído
ASSIGNED   → Ativa, com agente atribuído
RESOLVED   → Encerrada pelo agente
ARCHIVED   → Arquivada manualmente
```

### Diagrama de transições

```
[Nova mensagem]
      │
      ▼
[Conversa nova?]──SIM──▶[GREETING] ─────────────────────────────────────┐
      │                     │                                             │
      NÃO                   ▼                                             │
      │              [Tem histórico?]                                     │
      │               SIM │    │ NÃO                                     │
      │                   │    │                                          │
      │                   ▼    ▼                                          │
      │         [AWAITING_  [Aguarda escolha 1-6]                        │
      │          CONFIRM]         │                                       │
      │            │              │ (válida)                              │
      │      SIM│  │NÃO           ▼                                       │
      │          │  └──────▶[GREETING]◀──────────────────────────────────┘
      │          │                │
      │          ▼                ▼
      │   [DEPARTMENT_SELECTED]──────▶[assignToAgent()]
      │                                      │
      ▼                                      ▼
[OPEN/ASSIGNED]                         [ASSIGNED]
      │                                      │
      │                               [Chat ativo]
      │                                      │
      │                              [resolve()]
      │                                      │
      ▼                                      ▼
[Reabre se cliente                      [RESOLVED]
 responder] ──────────────────────────────────┘
```

---

## 9. Fluxo Completo de Mensagens

### 9.1 Mensagem recebida (Inbound)

```
1. CLIENTE ENVIA MENSAGEM NO WHATSAPP
         │
         ▼
2. WAHA RECEBE A MENSAGEM
   ├── MODO WEBHOOK: POST /webhooks/waha (tempo real)
   └── MODO POLLING: consulta a cada 30s

3. WAHA-WEBHOOK-CONTROLLER PROCESSA
   ├── Extrai: chatId, content, fromMe, media, messageId
   ├── Ignora se fromMe === true (mensagens próprias)
   └── Detecta tipo: TEXT, IMAGE, AUDIO, VIDEO, DOCUMENT

4. RESOLVE LID (@lid → número real)
   ├── Tenta WAHA /api/contacts
   ├── Fallback: metadata.chatId no banco
   └── Fallback: usa LID como-está (warning no log)

5. MessagesService.handleIncomingMessage()
   ├── Verifica idempotência: whatsappMessageId já existe?
   ├── Busca ou cria Conversation (companyId+phone+session)
   ├── Cria registro Message (direction=INBOUND, status=DELIVERED)
   ├── Extrai nome do cliente do conteúdo (regex)
   ├── Atualiza: lastMessageAt, unreadCount++
   └── Se status=RESOLVED → muda para OPEN (reabertura)

6. AVALIA FLOW STATE
   ├── [Nova conversa]  → greetingSentAt = null? Envia menu
   ├── [GREETING]       → processMenuChoice()
   ├── [AWAITING_CONF]  → handleRoutingSuggestionResponse()
   └── [ASSIGNED]       → apenas registra mensagem

7. FlowEngine / DepartmentRouting (se aplicável)
   ├── processMenuChoice() → slug
   ├── resolveDepartmentSlug() → Department
   ├── routeToDepartment() → atualiza conversa
   └── assignToAgent() → atribui agente (menor carga)

8. WebSocket emite eventos
   ├── company:{companyId}       → "message-received"
   ├── user:{agentId}            → "conversation-assigned"
   ├── department:{deptId}       → "conversation-queued"
   └── conversation:{convId}     → mensagens e status

9. DASHBOARD ATUALIZA EM TEMPO REAL
   ├── Lista de conversas atualiza
   ├── Nova mensagem aparece no chat
   ├── Contador de não lidas incrementa
   └── Toast notification para o agente
```

### 9.2 Mensagem enviada (Outbound)

```
1. AGENTE DIGITA MENSAGEM NO DASHBOARD

2. messagesService.sendMessage()
   ├── Cria registro Message (status=PENDING)
   ├── Adiciona prefixo: "*Agente - Dept*: Mensagem"
   └── Chama whatsappService.sendTextMessage()

3. WhatsappService
   ├── WAHA: POST /api/sendText
   └── Meta: POST graph.facebook.com/messages

4. Sucesso → Message status=SENT

5. WebSocket "message-sent" → frontend atualiza
```

---

## 10. Módulo WebSocket (Tempo Real)

**Arquivo:** `backend/src/modules/websocket/websocket.gateway.ts`

### Configuração

```typescript
@WebSocketGateway({
  cors: { origin: [...allowedOrigins], credentials: true },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000
})
```

### Rooms (salas por contexto)

| Room | Membros | Eventos recebidos |
|------|---------|-------------------|
| `company:{companyId}` | Todos os usuários da empresa | `message-received`, `audit-event` |
| `department:{deptId}` | Agentes do departamento | `conversation-queued`, `new_conversation` |
| `user:{userId}` | Usuário específico | `conversation-assigned` |
| `conversation:{convId}` | Quem abriu a conversa | `message-received`, `user-typing` |

### Eventos do cliente → servidor

```typescript
socket.emit('join-conversation', conversationId)
socket.emit('leave-conversation', conversationId)
socket.emit('typing-start', conversationId)
socket.emit('typing-stop', conversationId)
```

### Eventos do servidor → cliente

```typescript
gateway.emitToConversation(convId, 'message-received', message)
gateway.emitToConversation(convId, 'message-sent', message)
gateway.emitToConversation(convId, 'user-typing', { userId, userName, isTyping })
gateway.emitToDepartment(deptId, 'conversation-queued', { conversationId, reason })
gateway.emitToDepartment(deptId, 'new_conversation', { ...details })
gateway.emitToUser(userId, 'conversation-assigned', { conversationId, conversation })
gateway.emitToCompany(companyId, 'audit-event', auditData)
```

### Fluxo de conexão

1. Frontend conecta com JWT no header/query
2. Gateway valida token
3. Usuário entra nas rooms automáticas (`company:`, `department:`, `user:`)
4. Ao abrir uma conversa: `join-conversation` → entra em `conversation:{id}`
5. Ao fechar: `leave-conversation`

---

## 11. Arquitetura Frontend (Next.js)

### Stack

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Next.js | 16.1.6 | Framework (App Router) |
| React | 19.2.3 | UI |
| Zustand | 5.x | Estado global |
| TanStack Query | 5.x | Fetching + cache |
| Axios | — | HTTP client |
| socket.io-client | 4.8.3 | WebSocket |
| Tailwind CSS | 4 | Estilização |
| shadcn/ui + Radix | — | Componentes |
| sonner | — | Toast notifications |

### Estrutura de diretórios

```
frontend/src/
├── app/                          # App Router (Next.js)
│   ├── page.tsx                  # Redirect → /login ou /dashboard
│   ├── login/page.tsx            # Página de login
│   ├── dashboard/
│   │   ├── layout.tsx            # Layout (sidebar + header)
│   │   ├── page.tsx              # Dashboard principal (chat)
│   │   ├── contacts/page.tsx     # Gestão de contatos
│   │   ├── users/page.tsx        # Gestão de usuários [Admin]
│   │   ├── metrics/page.tsx      # Dashboard de analytics
│   │   ├── audit/page.tsx        # Log de auditoria [Admin]
│   │   └── settings/page.tsx     # Configurações [Admin]
│   └── layout.tsx                # Root layout (Providers)
│
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx         # Interface principal de chat
│   │   ├── ConversationList.tsx   # Lista de conversas (sidebar)
│   │   ├── MessageBubble.tsx      # Bolha de mensagem
│   │   ├── MessageInput.tsx       # Input de texto + upload
│   │   ├── CustomerInfo.tsx       # Painel de info do cliente
│   │   ├── QuickRepliesPanel.tsx  # Templates de resposta rápida
│   │   ├── ConversationNotes.tsx  # Notas internas
│   │   └── CustomAudioPlayer.tsx  # Player para áudios
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── contacts/
│   │   ├── ContactsList.tsx
│   │   ├── ContactsTableView.tsx
│   │   └── NewContactModal.tsx
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── DepartmentSelectorModal.tsx
│   │   └── ForgotPasswordModal.tsx
│   ├── users/
│   │   └── ManageDepartmentsModal.tsx
│   ├── ui/                        # shadcn/ui (button, input, card...)
│   ├── providers.tsx              # Zustand + QueryClient
│   ├── NotificationContainer.tsx
│   ├── UnreadTitleManager.tsx     # Badge no título da aba
│   └── DepartmentBadge.tsx
│
├── stores/
│   ├── authStore.ts               # Usuário, token, estado de login
│   ├── chatStore.ts               # Conversas, mensagens, typing
│   └── notificationStore.ts       # Toast notifications
│
├── hooks/
│   ├── useAuth.ts
│   ├── useConversations.ts        # TanStack Query (refetch 5s)
│   ├── useMessages.ts             # Paginação cursor-based
│   ├── useSocket.ts               # Conexão Socket.IO
│   ├── useUsers.ts
│   ├── useMetrics.ts
│   ├── useQuickReplies.ts
│   ├── useConversationNotes.ts
│   └── useAudit.ts
│
├── lib/
│   ├── api-client.ts              # Axios com interceptors JWT
│   ├── socket.ts                  # Instância Socket.IO
│   └── utils.ts
│
└── types/
    ├── conversation.ts
    ├── message.ts
    ├── user.ts
    ├── conversationNote.ts
    └── ...
```

### Zustand Stores

**authStore.ts**
```typescript
interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean

  login(email, password): Promise<void>
  logout(): void
  setToken(token): void
  getCurrentUser(): Promise<void>
}
// Token salvo em localStorage para persistência
```

**chatStore.ts**
```typescript
interface ChatState {
  conversations: Conversation[]
  selectedConversationId: string | null
  messages: Record<string, Message[]>        // por conversationId
  typingUsers: Record<string, Record<string, { userName: string }>>

  setConversations(convs): void
  selectConversation(id): void
  setMessages(convId, messages): void
  addMessage(convId, message): void
  updateConversation(conversation): void
  setTyping(convId, userId, userName, isTyping): void
  incrementUnread(convId): void
  resetUnread(convId): void
}
```

**notificationStore.ts**
```typescript
interface NotificationState {
  notifications: Toast[]
  add(title, description, type): void
  remove(id): void
}
```

### Layout do Dashboard (3 painéis)

```
┌────────────────────────────────────────────────────┐
│                   HEADER                           │
├──────────────┬───────────────────┬─────────────────┤
│              │                   │                 │
│  CONVERSATION│   CHAT WINDOW     │  CUSTOMER INFO  │
│  LIST        │                   │  + NOTES        │
│  (sidebar)   │   MessageBubble   │  + QUICK REPLIES│
│              │   MessageInput    │                 │
│  Busca       │                   │                 │
│  Filtros     │                   │                 │
│              │                   │                 │
└──────────────┴───────────────────┴─────────────────┘
```

---

## 12. Todos os Endpoints da API

### Autenticação
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/forgot-password
```

### Usuários
```
GET    /api/users
GET    /api/users/:id
POST   /api/users
PATCH  /api/users/:id
DELETE /api/users/:id
PATCH  /api/users/me
GET    /api/users/me/departments
GET    /api/users/:id/departments
POST   /api/users/:id/departments/:deptId
DELETE /api/users/:id/departments/:deptId
```

### Conversas
```
GET   /api/conversations
GET   /api/conversations/:id
GET   /api/conversations/:id/messages
GET   /api/conversations/contacts
POST  /api/conversations/sync-contacts
POST  /api/conversations/contacts
POST  /api/conversations/:id/assign
POST  /api/conversations/:id/unassign
POST  /api/conversations/:id/transfer
PATCH /api/conversations/:id/status
POST  /api/conversations/:id/resolve
PATCH /api/conversations/:id/customer-name
POST  /api/conversations/:id/read
```

### Mensagens
```
POST /api/messages/send
POST /api/messages/send-media
```

### Departamentos
```
GET   /api/departments
GET   /api/departments/:id
GET   /api/departments/:id/agents
GET   /api/departments/:id/queue
POST  /api/departments
PATCH /api/departments/:id
```

### Métricas
```
GET /api/metrics/dashboard?period=day|week|month
GET /api/metrics/conversations?period=...
GET /api/metrics/agents?period=...
```

### Auditoria
```
GET /api/audit?userId=X&action=Y&entity=Z&cursor=...&limit=50
```

### Respostas Rápidas
```
GET    /api/quick-replies
POST   /api/quick-replies
PATCH  /api/quick-replies/:id
DELETE /api/quick-replies/:id
```

### Configurações
```
GET /api/settings
PUT /api/settings
```

### Sistema
```
GET  /api/health
POST /api/system/shutdown
```

### Webhooks (sem prefixo /api)
```
POST /webhooks/waha       Eventos WAHA (DEV)
GET  /webhooks/whatsapp   Verificação Meta
POST /webhooks/whatsapp   Eventos Meta (PROD)
```

### Arquivos (proxy de mídia)
```
GET /api/files/:session/:filename
```

---

## 13. Docker e Deploy

### DEV (`docker-compose.yml`)

```yaml
services:
  postgres:
    image: postgres:15
    ports: ["5720:5432"]
    volumes: [postgres_dev_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["5721:6379"]

  waha:
    image: devlikeapro/waha
    ports: ["5722:3000"]
    environment:
      WAHA_API_KEY: wpp_waha_dev_key_2024
      WHATSAPP_DEFAULT_ENGINE: WEBJS

# Backend e Frontend rodam localmente (npm run start:dev / npm run dev)
```

**Comandos DEV:**
```bash
# Subir infra
docker-compose up -d

# Backend
cd wppconnector-dev/backend
npm run start:dev

# Frontend
cd wppconnector-dev/frontend
npm run dev

# Migrations
npx prisma migrate dev --name nome_da_migration

# Seed
npm run prisma:seed
npm run prisma:seed:estearina
```

### PROD (`docker-compose.prod.yml`)

```yaml
services:
  nginx:
    ports: ["8180:80"]
    # Proxy reverso:
    # /api/*       → backend:4000
    # /socket.io/* → backend:4000
    # /webhooks/*  → backend:4000
    # /*           → frontend:3000

  backend:
    build: ./backend/Dockerfile
    # Multi-stage: Node 22 alpine
    # CMD: npx prisma migrate deploy && node dist/src/main.js
    internal port: 4000

  frontend:
    build: ./frontend/Dockerfile
    # Multi-stage: Node 22 alpine, next/standalone
    # CMD: node server.js
    internal port: 3000

  postgres:
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    volumes: [redis_data:/data]

networks:
  wpp-network:   # interno
  gas_network:   # externo, compartilhado com outros serviços
```

**Dockerfile Backend (multi-stage):**
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
```

**Dockerfile Frontend (multi-stage):**
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

**Deploy PROD:**
```bash
git pull origin main
cp .env.production.example .env
docker-compose -f docker-compose.prod.yml up -d --build
curl http://localhost:8180/api/health
```

---

## 14. Domínios: velocewpp.online

### Domínios registrados

| Domínio | Uso |
|---------|-----|
| `velocewpp.online` | Frontend (produção pública) |
| `api.velocewpp.online` | Backend / API (produção pública) |
| `velocewppconect.online` | Frontend (domínio alternativo) |
| `api.velocewppconect.online` | Backend (domínio alternativo) |

### Roteamento via Traefik

Os containers de produção expõem labels do Traefik:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.wpp-frontend.rule=Host(`velocewppconect.online`) || Host(`velocewpp.online`)"
  - "traefik.http.routers.wpp-api.rule=Host(`api.velocewppconect.online`) || Host(`api.velocewpp.online`)"
  - "traefik.http.services.wpp-nginx.loadbalancer.server.port=80"
```

O Traefik está em rede externa (`gas_network`), compartilhada entre múltiplos serviços.

### SSL / Cloudflare

- Cloudflared tunnel para conexão segura
- Certificado gerenciado pelo Cloudflare (zero-config)
- Proteção DDoS incluída
- Certificate pinning configurado

### Nginx (dentro do container PROD)

```nginx
# /api/* e /webhooks/* → backend:4000
# /socket.io/*         → backend:4000 (upgrade websocket)
# /* (resto)           → frontend:3000
```

---

## 15. Segurança e Autenticação

### JWT

| Parâmetro | Valor |
|-----------|-------|
| Algoritmo | HS256 |
| Secret | 256-bit string aleatória |
| Expiração | 7 dias |
| Payload | `{ sub: userId, companyId, departmentId }` |

### Senhas

- Hash: bcrypt com 10 rounds
- Nunca armazenadas em texto plano
- Reset tracked na tabela `PasswordResetRequest`

### Guards e Decorators

```typescript
@UseGuards(JwtAuthGuard)           // Valida token em toda rota protegida
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)                 // Restringe à role ADMIN

@CurrentUser()                     // Injeta usuário autenticado no controller
```

### Rate Limiting

| Configuração | Valor |
|-------------|-------|
| Global | 60 req/segundo |
| Burst | 20 req permitidas |
| Exceção | `@SkipThrottle()` nos webhooks |

### Auditoria

- Toda ação relevante registrada com `userId`, `action`, `entity`, `timestamp`, `ipAddress`
- Acesso ao log restrito a ADMIN
- WebSocket emite eventos de auditoria em tempo real

---

## 16. Testes Robot Framework

### Estrutura

```
/home/daniel/wppconnector/tests/
├── CLAUDE.md
├── resources/
│   ├── common.resource           # Keywords utilitárias, setup/teardown
│   ├── api_keywords.resource     # Keywords para chamadas API
│   └── variables.robot           # Variáveis compartilhadas
├── suites/
│   ├── 01_greeting_flow.robot    # Fluxo de saudação
│   ├── 02_sector_routing.robot   # Roteamento por setor
│   ├── 03_previous_routing.robot # Roteamento por histórico
│   ├── 04_messages.robot         # Mensagens
│   ├── 05_media.robot            # Mídia
│   ├── 06_transfer.robot         # Transferência
│   ├── 07_resolve.robot          # Resolução
│   ├── 08_assign.robot           # Atribuição
│   ├── 09_notes.robot            # Notas
│   ├── 10_business_hours.robot   # Horário comercial
│   └── 11_permissions.robot      # Permissões
└── results/                      # output.xml, report.html, log.html
```

### Credenciais de teste

| Perfil | Email | Senha |
|--------|-------|-------|
| Admin | admin@simquimica.com.br | Sim@2024 |
| Laboratório (1) | laboratorio@simquimica.com.br | Sim@2024 |
| Laboratório (2) | lab2@simquimica.com.br | Sim@2024 |
| Compras Rose (1) | administrativo@simquimica.com.br | Sim@2024 |
| Compras Rose (2) | administrativo2@simquimica.com.br | Sim@2024 |
| Vendas (1) | vendas@simquimica.com.br | Sim@2024 |
| Vendas (2) | vendas2@simquimica.com.br | Sim@2024 |
| Financeiro (1) | financeiro@simquimica.com.br | Sim@2024 |
| Financeiro (2) | financeiro2@simquimica.com.br | Sim@2024 |

### Comandos

```bash
# Instalar dependências
pip install robotframework robotframework-requests

# Rodar todos os testes (DEV)
cd /home/daniel/wppconnector/tests
robot --variable BASE_URL:http://192.168.10.156:5723 --outputdir results suites/

# Por tag
robot --variable BASE_URL:http://192.168.10.156:5723 --include smoke --outputdir results suites/
robot --variable BASE_URL:http://192.168.10.156:5723 --include routing --outputdir results suites/
robot --variable BASE_URL:http://192.168.10.156:5723 --exclude slow --outputdir results suites/

# Ver relatório
xdg-open results/report.html

# Analisar falhas
cat results/output.xml
```

### Estado atual (2026-04-16)

- 93/94 testes passando
- 1 pulado (TC032 — deprecated)
- 0 falhas
- 34/34 smoke tests passando

---

## 17. Referência de Arquivos-Chave

### Backend

| Arquivo | Responsabilidade |
|---------|----------------|
| `backend/src/main.ts` | Bootstrap da aplicação |
| `backend/src/app.module.ts` | Container DI raiz |
| `backend/prisma/schema.prisma` | Schema completo do banco |
| `backend/src/modules/whatsapp/flow-engine.service.ts` | Robô de saudação e menu |
| `backend/src/modules/whatsapp/waha-webhook.controller.ts` | Recepção de eventos WAHA |
| `backend/src/modules/whatsapp/waha-polling.service.ts` | Polling WAHA (30s) |
| `backend/src/modules/whatsapp/whatsapp.service.ts` | Abstração WAHA/Meta |
| `backend/src/modules/conversations/conversation-routing.service.ts` | Roteamento por histórico |
| `backend/src/modules/conversations/conversations.service.ts` | Lógica principal de conversas |
| `backend/src/modules/departments/department-routing.service.ts` | Atribuição e balanceamento |
| `backend/src/modules/messages/messages.service.ts` | Envio/recebimento de mensagens |
| `backend/src/modules/websocket/websocket.gateway.ts` | Gateway Socket.IO |

### Frontend

| Arquivo | Responsabilidade |
|---------|----------------|
| `frontend/src/app/dashboard/page.tsx` | Dashboard principal |
| `frontend/src/components/chat/ChatWindow.tsx` | Interface do chat |
| `frontend/src/components/chat/ConversationList.tsx` | Lista de conversas |
| `frontend/src/components/chat/MessageBubble.tsx` | Exibição de mensagem |
| `frontend/src/components/chat/MessageInput.tsx` | Input + upload de mídia |
| `frontend/src/stores/chatStore.ts` | Estado global do chat |
| `frontend/src/stores/authStore.ts` | Estado de autenticação |
| `frontend/src/hooks/useSocket.ts` | Integração Socket.IO |
| `frontend/src/hooks/useConversations.ts` | Fetching de conversas |
| `frontend/src/lib/api-client.ts` | Axios com interceptors JWT |

### Configuração e Deploy

| Arquivo | Responsabilidade |
|---------|----------------|
| `docker-compose.yml` | Infra DEV |
| `docker-compose.prod.yml` | Deploy PROD |
| `nginx/nginx.conf` | Proxy reverso |
| `.env` | Variáveis DEV |
| `.env.production.example` | Template PROD |
| `backend/Dockerfile` | Build backend |
| `frontend/Dockerfile` | Build frontend |

---

*Documento gerado em 2026-04-19. Para atualizações, editar este arquivo ou regenerar a partir do código-fonte.*
