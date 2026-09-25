# Deploy no VPS — Assistente de Avarias (Unitel)

Guia passo a passo para publicar a aplicação num VPS próprio (fora da rede Unitel, conforme o `CLAUDE.md`). Modo atual: **sem IA** (`AI_ENABLED=false`) — pesquisa por palavras-chave, sem serviços externos.

Requisitos do servidor: ver `deploy/requirements.txt`.

---

## 1. Preparar o VPS

Como root ou com sudo:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx
```

Criar um utilizador dedicado (evitar correr a aplicação como root):

```bash
sudo adduser --disabled-password --gecos "" ara
sudo mkdir -p /var/www/ara
sudo chown ara:ara /var/www/ara
```

A partir daqui, os comandos de aplicação correm como o utilizador `ara`:

```bash
sudo su - ara
```

---

## 2. Instalar o Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # confirmar v20.x ou superior
```

---

## 3. Instalar o PostgreSQL 16 + pgvector

```bash
sudo apt install -y postgresql-16 postgresql-16-pgvector
sudo systemctl enable --now postgresql
```

Criar a base de dados e o utilizador (substituir a palavra-passe):

```bash
sudo -u postgres psql -c "CREATE USER ara WITH PASSWORD 'defina-uma-palavra-passe-forte';"
sudo -u postgres psql -c "CREATE DATABASE ara OWNER ara;"
```

As extensões (`vector`, `unaccent`) são ativadas automaticamente pelas migrações no passo 6 — não é preciso criá-las à mão.

---

## 4. Obter o código

```bash
cd /var/www/ara
git clone <url-do-repositorio> .
git checkout claude/focused-wright-j2rags   # ou o branch/tag a publicar
```

---

## 5. Configurar o backend

```bash
cd /var/www/ara/backend
cp .env.example .env
nano .env
```

Editar no mínimo:

```bash
DATABASE_URL="postgresql://ara:<palavra-passe-do-passo-3>@localhost:5432/ara"
PORT=3000
HOST=127.0.0.1                    # só o Nginx local acede; não expor à internet
CORS_ORIGIN=https://ara.exemplo.ao   # domínio real da aplicação
JWT_SECRET=<gerar com: openssl rand -base64 48>
AI_ENABLED=false                   # modo atual: sem IA
```

As variáveis `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY` só são necessárias quando `AI_ENABLED=true` (ver README, secção "Modos").

---

## 6. Instalar dependências, compilar e migrar a base de dados

```bash
cd /var/www/ara/backend
npm ci
npm run db:migrate     # aplica as migrações (cria tabelas, pgvector, unaccent, índice de pesquisa)
npm run build          # compila TypeScript → dist/
```

Criar o primeiro utilizador administrador:

```bash
npm run user:create -- admin 'PalavraPasse123!' "Nome do Administrador" --admin
```

Criar utilizadores técnicos (repetir conforme necessário):

```bash
npm run user:create -- jsilva 'OutraPalavraPasse!' "João Silva" --section "Rede Luanda"
```

---

## 7. Compilar o frontend

```bash
cd /var/www/ara/frontend
npm ci
npm run build           # gera frontend/dist/ (ficheiros estáticos)
```

---

## 8. Arrancar o backend com PM2

```bash
sudo npm install -g pm2   # se ainda não estiver instalado
cd /var/www/ara
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

Configurar o arranque automático do PM2 no boot (correr o comando que o PM2 imprimir, como root):

```bash
pm2 startup
# copiar e executar o comando sudo que aparece no ecrã
```

Verificar que está a correr:

```bash
pm2 status
pm2 logs ara-api --lines 50
curl http://127.0.0.1:3000/api/health
# esperado: {"ok":true,"mode":"pesquisa","model":null}
```

---

## 9. Configurar o Nginx

```bash
sudo cp /var/www/ara/deploy/nginx.conf /etc/nginx/sites-available/ara
sudo nano /etc/nginx/sites-available/ara   # ajustar server_name para o domínio real
sudo ln -s /etc/nginx/sites-available/ara /etc/nginx/sites-enabled/
sudo nginx -t            # valida a configuração
sudo systemctl reload nginx
```

---

## 10. Ativar HTTPS (recomendado)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ara.exemplo.ao
```

O certbot edita a configuração do Nginx automaticamente e configura a renovação (verificar com `sudo certbot renew --dry-run`).

---

## 11. Carregar o manual do técnico

1. Abrir `https://ara.exemplo.ao` no navegador e entrar com o utilizador administrador criado no passo 6.
2. Separador **Manuais** → arrastar o PDF → indicar título e versão → **Carregar manual**.
3. Confirmar que aparece "Manual pronto a usar", com o número de páginas e secções.

Alternativa por linha de comandos, diretamente no servidor:

```bash
cd /var/www/ara/backend
npm run ingest -- /caminho/para/manual.pdf --title "Manual do Técnico" --version 1.0
```

---

## 12. Testar

- `https://ara.exemplo.ao/api/health` → `{"ok":true,"mode":"pesquisa",...}`
- Entrar com um utilizador técnico e fazer uma pergunta com termos do manual (ex.: nome de um alarme).
- Confirmar no telemóvel: layout e envio de mensagens.

---

## Publicar uma atualização

```bash
cd /var/www/ara
git pull origin claude/focused-wright-j2rags

cd backend
npm ci
npm run db:migrate
npm run build
pm2 restart ara-api

cd ../frontend
npm ci
npm run build
# não precisa de reiniciar nada: o Nginx serve os ficheiros de dist/ diretamente
```

---

## Comandos úteis

| Ação | Comando |
|---|---|
| Ver logs do backend | `pm2 logs ara-api` |
| Reiniciar o backend | `pm2 restart ara-api` |
| Estado dos processos | `pm2 status` |
| Testar a configuração do Nginx | `sudo nginx -t` |
| Reiniciar o Nginx | `sudo systemctl reload nginx` |
| Backup da base de dados | `pg_dump -U ara ara > backup-$(date +%F).sql` |

---

## Checklist de segurança

- [ ] `JWT_SECRET` gerado aleatoriamente (nunca o valor de exemplo)
- [ ] Palavra-passe da base de dados forte e não reutilizada
- [ ] `HOST=127.0.0.1` no backend (só acessível via Nginx local, não exposto diretamente)
- [ ] HTTPS ativo (certbot)
- [ ] Firewall do VPS (`ufw`) a permitir apenas portas 22 (SSH), 80 e 443
- [ ] Backups regulares da base de dados (cron com `pg_dump`)
- [ ] Acesso SSH por chave, não por palavra-passe

---

## Ativar a IA mais tarde

Quando o projeto decidir ligar a IA (Sprint 3 do `SPRINTS.md`):

1. Obter chaves da Anthropic (`ANTHROPIC_API_KEY`) e da Voyage AI (`VOYAGE_API_KEY`).
2. Em `backend/.env`: preencher as duas chaves e mudar `AI_ENABLED=true`.
3. `pm2 restart ara-api`.
4. Gerar os embeddings dos manuais já carregados: `cd backend && npm run embed:backfill`.
