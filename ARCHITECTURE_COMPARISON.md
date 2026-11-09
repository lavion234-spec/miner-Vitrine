# Comparação de arquitetura

## Estado anterior

| Área | Implementação existente |
| --- | --- |
| Aplicação | React + Vite em `frontend/` e `storefront/` |
| API e persistência | FastAPI + SQLAlchemy + SQLite local em `backend/` |
| Acesso | Um usuário administrativo local; sem Supabase Auth/RLS |
| Vitrine | Ofertas manuais via API local; sem tracking de cliques |
| Deploy | Sem repositório Git configurado; sem build Cloudflare |

O banco `backend/shopee_miner.db` e a oferta já cadastrada foram preservados. Não há migração automática desse SQLite para Supabase: as credenciais do projeto remoto não estão configuradas.

## Nova plataforma

| Área | Implementação em `platform/` |
| --- | --- |
| Aplicação | Next.js App Router, React, TypeScript, Tailwind e primitivas shadcn/ui |
| Deploy | Exportação estática Next.js (`out/`) para Cloudflare Pages |
| Dados e autenticação | Supabase PostgreSQL, Auth, Storage e políticas RLS |
| Acesso | OWNER, ADMIN e EDITOR validados no banco |
| Vitrine | Catálogo Supabase, busca, categorias, filtro de preço e detalhe de produto |
| Rastreamento | `/go/?id=UUID&campaign=UUID`, verifica produto ativo e registra o clique antes do redirect |
| Operação | Produtos, categorias, campanhas, imagens, métricas de cliques, auditoria e convite de usuários |

As duas aplicações coexistem para evitar interrupção e perda de dados. `platform/` é o alvo para a nova hospedagem; o stack local antigo continua disponível até a migração de dados ser planejada.

## Limitações deliberadas

- Com `output: 'export'`, páginas e metadados são gerados no build. O detalhe de produto usa `/produto/?id=UUID`, não um caminho dinâmico SEO por slug, porque novos slugs não podem gerar HTML sem rebuild.
- `/go` é uma página estática client-side. Ela busca apenas o produto ativo pelo ID no Supabase, valida o domínio Shopee permitido e nunca aceita uma URL de destino recebida do visitante.
- O gráfico de cliques mede acessos ao botão; não mede pedidos, conversões nem faturamento.
- O painel não usa dados de demonstração e permanece em estado de configuração até as variáveis públicas e a migration Supabase estarem prontas.