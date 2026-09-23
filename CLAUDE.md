# CLAUDE.md — Assistente de IA para Resolução de Avarias (Unitel)

## Visão Geral
PoC de assistente de IA para apoio à resolução de avarias na manutenção de rede da Unitel. Responde a perguntas dos técnicos com base no conteúdo do manual do técnico, usando arquitetura RAG (Retrieval-Augmented Generation) — sem fine-tuning de modelo.

## Objetivo
Reduzir tempo de diagnóstico de avarias, disponibilizando o conhecimento do manual de forma pesquisável e conversacional.

## Arquitetura

```
Técnico → Pergunta
            ↓
     Serviço de Retrieval (busca semântica nos chunks do manual)
            ↓
     Chunks relevantes + Pergunta → Prompt
            ↓
     Claude API (LLM)
            ↓
     Resposta (com referência à secção do manual)
```

## Stack Técnico
- Backend: Node.js 20 + Fastify
- Base de dados: PostgreSQL + extensão `pgvector`
- ORM: Prisma
- LLM: Claude API (Anthropic)
- Frontend: React 18 + Vite + Tailwind (chat)
- Deploy: VPS próprio (PM2 + Nginx) — **fora** da rede Unitel (ver Restrições)

## Modelo de Dados (esboço Prisma)
- `Document` — manual, versão, secção
- `Chunk` — documentId, texto, embedding (vector), metadata (categoria de avaria, página)
- `User` — técnico, secção, autenticação
- `Conversation` / `Message` — histórico de perguntas e respostas

## Componentes
1. **Ingestão do Manual** — extração de texto (PDF → texto), divisão em chunks por secção/tipo de avaria
2. **Motor de Retrieval** — busca semântica (embedding da pergunta vs. embeddings dos chunks), devolve top-N chunks
3. **Serviço de Chat/LLM** — monta prompt com chunks + pergunta, chama Claude API, devolve resposta
4. **Interface Web** — chat simples para o técnico

## Regras do System Prompt
- Responder apenas com base nos chunks fornecidos
- Se não houver contexto suficiente, responder "não sei" em vez de inventar procedimento
- Citar sempre a secção/página do manual de onde veio a informação

## Restrições / Riscos
- Servidor Unitel (RHEL7) tem firewall restritivo — bloqueia domínios externos (claude.ai, GitHub, registry.npmjs.org). Chamadas à API do Claude não devem depender dessa rede.
- Mitigação: backend e chamadas ao LLM correm no VPS próprio; só a interface é acedida a partir da rede Unitel.
- Qualidade das respostas depende diretamente da qualidade do chunking do manual.

## Critérios de Sucesso do PoC
- Respostas corretas validadas por técnicos em casos reais de avaria
- Resposta sempre rastreável a uma secção do manual
- Feedback qualitativo positivo dos técnicos que testarem
