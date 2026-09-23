# ARA — Assistente de Avarias (Unitel)

PoC de assistente RAG para apoio à resolução de avarias na manutenção de rede. Responde com base no manual do técnico e cita sempre a secção/página.

![Conversa](docs/screenshots/3-conversa.png)

## Estrutura

```
backend/    Fastify + Prisma + pgvector + Claude API
  src/services/chunker.ts     PDF → chunks por secção (Sprint 1)
  src/services/embeddings.ts  Voyage AI (produção) | local (dev)
  src/services/retrieval.ts   busca semântica top-N (Sprint 2)
  src/services/llm.ts         system prompt + Claude em streaming (Sprint 3)
  src/routes/                 auth, search, chat (SSE), conversas, feedback
frontend/   React 18 + Vite + Tailwind v4 (Sprint 4)
deploy/     PM2 + Nginx para o VPS
```

## Arranque local

Requisitos: Node 20+, Postgres 16 com `pgvector` (ou `docker compose up -d`).

```bash
# Backend
cd backend
cp .env.example .env          # preencher ANTHROPIC_API_KEY, VOYAGE_API_KEY, JWT_SECRET
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

Sem chaves de API: `EMBEDDINGS_PROVIDER=local` e `RETRIEVAL_MIN_SCORE=0.15` permitem testar ingestão e pesquisa (qualidade semântica fraca). Há um PDF fictício em `backend/fixtures/manual-exemplo.pdf`.

## Validar o retrieval (Sprint 2)

```bash
npm run search -- "alarme VSWR elevado" 5
```
Ou no separador **Pesquisa** da interface.

## API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | `{username, password}` → `{token, user}` |
| GET | `/api/search?q=&topK=&category=` | busca semântica (sem LLM) |
| POST | `/api/chat` | `{question, conversationId?, category?}` → SSE (`meta`, `delta`, `done`, `error`) |
| GET/DELETE | `/api/conversations[/:id]` | histórico do técnico |
| POST | `/api/messages/:id/feedback` | `{rating: 1 \| -1 \| null}` — usado na validação (Sprint 5) |

## Deploy (VPS, fora da rede Unitel)

```bash
cd backend && npm ci && npm run build && npm run db:migrate
cd ../frontend && npm ci && npm run build   # copiar dist/ para /var/www/ara/frontend/dist
pm2 start deploy/ecosystem.config.cjs
```
Nginx: ver `deploy/nginx.conf` (inclui `proxy_buffering off` para o streaming). As fontes são servidas localmente (sem Google Fonts), porque a rede Unitel bloqueia domínios externos.

## Cores

Tokens de marca em `frontend/src/index.css` (`--color-brand-*` laranja, `--color-ink-*` grafite). Ajustar aos valores oficiais do manual de marca Unitel.
