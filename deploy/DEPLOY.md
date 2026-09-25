# Deploy no VPS — Assistente de Avarias (Unitel)

Guia passo a passo para publicar a aplicação num VPS já com outros projetos a correr. Modo atual: **sem IA** (`AI_ENABLED=false`) — pesquisa por palavras-chave, sem serviços externos.

Requisitos: ver `deploy/requirements.txt`.

## ⚠️ VPS partilhado — ler antes de começar

Este servidor já tem outros projetos. Cada passo abaixo foi pensado para **não afetar o que já lá está**, mas confirme sempre antes de agir:

- **Não instalar Node globalmente por cima do que já existe.** Um `apt install nodejs` ou um NodeSource novo pode mudar a versão de Node que outros projetos usam e partir algo que já corre. Preferir **nvm** (Node Version Manager) por utilizador (passo 2).
- **Não usar `sudo apt upgrade -y` às cegas.** Atualiza pacotes de sistema que outros projetos podem depender de versões específicas. Se for mesmo preciso atualizar o sistema, fazer isso é uma decisão separada, com quem gere o VPS.
- **Confirmar que a porta está livre** antes de configurar o backend (passo 5).
- **Nome da base de dados e do utilizador Postgres não podem colidir** com os já existentes (passo 3).
- **Nginx: acrescentar um novo ficheiro, nunca editar os `server {}` de outros sites.** Testar sempre com `nginx -t` antes de `reload` (nunca `restart`, que corta as ligações ativas de todos os sites).
- **PM2: usar um nome de processo único** (`ara-api`) e nunca `pm2 delete all` ou `pm2 kill` — isso para os processos de outros projetos também.
- **Firewall (`ufw`) e certbot:** só acrescentar regras/domínios novos, nunca remover os existentes.

Sempre que houver dúvida sobre se algo é partilhado ou exclusivo desta aplicação, perguntar a quem administra o VPS antes de continuar.

---

## 1. Levantamento inicial (antes de instalar seja o que for)

Correr estes comandos primeiro e guardar o resultado — servem para não colidir com o que já existe:

```bash
node -v; npm -v                          # Node já instalado? Que versão?
which nvm || echo "sem nvm"              # nvm já configurado?
sudo -u postgres psql -c "\du"           # utilizadores Postgres existentes
sudo -u postgres psql -c "\l"            # bases de dados existentes
pm2 list                                 # processos PM2 já a correr (e as suas portas)
sudo ss -tlnp | grep -E ':(80|443|3000|5432)\b'   # portas já ocupadas
ls /etc/nginx/sites-enabled/             # sites Nginx já configurados
sudo ufw status                          # regras de firewall existentes
```

Se a porta `3000` já estiver ocupada, escolher outra (ex.: `3001`) e usá-la em todos os passos seguintes (`.env`, `nginx.conf`).

---

## 2. Node.js 20 — sem tocar no que já existe

**Se já houver Node 20+ instalado e partilhado por outros projetos**, usar essa versão e passar ao passo 3.

**Caso contrário**, instalar via **nvm**, isolado por utilizador, sem mexer num Node global que outros projetos possam usar:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node -v   # confirmar v20.x
```

Isto instala o Node só para o utilizador atual, sem alterar `/usr/bin/node` nem afetar outros projetos que usem uma versão diferente.

---

## 3. Utilizador e base de dados dedicados

Criar um utilizador de sistema **só para esta aplicação** (não reutilizar um utilizador de outro projeto):

```bash
sudo adduser --disabled-password --gecos "" ara
sudo mkdir -p /var/www/ara
sudo chown ara:ara /var/www/ara
sudo su - ara
```

PostgreSQL: **confirmar que os nomes `ara` (utilizador) e `ara` (base de dados) estão livres** no levantamento do passo 1. Se já existir um utilizador ou base de dados com esse nome (de outro projeto), escolher outro nome (ex.: `ara_avarias`) e usá-lo de forma consistente daqui em diante.

```bash
sudo -u postgres psql -c "CREATE USER ara WITH PASSWORD 'defina-uma-palavra-passe-forte';"
sudo -u postgres psql -c "CREATE DATABASE ara OWNER ara;"
```

Se o Postgres do VPS for anterior à versão 16, confirmar que o `pgvector` está disponível para essa versão antes de prosseguir (`apt search pgvector`), ou pedir a instalação a quem gere o VPS — não convém atualizar o Postgres de um servidor partilhado só por causa deste projeto.

As extensões (`vector`, `unaccent`) são ativadas pela própria migração da aplicação (passo 6), dentro da base de dados `ara` — não afetam as bases de dados de outros projetos.

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
PORT=3000                          # ou outra porta livre, confirmada no passo 1
HOST=127.0.0.1                     # só o Nginx local acede; nunca expor 0.0.0.0
CORS_ORIGIN=https://ara.exemplo.ao   # domínio ou subdomínio real desta aplicação
JWT_SECRET=<gerar com: openssl rand -base64 48>
AI_ENABLED=false                   # modo atual: sem IA
```

`HOST=127.0.0.1` é importante num VPS partilhado: garante que o backend só é acessível através do Nginx local, nunca diretamente pela internet nem por outros serviços do servidor.

---

## 6. Instalar dependências, compilar e migrar a base de dados

```bash
cd /var/www/ara/backend
npm ci
npm run db:migrate     # cria as tabelas desta aplicação; não toca noutras bases de dados
npm run build
```

Criar o primeiro utilizador administrador:

```bash
npm run user:create -- admin 'PalavraPasse123!' "Nome do Administrador" --admin
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

**Verificar primeiro** se o PM2 já está instalado (`pm2 -v`) — é normal já estar, se o VPS corre outros projetos Node. Só instalar se faltar:

```bash
pm2 -v || sudo npm install -g pm2
```

```bash
cd /var/www/ara
pm2 start deploy/ecosystem.config.cjs   # processo chamado "ara-api" — não colide com outros
pm2 save
```

**Nunca** correr `pm2 delete all`, `pm2 kill` ou `pm2 restart all` — isso afeta os processos de outros projetos. Para esta aplicação, usar sempre `pm2 restart ara-api` / `pm2 logs ara-api` / `pm2 stop ara-api`, pelo nome.

Se for a primeira vez que o PM2 é configurado neste VPS (`pm2 startup` nunca foi corrido antes por nenhum projeto), configurar o arranque automático:

```bash
pm2 startup
# copiar e executar o comando sudo que aparece no ecrã
```

Se já existir configuração de arranque do PM2 (outro projeto já fez isto), **não correr `pm2 startup` outra vez** — basta o `pm2 save` acima.

Verificar:

```bash
pm2 status
curl http://127.0.0.1:3000/api/health
# esperado: {"ok":true,"mode":"pesquisa","model":null}
```

---

## 9. Configurar o Nginx — só adicionar, nunca editar sites existentes

```bash
sudo cp /var/www/ara/deploy/nginx.conf /etc/nginx/sites-available/ara
sudo nano /etc/nginx/sites-available/ara   # ajustar server_name para o domínio/subdomínio real
sudo ln -s /etc/nginx/sites-available/ara /etc/nginx/sites-enabled/
sudo nginx -t            # valida TODA a configuração do Nginx, incluindo os outros sites
sudo systemctl reload nginx   # "reload", nunca "restart": não corta ligações ativas de outros sites
```

Se `nginx -t` acusar erro, o problema pode estar noutro ficheiro de outro projeto — ler a mensagem com atenção antes de alterar seja o que for fora de `sites-available/ara`.

---

## 10. Ativar HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx   # normalmente já instalado se outro site usa HTTPS
sudo certbot --nginx -d ara.exemplo.ao
```

O certbot só altera o `server {}` do domínio indicado (`ara.exemplo.ao`); os certificados de outros domínios não são tocados.

---

## 11. Firewall

Confirmar no levantamento do passo 1 que as portas 80/443 já estão abertas (é natural, se já há sites a correr). **Não é preciso abrir a porta do backend** (3000): fica só acessível via `127.0.0.1`. Só acrescentar uma regra se o `ufw status` mostrar que 80/443 ainda não estão libertas:

```bash
sudo ufw allow 'Nginx Full'
```

Nunca correr `ufw reset` ou remover regras existentes.

---

## 12. Carregar o manual do técnico

1. Abrir `https://ara.exemplo.ao` e entrar com o utilizador administrador criado no passo 6.
2. Separador **Manuais** → arrastar o PDF → indicar título e versão → **Carregar manual**.
3. Confirmar "Manual pronto a usar".

Alternativa, diretamente no servidor:

```bash
cd /var/www/ara/backend
npm run ingest -- /caminho/para/manual.pdf --title "Manual do Técnico" --version 1.0
```

---

## 13. Testar

- `https://ara.exemplo.ao/api/health` → `{"ok":true,"mode":"pesquisa",...}`
- Confirmar que **os outros sites do VPS continuam a responder normalmente** depois do reload do Nginx.
- Entrar com um utilizador técnico e fazer uma pergunta com termos do manual.
- Testar no telemóvel: layout e envio de mensagens.

---

## Publicar uma atualização

```bash
cd /var/www/ara
git pull origin claude/focused-wright-j2rags

cd backend
npm ci
npm run db:migrate
npm run build
pm2 restart ara-api        # só este processo, nunca "restart all"

cd ../frontend
npm ci
npm run build
# não precisa de reiniciar nada: o Nginx serve os ficheiros de dist/ diretamente
```

---

## Comandos úteis (sempre pelo nome do processo/site desta aplicação)

| Ação | Comando |
|---|---|
| Ver logs do backend | `pm2 logs ara-api` |
| Reiniciar só este backend | `pm2 restart ara-api` |
| Estado de todos os processos (só para ver) | `pm2 status` |
| Testar a configuração do Nginx | `sudo nginx -t` |
| Aplicar alterações ao Nginx sem cortar outros sites | `sudo systemctl reload nginx` |
| Backup da base de dados desta aplicação | `pg_dump -U ara ara > backup-$(date +%F).sql` |

---

## Checklist de segurança

- [ ] Confirmado o levantamento do passo 1 antes de instalar/alterar seja o que for
- [ ] Node instalado via nvm (não substituiu o Node de outros projetos)
- [ ] Nome de utilizador e base de dados Postgres não colidem com os existentes
- [ ] `JWT_SECRET` gerado aleatoriamente
- [ ] Palavra-passe da base de dados forte e não reutilizada de outro projeto
- [ ] `HOST=127.0.0.1` no backend
- [ ] HTTPS ativo, só no domínio desta aplicação
- [ ] Processo PM2 com nome próprio (`ara-api`); nunca comandos "all"
- [ ] Nginx: `nginx -t` antes de qualquer `reload`
- [ ] Outros sites/serviços do VPS confirmados a funcionar depois do deploy
- [ ] Backups regulares da base de dados desta aplicação

---

## Ativar a IA mais tarde

Quando o projeto decidir ligar a IA (Sprint 3 do `SPRINTS.md`):

1. Obter chaves da Anthropic (`ANTHROPIC_API_KEY`) e da Voyage AI (`VOYAGE_API_KEY`).
2. Em `backend/.env`: preencher as duas chaves e mudar `AI_ENABLED=true`.
3. `pm2 restart ara-api`.
4. Gerar os embeddings dos manuais já carregados: `cd backend && npm run embed:backfill`.
