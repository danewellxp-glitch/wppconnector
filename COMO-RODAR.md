# Como rodar o WPPConnector

## Parar a aplicação

- **`stop.bat`** – Encerra só frontend e backend (portas 3000 e 4000). Docker continua rodando.
- **`stop-all.bat`** – Encerra frontend, backend e **para os containers Docker** (Postgres, Redis, WAHA).

---

## Opção 1: Script único (Windows)

Dê dois cliques em **`start.bat`** na raiz do projeto. Ele vai:
1. Verificar o Docker
2. Abrir uma janela com o **backend** (porta 4000)
3. Abrir outra janela com o **frontend** (porta 3000)

Depois abra no navegador: **http://localhost:3000**

---

## Opção 2: Passo a passo manual

### 1. Subir o Docker (banco e serviços)

Na raiz do projeto:

```bash
docker compose up -d
```

Isso sobe: Postgres (5434), Redis (6380), WAHA (3001).

### 2. Backend

```bash
cd backend
npm install
npm run start:dev
```

Deixe rodando. O backend fica em **http://localhost:4000**.

### 3. Frontend (em outro terminal)

```bash
cd frontend
npm install
npm run dev
```

O frontend fica em **http://localhost:3000**. Acesse essa URL para usar o sistema.

---

## Se algo falhar

- **"Cannot find module"** → Rode `npm install` dentro de `backend` e de `frontend`.
- **Backend não conecta no banco** → Confira se o Docker está rodando (`docker compose ps`) e se o arquivo `backend/.env` existe com `DATABASE_URL=postgresql://whatsapp:dev_password@localhost:5434/whatsapp_db`.
- **Frontend não abre** → Confira se a porta 3000 está livre e se rodou `npm run dev` dentro da pasta `frontend`.
