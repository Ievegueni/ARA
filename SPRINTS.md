# SPRINTS.md — Assistente de Avarias (Unitel)

## Sprint 0 — Preparação
- Reunir manual(is) do técnico (PDF)
- Definir categorias/tipos de avaria a cobrir
- Setup do repositório, CLAUDE.md, ambiente (Postgres + pgvector)

## Sprint 1 — Ingestão e Indexação
- Extrair texto do manual
- Dividir em chunks por secção/tipo de avaria
- Gerar embeddings e guardar em pgvector
- **Entregável:** base de conhecimento indexada

## Sprint 2 — Motor de Retrieval
- Endpoint de busca semântica (pergunta → top-N chunks)
- Testes manuais de qualidade da busca (sem LLM ainda)
- **Entregável:** retrieval validado

## Sprint 3 — Integração LLM
- System prompt com regras (só responder com base no contexto, citar secção)
- Endpoint pergunta → resposta completa
- **Entregável:** API de pergunta/resposta funcional

## Sprint 4 — Interface
- Chat web simples
- Autenticação básica
- **Entregável:** interface de teste para técnicos

## Sprint 5 — Validação
- Testar com casos reais de avaria vs. diagnóstico humano
- Ajustar chunking/prompt conforme resultados
- Medir taxa de acerto
- **Entregável:** relatório de validação do PoC

## Fora de Escopo (PoC)
- Fine-tuning de modelo
- Integração com sistemas de tickets/OTS
- Multi-idioma
