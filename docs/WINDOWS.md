# Correr no Windows (localhost)

Guia para correr o Assistente de Avarias no seu computador Windows, para testes. A aplicação fica em **http://localhost:5173**.

## 1. Instalar os programas necessários (uma vez)

| Programa | Para quê | Onde obter |
|---|---|---|
| **Node.js LTS** (20.19 ou superior) | Corre o backend e o frontend | https://nodejs.org → botão "LTS" → instalar com as opções por omissão |
| **Docker Desktop** | Base de dados PostgreSQL com pgvector | https://www.docker.com/products/docker-desktop/ → instalar e **reiniciar o Windows** se pedir |

Notas:
- O Docker Desktop pode pedir para ativar o **WSL 2**: aceite e siga as instruções (pode pedir um reinício).
- Depois de instalar, **abra o Docker Desktop** e espere até aparecer "Engine running".
- O PostgreSQL **não** é instalado no Windows: corre dentro do Docker (o pgvector, necessário para o projeto, é difícil de instalar diretamente no Windows).

## 2. Obter o projeto

Descarregue o código do GitHub (branch `claude/focused-wright-j2rags` → **Code → Download ZIP**) e extraia-o para uma pasta, por exemplo `C:\ARA`.

Evite pastas sincronizadas (OneDrive) — tornam a instalação muito lenta.

## 3. Instalar (uma vez)

Na pasta do projeto, faça **duplo clique em `instalar-windows.bat`**. O script:

1. verifica o Node.js e o Docker;
2. arranca a base de dados no Docker (porta **5433**, para não colidir com um PostgreSQL que já tenha instalado);
3. cria o `backend\.env` (com uma chave secreta aleatória e a IA desligada);
4. instala as dependências (alguns minutos na primeira vez — precisa de internet);
5. cria as tabelas na base de dados;
6. pergunta o **utilizador e a palavra-passe do administrador** e, opcionalmente, carrega um manual de exemplo para experimentar.

Se o Windows mostrar "O Windows protegeu o seu PC", clique em **Mais informações → Executar mesmo assim** (o ficheiro veio da internet).

Pode voltar a correr o `instalar-windows.bat` sempre que quiser (por exemplo, depois de atualizar o código): não apaga dados e mantém o `.env`.

## 4. Usar

- **Abrir:** duplo clique em **`iniciar-windows.bat`**. Abrem-se duas janelas ("ARA - backend" e "ARA - frontend") — **não as feche** enquanto usa a aplicação — e o navegador abre em http://localhost:5173.
- **Parar:** duplo clique em **`parar-windows.bat`** (ou feche as duas janelas). Os dados (manuais, vídeos, utilizadores, conversas) ficam guardados.

Os manuais e vídeos carregados ficam em `backend\storage\`; a base de dados fica num volume do Docker (`ara_ara-db`).

## 5. Ligar a IA (opcional)

1. Abra `backend\.env` no Bloco de Notas e preencha `ANTHROPIC_API_KEY=sk-ant-...` (a `VOYAGE_API_KEY` é opcional).
2. Pare e volte a iniciar (`parar-windows.bat` → `iniciar-windows.bat`).
3. Na aplicação, como administrador: botão **IA** → **Testar ligação** → ligar o interruptor.

## Problemas comuns

| Mensagem | Solução |
|---|---|
| "Node.js não encontrado" | Instale o Node.js LTS e **feche e volte a abrir** a janela (ou reinicie o Windows). |
| "O Docker Desktop não está a correr" | Abra o Docker Desktop e espere por "Engine running". |
| "Não foi possível arrancar a base de dados" / porta ocupada | Outra aplicação usa a porta 5433. Numa linha de comandos, na pasta do projeto: `set ARA_DB_PORT=5434` e depois `instalar-windows.bat` (e apague `backend\.env` antes, para ser recriado com a nova porta). |
| A janela "ARA - backend" mostra um erro e fecha o servidor | Leia a mensagem nessa janela; muitas vezes é a base de dados parada (abra o Docker Desktop) ou a porta 3000 ocupada por outro programa. |
| O navegador mostra "Não é possível aceder a este site" | Espere alguns segundos e atualize; confirme que as duas janelas "ARA" estão abertas. |

## Sem os ficheiros .bat (manual)

```powershell
docker compose up -d db                       # na pasta do projeto
cd backend;  npm ci;  npm run db:migrate;  npm run user:create -- admin 'PalavraPasse!' "Administrador" --admin
npm run dev                                   # deixar a correr
# noutra janela:
cd frontend; npm ci;  npm run dev             # abrir http://localhost:5173
```
(o `backend\.env` tem de ter `DATABASE_URL="postgresql://ara:ara@127.0.0.1:5433/ara"`)
