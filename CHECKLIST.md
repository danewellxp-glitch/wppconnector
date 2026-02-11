# WPPConnector - Checklist de Homologacao e Deploy

---

## 1. Pre-Requisitos do Servidor

- [ ] Ubuntu Server 22.04 LTS instalado
- [ ] Acesso root ou sudo configurado
- [ ] Docker instalado (`docker --version`)
- [ ] Docker Compose plugin instalado (`docker compose version`)
- [ ] Git instalado
- [ ] UFW firewall ativo (portas 22, 80, 443)
- [ ] Dominio configurado com DNS apontando para IP do servidor
- [ ] Minimo 2GB RAM / 2 vCPU / 20GB disco

---

## 2. Configuracao do Ambiente

- [ ] Repositorio clonado em `/opt/wppconnect.io`
- [ ] Arquivo `.env` criado a partir de `.env.production.example`
- [ ] `POSTGRES_PASSWORD` alterado (senha forte, 32+ chars)
- [ ] `JWT_SECRET` gerado (256-bit random string)
- [ ] `WHATSAPP_ACCESS_TOKEN` configurado (Meta Developer Portal)
- [ ] `WHATSAPP_PHONE_NUMBER_ID` configurado
- [ ] `WHATSAPP_BUSINESS_ACCOUNT_ID` configurado
- [ ] `WEBHOOK_VERIFY_TOKEN` definido (string aleatoria)
- [ ] `NEXT_PUBLIC_API_URL` apontando para `https://seudominio.com.br/api`
- [ ] `NEXT_PUBLIC_WS_URL` apontando para `wss://seudominio.com.br`
- [ ] `FRONTEND_URL` apontando para `https://seudominio.com.br`

---

## 3. Build e Deploy

- [ ] `docker compose -f docker-compose.prod.yml build` executado sem erros
- [ ] `docker compose -f docker-compose.prod.yml up -d` executado
- [ ] Todos os containers rodando (`docker compose -f docker-compose.prod.yml ps`)
  - [ ] postgres (healthy)
  - [ ] redis (running)
  - [ ] backend (running)
  - [ ] frontend (running)
  - [ ] nginx (running)
  - [ ] certbot (exited 0 ou running)
- [ ] Migrations aplicadas automaticamente pelo backend
- [ ] Seed executado (usuario admin criado)

---

## 4. SSL / HTTPS

- [ ] Script `scripts/setup-ssl.sh` executado com dominio e email
- [ ] Certificado Let's Encrypt emitido com sucesso
- [ ] HTTPS acessivel no browser (`https://seudominio.com.br`)
- [ ] HTTP redireciona para HTTPS
- [ ] Certificado valido (sem alertas no browser)
- [ ] Cron de renovacao configurado (certbot container)

---

## 5. Testes Funcionais - Backend API

### 5.1 Autenticacao
- [ ] `POST /api/auth/login` - Login admin funciona
- [ ] `POST /api/auth/login` - Login atendente funciona
- [ ] `POST /api/auth/login` - Senha errada retorna 401
- [ ] `GET /api/auth/me` - Retorna usuario com token valido
- [ ] `GET /api/auth/me` - Retorna 401 sem token

### 5.2 Usuarios (Admin only)
- [ ] `GET /api/users` - Lista usuarios da empresa
- [ ] `POST /api/users` - Cria novo usuario
- [ ] `PATCH /api/users/:id` - Atualiza usuario
- [ ] `DELETE /api/users/:id` - Desativa usuario
- [ ] Resposta NAO contem `passwordHash`
- [ ] Agent recebe 403 em POST/PATCH/DELETE

### 5.3 Conversas
- [ ] `GET /api/conversations` - Lista conversas
- [ ] `GET /api/conversations/:id` - Detalhe da conversa
- [ ] `GET /api/conversations/:id/messages` - Lista mensagens
- [ ] `POST /api/conversations/:id/assign` - Atribui atendente
- [ ] `POST /api/conversations/:id/unassign` - Remove atribuicao
- [ ] `PATCH /api/conversations/:id/status` - Muda status
- [ ] `POST /api/conversations/:id/read` - Marca como lida

### 5.4 Mensagens
- [ ] `POST /api/messages/send` - Envia mensagem
- [ ] `GET /api/messages/search?q=texto` - Busca mensagens
- [ ] Busca case-insensitive funciona

### 5.5 Metricas
- [ ] `GET /api/metrics/dashboard` - Totais por status e mensagens
- [ ] `GET /api/metrics/conversations` - Novas conversas e tempo de resposta
- [ ] `GET /api/metrics/agents` - Performance dos atendentes

### 5.6 Auditoria (Admin only)
- [ ] `GET /api/audit` - Lista logs com paginacao
- [ ] Filtros funcionam (userId, action, entity, startDate, endDate)
- [ ] Agent recebe 403

### 5.7 Respostas Rapidas
- [ ] `GET /api/quick-replies` - Lista respostas
- [ ] `POST /api/quick-replies` - Cria resposta
- [ ] `PATCH /api/quick-replies/:id` - Atualiza resposta
- [ ] `DELETE /api/quick-replies/:id` - Desativa resposta

### 5.8 Health e Seguranca
- [ ] `GET /api/health` - Retorna status OK com DB connected
- [ ] Rate limiting funciona (429 apos 60 req/min)
- [ ] Webhook (`/webhooks/whatsapp`) NAO tem throttle

---

## 6. Testes Funcionais - Frontend

