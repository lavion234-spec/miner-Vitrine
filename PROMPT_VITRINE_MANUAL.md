# Prompt de implementacao: ofertas manuais e vitrine publica

Adicione ao Shopee Affiliate Miner um fluxo para cadastrar ofertas manualmente sem depender da API da Shopee, junto com uma vitrine publica separada dentro do mesmo repositorio.

Requisitos de aceitacao:

- O administrador autenticado pode criar, editar, salvar como rascunho e publicar uma oferta manual.
- Cada oferta registra origem manual, descricao, categoria, preco atual, preco anterior opcional, imagem HTTPS opcional e comissao opcional.
- A publicacao exige que o administrador informe um link HTTPS no dominio Shopee ou no encurtador `shope.ee`; o link e fornecido manualmente e nao e verificado como valido pela API.
- Preco anterior, quando informado, deve ser maior que o preco atual.
- A vitrine e um frontend independente e responsivo, no mesmo repositorio, que consome apenas uma rota publica de leitura.
- A rota publica retorna exclusivamente ofertas de origem manual, publicadas e com link afiliado preenchido; rascunhos, DEMO e dados internos nunca aparecem.
- A vitrine exibe aviso de afiliado e o link abre em nova aba com protecoes de navegacao.
- Alteracoes de preco manual registram historico; ofertas manuais nao sao reclassificadas pelo minerador DEMO.
- Documentar execucao local, portas, migracao de banco e configuracao de origem da API para deploy separado.

Nao implementar scraping, nao inventar links, nao exibir ofertas DEMO como reais e nao assumir que o dominio do link prova que ele gera comissao.