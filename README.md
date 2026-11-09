# Shopee Affiliate Miner

## Comparação de stacks

O projeto original Vite/FastAPI/SQLite foi preservado. A nova implementação preparada para publicação está em [platform/](platform/), usando Next.js estático, Supabase Auth/PostgreSQL/Storage com RLS e Cloudflare Pages. Leia [ARCHITECTURE_COMPARISON.md](ARCHITECTURE_COMPARISON.md) para a matriz de funcionalidades e [platform/README.md](platform/README.md) para configurar e publicar a nova versão.

Primeiro incremento funcional do painel administrativo. O modo demo usa registros ficticios identificados, sem scraping, sem chamadas a Shopee e sem links de afiliado inventados.

## Arquitetura

- `frontend/`: React, TypeScript, Vite, Tailwind CSS, Recharts e Lucide.
- `storefront/`: vitrine publica independente, React, TypeScript e Vite.
- `backend/`: FastAPI, SQLAlchemy, Alembic, autenticacao administrativa e servico demo.
- Persistencia: SQLite local por padrao; PostgreSQL por `DATABASE_URL`.
- Shopee: adaptador oficial ainda nao ativo. Nao configure producao sem a documentacao aprovada para sua conta.
- Telegram: credenciais sao lidas apenas pelo backend. A publicacao ainda nao e habilitada nesta etapa.

## Desenvolvimento

Backend, a partir de `backend/`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend, a partir de `frontend/`:

```powershell
npm install
npm run dev
```

Vitrine publica, a partir de `storefront/`:

```powershell
npm install
npm run dev
```

Abra o painel em `http://localhost:5173`, a vitrine em `http://localhost:5174` e a API em `http://localhost:8000`. Na primeira visita ao painel, crie o usuario administrativo com senha de pelo menos 12 caracteres.

## Ofertas manuais

Em **Ofertas manuais**, cadastre o produto e salve como rascunho ou publique. A publicacao exige uma URL HTTPS em `shopee.com.br`, seus subdominios ou `shope.ee`; esta validacao so verifica o dominio, nao confirma que o link pertence a um afiliado ou atribui comissao. O preco anterior e a comissao sao dados informados manualmente. A vitrine publica apenas ofertas manuais publicadas com link preenchido; produtos DEMO e rascunhos sao excluidos.

Os dois frontends podem ser publicados separadamente, no mesmo repositorio. Configure `VITE_API_URL` no build de cada frontend com a URL da API e `FRONTEND_ORIGINS` no backend com as origens HTTPS permitidas, separadas por virgula. `VITE_STOREFRONT_URL` controla o link da vitrine exibido no painel.

Para PostgreSQL, configure `DATABASE_URL` no ambiente do backend e rode `alembic upgrade head`. Antes de qualquer deploy, defina `SECRET_KEY` com um valor aleatorio forte e `APP_ENV=production`.

## Escopo desta etapa

Incluido: autenticacao inicial e login, banco persistente, ofertas DEMO, cadastro manual e edicao de ofertas, status de publicacao, vitrine publica filtrada, deduplicacao, historico de mineracao, filtros por nome/categoria/pontuacao, dashboard, calculo objetivo de pontuacao e confianca, e status de integracoes.

Ainda nao habilitado: credenciais Shopee, geracao de links oficiais, publicacao Telegram, IA generativa, aprovacao e fila de publicacao, campanhas/conversoes e agendamento automatico. O painel nao apresenta essas funcoes como ativas.