### 6.1 Paginas Carregam
- [ ] `/login` - Pagina de login renderiza
- [ ] `/dashboard` - Chat com lista de conversas
- [ ] `/dashboard/users` - Tabela de usuarios (admin only)
- [ ] `/dashboard/metrics` - Dashboard de metricas
- [ ] `/dashboard/audit` - Logs de auditoria (admin only)
- [ ] `/dashboard/settings` - Configuracoes

### 6.2 Fluxo de Autenticacao
- [ ] Login com credenciais validas redireciona para dashboard
- [ ] Login com credenciais invalidas mostra erro
- [ ] Logout limpa token e redireciona para login
- [ ] Acesso sem token redireciona para login
- [ ] Token persiste apos refresh da pagina

### 6.3 Chat
- [ ] Lista de conversas carrega com dados
- [ ] Clicar em conversa mostra historico de mensagens
- [ ] Envio de mensagem aparece na tela
- [ ] Auto-scroll para ultima mensagem
- [ ] Indicador de digitacao funciona
- [ ] Filtro de busca por nome/telefone funciona
- [ ] Filtro por status (Abertas, Em atendimento, etc.) funciona
- [ ] Painel CustomerInfo exibe dados do cliente
- [ ] Botoes Atribuir/Resolver/Arquivar funcionam

### 6.4 Usuarios (Admin)
- [ ] Tabela lista todos os usuarios
- [ ] Botao "Novo Usuario" abre modal
- [ ] Criar usuario com nome, email, senha, perfil
- [ ] Editar usuario (nome, perfil)
- [ ] Desativar usuario com confirmacao
- [ ] Reativar usuario
- [ ] Agent ve mensagem "Acesso restrito"

### 6.5 Metricas
- [ ] Cards de status exibem totais corretos
- [ ] Mensagens hoje (recebidas/enviadas)
- [ ] Tempo medio de primeira resposta
- [ ] Tabela de performance dos atendentes

### 6.6 Auditoria (Admin)
- [ ] Tabela de logs carrega
- [ ] Filtros por usuario, acao, entidade, data
- [ ] Botao "Carregar mais" (paginacao)
- [ ] Agent ve mensagem "Acesso restrito"

### 6.7 Respostas Rapidas
- [ ] Icone de raio aparece no input de mensagem
- [ ] Dropdown lista respostas cadastradas
- [ ] Clicar preenche o campo de mensagem

### 6.8 Scroll
- [ ] Pagina de Settings rola para baixo
- [ ] Pagina de Metricas rola para baixo
- [ ] Pagina de Audit rola para baixo
- [ ] Pagina de Users rola para baixo

---

## 7. Integracao WhatsApp

- [ ] Conta WhatsApp Business API criada no Meta Developer Portal
- [ ] App criado em modo teste
- [ ] Webhook URL registrada: `https://seudominio.com.br/webhooks/whatsapp`
- [ ] Webhook verificado com sucesso (challenge respondido)
- [ ] Campos subscritos: messages, message_deliveries, message_reads
- [ ] Enviar mensagem do WhatsApp pessoal para numero teste
- [ ] Mensagem aparece no dashboard em tempo real
- [ ] Responder pelo dashboard
- [ ] Resposta chega no WhatsApp do cliente
- [ ] Status de mensagem atualiza (enviada > entregue > lida)
- [ ] Imagens recebidas exibem no chat
- [ ] Documentos recebidos exibem no chat
- [ ] Audio recebido exibe player no chat

---

## 8. WebSocket / Tempo Real

- [ ] Conexao WebSocket estabelece apos login
- [ ] Nova mensagem recebida aparece sem refresh
- [ ] Mensagem enviada aparece para o remetente
- [ ] Status de mensagem atualiza em tempo real
- [ ] Indicador de digitacao aparece/desaparece
- [ ] Reconexao automatica apos queda de conexao
- [ ] Notificacao do browser quando aba nao focada

---

## 9. Backup e Monitoramento

- [ ] Script `scripts/backup.sh` executado manualmente com sucesso
- [ ] Backup PostgreSQL gerado (`.sql.gz`)
- [ ] Backup Redis gerado (`.rdb`)
- [ ] Cron configurado para backup diario as 2h
  ```
  0 2 * * * /opt/wppconnect.io/scripts/backup.sh >> /var/log/wpp-backup.log 2>&1
  ```
- [ ] Backups antigos (7+ dias) removidos automaticamente
- [ ] `docker stats` mostra uso de recursos aceitavel
- [ ] Logs acessiveis via `docker compose logs -f [servico]`

---

## 10. Performance e Producao

- [ ] Tempo de carregamento da pagina < 3s
- [ ] API responde em < 200ms (endpoints simples)
- [ ] Sem erros no console do browser
- [ ] Sem erros nos logs do backend
- [ ] PostgreSQL com conexoes estaveis
- [ ] Redis respondendo corretamente
- [ ] Nginx servindo assets estaticos com cache

---

## 11. Seguranca Final

- [ ] Senhas no `.env` sao fortes e unicas
- [ ] `.env` NAO esta no repositorio git
- [ ] CORS configurado apenas para dominio de producao
- [ ] HTTPS obrigatorio (HTTP redireciona)
- [ ] Rate limiting ativo (60 req/min por IP)
- [ ] Webhook tem verify token configurado
- [ ] Passwords hash com bcrypt (10 rounds)
- [ ] JWT expira em 7 dias
- [ ] Inputs validados (ValidationPipe + whitelist)
- [ ] Respostas da API nao vazam dados sensiveis

---

## Assinaturas

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Desenvolvedor | | | |
| QA / Testador | | | |
| Product Owner | | | |
| DevOps | | | |

---

> Gerado automaticamente para o projeto WPPConnector
> Versao: MVP 1.0 | Data: ___/___/______
