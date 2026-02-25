# Guia de Configuração e Implantação do Servidor de Produção (WPPConnector)

Este documento centraliza o passo a passo para colocar a aplicação no ar a partir de um servidor Linux recém-criado.

## 1. Preparação Inicial e Instalação de Requisitos

1. Conecte-se ao seu servidor via SSH: `ssh usuario@ip_do_servidor`
2. Execute, linha por linha, os comandos listados no arquivo `requisitos-servidor.txt` que foi gerado para instalar: **Node.js, PostgreSQL, Redis e Nginx**.

## 2. Configurando o Banco de Dados (PostgreSQL)

O WPPConnector requer um usuário e um banco de dados dedicados.

```bash
# Entre no modo interativo do PostgreSQL
sudo -u postgres psql

# Crie o banco de dados e o usuário (lembre-se de trocar 'SuaSenhaForte' por uma senha real)
CREATE DATABASE whatsapp_db;
CREATE USER wppuser WITH ENCRYPTED PASSWORD 'SuaSenhaForte';
GRANT ALL PRIVILEGES ON DATABASE whatsapp_db TO wppuser;
\c whatsapp_db
GRANT ALL ON SCHEMA public TO wppuser;
\q
```

## 3. Baixando o Código Fonte (Repositório)

```bash
# Vá para o diretório de destino (geralmente usamos /var/www ou a home do usuário)
cd ~
# Clone o repositório do seu sistema
git clone URL_DO_SEU_REPOSITORIO /home/usuario/wppconnector
cd /home/usuario/wppconnector
```

## 4. Configuração das Variáveis de Ambiente (`.env`)

Dentro da pasta do projeto, você precisa configurar as variáveis no backend e no frontend.

### Backend (`/backend/.env`)
Crie o arquivo: `nano backend/.env`
```env
# Banco de Dados configurado no passo 2
DATABASE_URL="postgresql://wppuser:SuaSenhaForte@localhost:5432/whatsapp_db?schema=public"

# Segurança
JWT_SECRET="gere_uma_chave_segura_longa_e_aleatoria_aqui"

# URLs
FRONTEND_URL="https://seu-dominio.com.br"
PORT=4000
```

### Frontend (`/frontend/.env.production`)
Crie o arquivo: `nano frontend/.env.production`
```env
NEXT_PUBLIC_API_URL="https://seu-dominio.com.br/api"
NEXT_PUBLIC_WS_URL="https://seu-dominio.com.br"
```

## 5. Instalando Dependências e Gerando o Schema

```bash
# Instalando pacotes do Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy

# Instalando pacotes do Frontend
cd ../frontend
npm install
```

## 6. Build e Execução

Atualmente, o projeto conta com um script `start-production.sh` que usa `nohup`. 
Você pode usá-lo ou, melhor ainda, utilizar o **PM2** (instalado no passo 1) para que as aplicações reiniciem sozinhas se o servidor for reiniciado.

**Via PM2 (Recomendado):**
```bash
# No diretório do projeto, execute o build de ambos
cd backend && npm run build
cd ../frontend && npm run build

# Inicie o Backend no PM2
cd ../backend
pm2 start dist/main.js --name "wpp-backend"

# Inicie o Frontend no PM2
cd ../frontend
pm2 start npm --name "wpp-frontend" -- start

# Salve a lista do PM2 para iniciar com o servidor
pm2 save
```

## 7. Configurando o Nginx (Proxy Reverso e SSL)

Para que os usuários acessem o site sem digitar portas e com segurança SSL (HTTPS), configuraremos o Nginx.

```bash
# Crie um arquivo de configuração para o seu site
sudo nano /etc/nginx/sites-available/wppconnector
```

Cole o conteúdo abaixo, alterando `seu-dominio.com.br`:
```nginx
server {
    listen 80;
    server_name seu-dominio.com.br;

    # Rota para o Backend (API REST)
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Rota para o WebHooks da Meta (WhatsApp)
    location /webhooks/ {
        proxy_pass http://localhost:4000/webhooks/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Rota para WebSockets do NestJS (Socket.IO)
    location /socket.io/ {
        proxy_pass http://localhost:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Rota principal para o Frontend Next.js
    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Ative a configuração e reinicie o Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/wppconnector /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Habilitando o Certificado SSL (HTTPS) Opcional

Se você tiver um domínio configurado:
```bash
sudo certbot --nginx -d seu-dominio.com.br
```

## Parabéns! 🎉
Seu sistema agora deve estar rodando e protegido, pronto para receber tráfego! O Webhook do WhatsApp precisa ser configurado no painel de Desenvolvedor da Meta apontando para `https://seu-dominio.com.br/webhooks/meta` (ou a rota definida no seu controlador de webhook).
