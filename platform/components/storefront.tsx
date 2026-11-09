'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BadgePercent, Search, ShieldCheck, ShoppingBag, Sparkles, Tag } from 'lucide-react'
import { getSupabase, supabaseIsConfigured } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Category = { id: string; name: string; slug: string }
export type StoreProduct = {
  id: string
  name: string
  description: string
  image_url: string | null
  original_price: number | null
  current_price: number
  affiliate_url: string
  category_id: string
  is_featured: boolean
  categories?: Category | Category[] | null
}

function categoryName(product: StoreProduct) {
  const relation = Array.isArray(product.categories) ? product.categories[0] : product.categories
  return relation?.name ?? 'Oferta'
}

function discount(original: number | null, current: number) {
  if (!original || original <= current) return null
  return Math.round((1 - current / original) * 100)
}

function Header() {
  return <header className="site-header"><Link className="site-brand" href="/"><span className="brand-icon"><Tag size={17} /></span><span>garimpo<small>de ofertas</small></span></Link><nav className="site-nav"><Link href="/#ofertas" aria-current="page">Ofertas</Link><Link href="/#transparencia">Sobre os links</Link></nav><Button asChild size="sm" variant="secondary" className="site-header-action"><Link href="/admin/"><ShoppingBag size={14} /> Painel</Link></Button></header>
}

function ProductCard({ product }: { product: StoreProduct }) {
  const discountPercent = discount(product.original_price, product.current_price)
  return <article className="product-card"><Link className="product-art" href={`/produto/?id=${encodeURIComponent(product.id)}`} aria-label={`Detalhes de ${product.name}`}>
    {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <div className="product-art-placeholder"><Tag size={28} /><span>OFERTA SELECIONADA</span></div>}
    <Badge className="product-category">{categoryName(product)}</Badge>{discountPercent !== null && <Badge className="product-discount">-{discountPercent}%</Badge>}
  </Link><div className="product-card-body"><h3 className="product-card-title">{product.name}</h3><p className="product-description">{product.description || 'Produto selecionado pela curadoria.'}</p><div className="product-price"><strong>{formatCurrency(product.current_price)}</strong>{product.original_price !== null && <del>{formatCurrency(product.original_price)}</del>}</div><div className="product-actions"><Button asChild variant="secondary" size="sm"><Link href={`/produto/?id=${encodeURIComponent(product.id)}`}>Detalhes</Link></Button><Button asChild size="sm"><Link href={`/go/?id=${encodeURIComponent(product.id)}`}>Ver oferta <ArrowUpRight size={14} /></Link></Button></div><span className="product-transparency">Link de afiliado · preço pode mudar na loja</span></div></article>
}

