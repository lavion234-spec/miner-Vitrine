# Garimpo de Ofertas — Next.js + Supabase + Cloudflare Pages

Aplicação estática Next.js App Router, separada dos protótipos locais `frontend/`, `storefront/` e `backend/`. Sem variáveis Supabase, a interface explica a configuração pendente e não inventa produtos.

## Rodar localmente

```powershell
cd platform
npm ci
Copy-Item .env.example .env.local
```

Preencha em `.env.local` somente:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

A chave `service_role` não é necessária no navegador nem em `.env.local`. Ela só é usada pela Cloudflare Pages Function de convite e deve ser configurada como segredo no Cloudflare.

No SQL Editor do Supabase, aplique `supabase/migrations/0001_initial.sql`; depois execute `npm run dev` e abra `http://localhost:3000`.

### Primeiro OWNER

1. Crie o primeiro usuário em Supabase Auth (ou convide-o pelo dashboard).
2. O trigger cria o perfil inicial com função `EDITOR`, sem aceitar função enviada pelo navegador.
3. No SQL Editor Supabase, promova esse usuário uma única vez: `update public.profiles set role = 'OWNER' where email = 'SEU_EMAIL';`.
4. Entre em `/admin/`. Apenas esse OWNER pode convidar contas ADMIN/EDITOR pela Pages Function.

No Supabase Auth, defina `Site URL` como o endereço `pages.dev` e permita esse endereço com `/admin/` nas redirect URLs para que convites retornem ao painel.

Usuários aceitam senha, link de convite e login pelo Supabase Auth. Não armazenamos senha própria.

## Funcionalidades

- Vitrine: produtos ativos, destaque, categoria, texto de busca, faixa de preço, detalhe por ID e disclosure de afiliado.
- `/go/?id=UUID&campaign=UUID`: consulta um produto ativo, valida domínio e HTTPS, registra somente produto/horário/campanha e redireciona ao link salvo no banco. Nenhum dado pessoal é coletado.
- Admin: login, catálogo CRUD, status ativo, destaque, categorias, campanhas, upload de imagens até 5 MB e métricas somente de cliques.
- Segurança: RLS nas seis tabelas, validação de função em políticas, service role só no Pages Function, bucket público de leitura e upload administrativo.
- Usuários: convite ADMIN/EDITOR via `platform/functions/api/admin/invite.ts`; OWNER não pode ser atribuído pelo próprio endpoint.

Imagens são limitadas a JPEG, PNG, WebP e AVIF, até 5 MB, com RLS no Storage. O preço original e o estado do produto só são exibidos conforme cadastrados. Não há afirmação de vendas nem comissão na vitrine.

## Exportação e Cloudflare Pages

`next.config.ts` define `output: 'export'`; `npm run build` gera `platform/out/`. No Cloudflare Pages, use:

- Root directory: `platform`
- Framework preset: `Next.js (Static HTML Export)`
- Build command: `npm run build`
- Build output directory: `out`
- Build variable: `NEXT_PUBLIC_SUPABASE_URL`
- Build variable: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Configure nas variáveis/secrets de Pages Functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` como secret criptografado
- `PUBLIC_SITE_URL` com a URL final `pages.dev`

Não prefixe o service role com `NEXT_PUBLIC_` e nunca o coloque no GitHub. O workflow `.github/workflows/cloudflare-pages.yml` também pode publicar usando as variáveis GitHub `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `CLOUDFLARE_ACCOUNT_ID` e o secret `CLOUDFLARE_API_TOKEN`.

## GitHub

O workspace atual ainda não é um repositório Git. Para conectar, crie um repositório vazio no GitHub, inicialize/versione a pasta de trabalho e configure as variáveis do workflow; então conecte o repositório ao Cloudflare Pages ou habilite o workflow. Nenhuma publicação remota foi feita.

## Limites gratuitos consultados em 09/11/2026

- Supabase Free: 500 MB de banco, 1 GB de arquivos, 5 GB de egress e 50.000 usuários ativos mensais; projetos sem atividade podem pausar após uma semana. O plano limita a dois projetos ativos.
- Cloudflare Pages Free: 500 builds por mês, uma build concorrente, timeout de 20 minutos, até 20.000 arquivos por site e 25 MiB por arquivo.
- Chamadas Pages Functions contam para a quota do produto Workers aplicável à conta; confirme o limite vigente no painel Cloudflare.
- Quotas e termos mudam. Confira [Supabase Pricing](https://supabase.com/pricing) e [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/) antes de operação pública.

Uma instância Supabase gratuita pode pausar por inatividade e não equivale a uma garantia de disponibilidade de produção.