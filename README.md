# ARA — Assistente de Avarias (Unitel)

PoC de assistente para apoio à resolução de avarias na manutenção de rede, com base no manual do técnico. Mostra sempre a secção e a página.

## Modos

| | `AI_ENABLED=false` (atual) | `AI_ENABLED=true` |
|---|---|---|
| Pesquisa | Palavras-chave em português (Postgres full-text: sem acentos, radicais) | Semântica (Voyage + pgvector) |
| Resposta | Secções do manual mais relevantes, com os termos destacados | Texto escrito pelo Claude, com citações |
| Serviços externos | Nenhum | Anthropic + Voyage |

Para ativar a IA mais tarde: preencher as chaves em `backend/.env`, `AI_ENABLED=true`, reiniciar e correr `npm run embed:backfill` (gera os embeddings dos manuais já carregados).

![Conversa](docs/screenshots/3-conversa.png)

## Estrutura

```
backend/    Fastify + Prisma + pgvector + Claude API
  src/services/chunker.ts     PDF → chunks por secção (Sprint 1)
  src/services/retrieval.ts   pesquisa: palavras-chave (sem IA) | semântica (com IA)
  src/services/embeddings.ts  Voyage AI (só com IA)
  src/services/llm.ts         system prompt + Claude em streaming (só com IA)
  src/routes/                 auth, search, chat (SSE), conversas, feedback
frontend/   React 18 + Vite + Tailwind v4 (Sprint 4)
deploy/     PM2 + Nginx para o VPS
```

## Arranque local

Requisitos: Node 20+, Postgres 16 com `pgvector` (ou `docker compose up -d`).

```bash
# Backend
cd backend
cp .env.example .env          # definir JWT_SECRET (as chaves de IA só são precisas com AI_ENABLED=true)
npm install
npm run db:migrate
npm run user:create -- jsilva 'PalavraPasse123' "João Silva" --section "Rede Luanda"
npm run ingest -- ../manuais/manual-tecnico.pdf --title "Manual do Técnico" --version 1.0
npm run dev                   # http://localhost:3000

# Frontend
cd ../frontend
npm install
npm run dev                   # http://localhost:5173 (proxy /api → :3000)
```

Há um PDF fictício para testes em `backend/fixtures/manual-exemplo.pdf`.

## Carregar manuais

**Pela interface (recomendado):** entrar com um utilizador administrador → separador **Manuais** → arrastar o PDF, indicar título e versão → **Carregar manual**. O progresso é mostrado por etapas; no fim aparece o número de páginas e secções indexadas.

- Reenviar o mesmo título + versão substitui o manual anterior; uma versão nova fica ao lado.
- Só PDF com texto selecionável (PDF digitalizado precisa de OCR antes), máx. 100 MB.
- Criar administrador: `npm run user:create -- admin 'PalavraPasse123' "Nome" --admin`

**Pela linha de comandos (no servidor):** `npm run ingest -- manual.pdf --title "Manual do Técnico" --version 1.0`

## Testar a pesquisa

```bash
npm run search -- "alarme VSWR elevado" 5
```
Ou no separador **Pesquisa** da interface.

## API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | `{username, password}` → `{token, user}` |
| GET | `/api/health` | `{mode: "pesquisa" \| "ia"}` |
| GET | `/api/search?q=&topK=&category=` | pesquisa direta no manual |
| POST | `/api/chat` | `{question, conversationId?, category?}` → SSE (`meta`, `delta`, `done`, `error`); sem IA devolve os excertos |
| GET/DELETE | `/api/conversations[/:id]` | histórico do técnico |
| GET | `/api/documents` | manuais carregados |
| POST | `/api/documents` | (admin) multipart `title`, `version`, `file` → `202 {job}` |
| GET | `/api/documents/jobs/:id` | (admin) progresso da ingestão |
| DELETE | `/api/documents/:id` | (admin) apaga o manual e as secções |
| POST | `/api/messages/:id/feedback` | `{rating: 1 \| -1 \| null}` — usado na validação (Sprint 5) |

## Deploy (VPS, fora da rede Unitel)

Guia completo, passo a passo, em `deploy/DEPLOY.md`. Requisitos do servidor em `deploy/requirements.txt`. Resumo:

```bash
cd backend && npm ci && npm run build && npm run db:migrate
cd ../frontend && npm ci && npm run build   # copiar dist/ para /var/www/ara/frontend/dist
pm2 start deploy/ecosystem.config.cjs
```
Nginx: ver `deploy/nginx.conf` (inclui `proxy_buffering off` para o streaming). As fontes são servidas localmente (sem Google Fonts), porque a rede Unitel bloqueia domínios externos.

## Identidade visual

Logótipo Unitel em `frontend/public/` (completo, versão branca e símbolo). Cores amostradas do logótipo, em `frontend/src/index.css`: laranja `#FB8100` (`--color-brand-*`) e azul-marinho `#08003C` (`--color-navy-*`).