export default function Storefront() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [minimumPrice, setMinimumPrice] = useState('')
  const [maximumPrice, setMaximumPrice] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const configured = supabaseIsConfigured()

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }
    void Promise.all([
      supabase.from('products').select('id,name,description,image_url,original_price,current_price,affiliate_url,category_id,is_featured,categories(id,name,slug)').eq('is_active', true).order('is_featured', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('categories').select('id,name,slug').eq('is_active', true).order('name'),
    ]).then(([productResult, categoryResult]) => {
      if (productResult.error) throw productResult.error
      if (categoryResult.error) throw categoryResult.error
      setProducts((productResult.data ?? []) as StoreProduct[])
      setCategories((categoryResult.data ?? []) as Category[])
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as ofertas.'))
      .finally(() => setLoading(false))
  }, [])

  const visibleProducts = useMemo(() => products.filter((product) => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    const matchesText = !query || `${product.name} ${product.description} ${categoryName(product)}`.toLocaleLowerCase('pt-BR').includes(query)
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory
    const matchesMinimum = !minimumPrice || product.current_price >= Number(minimumPrice)
    const matchesMaximum = !maximumPrice || product.current_price <= Number(maximumPrice)
    return matchesText && matchesCategory && matchesMinimum && matchesMaximum
  }), [products, search, selectedCategory, minimumPrice, maximumPrice])
  const featuredProducts = visibleProducts.filter((product) => product.is_featured)

  return <div className="site-shell"><Header /><main>
    <section className="site-hero"><div className="hero-copy"><div className="eyebrow hero-eyebrow"><i /> CURADORIA INDEPENDENTE</div><h1>Boas escolhas.<br /><em>Sem caça ao tesouro.</em></h1><p>Ofertas selecionadas e atualizadas pela nossa curadoria, com informações claras e links de afiliado identificados.</p><Button asChild variant="ghost" className="hero-action"><Link href="#ofertas">Explorar ofertas <ArrowDownRight size={16} /></Link></Button></div><div className="hero-stamp"><Sparkles size={16} /><span>ACHADOS<br />COM CRITÉRIO</span></div><div className="hero-orbit" aria-hidden="true" /></section>
    <section className="affiliate-disclosure" id="transparencia"><ShieldCheck size={17} /><p><strong>Transparência:</strong> podemos receber comissão quando você compra por nossos links de afiliado, sem custo extra. Preços e condições podem mudar na loja.</p></section>
    <section className="catalog-section" id="ofertas"><div className="catalog-heading"><div><div className="eyebrow">A SELEÇÃO DA VEZ</div><h2 className="display-font">Ofertas em destaque <span className="catalog-count">{visibleProducts.length.toString().padStart(2, '0')}</span></h2></div><span className="eyebrow">{configured ? 'CATÁLOGO ATUALIZADO' : 'CONFIGURAÇÃO PENDENTE'}</span></div>
      <div className="catalog-toolbar"><label className="catalog-search"><Search size={16} /><input placeholder="Buscar produto ou categoria" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>/</kbd></label><div className="category-tabs"><button type="button" aria-pressed={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')}>Todas</button>{categories.map((category) => <button key={category.id} type="button" aria-pressed={selectedCategory === category.id} onClick={() => setSelectedCategory(category.id)}>{category.name}</button>)}</div></div>
      <div className="catalog-toolbar price-filters"><label className="catalog-search"><span>Preço de</span><input aria-label="Preço mínimo" type="number" min="0" placeholder="R$ 0" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} /></label><label className="catalog-search"><span>até</span><input aria-label="Preço máximo" type="number" min="0" placeholder="Sem limite" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} /></label><button className="filter-clear" onClick={() => { setSearch(''); setSelectedCategory('all'); setMinimumPrice(''); setMaximumPrice('') }}>Limpar filtros</button></div>
      {loading ? <div className="empty-panel"><span className="status-dot" /><p>Carregando ofertas...</p></div> : error ? <div className="setup-notice">Não foi possível carregar os produtos: {error}</div> : !configured ? <div className="empty-panel"><div className="eyebrow">CONFIGURAÇÃO PENDENTE</div><h3>Conecte seu catálogo Supabase</h3><p>Configure as variáveis públicas do Supabase e aplique a migration para publicar seus produtos. Nenhum dado de demonstração é usado neste site.</p></div> : visibleProducts.length === 0 ? <div className="empty-panel"><Tag size={27} /><h3>{products.length ? 'Nenhum produto encontrado' : 'Novos achados estão a caminho'}</h3><p>{products.length ? 'Tente outra busca ou ajuste os filtros de categoria e preço.' : 'A vitrine exibe apenas produtos ativos cadastrados no seu catálogo.'}</p></div> : <div className="product-grid">{(featuredProducts.length ? featuredProducts : visibleProducts).map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      {configured && featuredProducts.length > 0 && visibleProducts.length > featuredProducts.length && <><div className="catalog-heading all-products-heading"><div><div className="eyebrow">CATÁLOGO COMPLETO</div><h2 className="display-font">Mais produtos</h2></div><Badge><BadgePercent size={13} /> {visibleProducts.length - featuredProducts.length} itens</Badge></div><div className="product-grid">{visibleProducts.filter((product) => !product.is_featured).map((product) => <ProductCard key={product.id} product={product} />)}</div></>}
    </section>
  </main><footer className="site-footer"><Link className="site-brand" href="/"><span className="brand-icon"><Tag size={15} /></span><span>garimpo<small>de ofertas</small></span></Link><span>Vitrine independente · Links de afiliado identificados</span><Link href="/#inicio">Voltar ao topo <ArrowUpRight size={13} /></Link></footer></div>
}