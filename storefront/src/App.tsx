import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BadgePercent, ChevronDown, Search, ShieldCheck, ShoppingBag, Sparkles, Tag } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? ''
type Offer = {
  id: number
  name: string
  description: string | null
  category: string
  current_price: number
  original_price: number | null
  image_url: string | null
  affiliate_url: string
  published_at: string | null
}
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function discount(original: number | null, current: number) {
  if (!original || original <= current) return null
  return Math.round((1 - current / original) * 100)
}

export default function App() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/api/store/offers`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Nao foi possivel carregar as ofertas agora.')
        return response.json() as Promise<Offer[]>
      })
      .then(setOffers)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Erro ao carregar ofertas.'))
      .finally(() => setLoading(false))
  }, [])

  const categories = ['Todas', ...new Set(offers.map((offer) => offer.category))]
  const visibleOffers = offers.filter((offer) => {
    const matchesSearch = `${offer.name} ${offer.category} ${offer.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (category === 'Todas' || category === offer.category)
  })

  return <div className="store-shell">
    <header className="store-header"><a className="store-brand" href="#inicio"><span className="store-logo"><Tag size={19} /></span><span>garimpo<span>de ofertas</span></span></a><nav className="store-nav"><a className="active" href="#ofertas">Ofertas</a><a href="#sobre">Sobre os links</a></nav><a className="saved-button" href="#ofertas"><ShoppingBag size={16} /><span>Vitrine</span></a></header>
    <main>
      <section className="store-hero" id="inicio"><div className="hero-content"><div className="hero-kicker"><span /> CURADORIA INDEPENDENTE</div><h1>Boas escolhas.<br /><em>Sem caça ao tesouro.</em></h1><p>Ofertas selecionadas e atualizadas manualmente, com o link certo para conferir cada produto.</p><a className="hero-link" href="#ofertas">Explorar ofertas <ArrowDownRight size={16} /></a></div><div className="hero-stamp"><Sparkles size={17} /><span>ACHADOS<br />COM CRITERIO</span></div><div className="hero-curve" aria-hidden="true" /></section>
      <section className="disclosure" id="sobre"><ShieldCheck size={17} /><p><strong>Transparencia:</strong> alguns links desta vitrine sao links de afiliado. Precos anteriores sao informados manualmente; confirme os valores e condicoes na Shopee.</p><a href="#ofertas">Entenda <ChevronDown size={14} /></a></section>
      <section className="offers-section" id="ofertas"><div className="section-heading"><div><div className="section-kicker">A SELECAO DA VEZ</div><h2>Ofertas em destaque <span>{offers.length.toString().padStart(2, '0')}</span></h2></div><div className="freshness"><i /> Atualizada pela curadoria</div></div>
        <div className="store-toolbar"><label className="store-search"><Search size={16} /><input placeholder="Busque produto ou categoria" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>/</kbd></label><div className="category-tabs" role="group" aria-label="Filtrar por categoria">{categories.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
        {loading ? <div className="store-state"><span className="store-loader" /><strong>Buscando ofertas...</strong></div> : error ? <div className="store-state"><div className="state-icon"><BadgePercent size={21} /></div><strong>Vitrine indisponivel</strong><span>{error}</span></div> : visibleOffers.length === 0 ? <div className="store-empty"><div className="empty-illustration"><Tag size={30} /><i /><i /></div><div className="section-kicker">{offers.length ? 'NENHUM RESULTADO' : 'EM PREPARACAO'}</div><h3>{offers.length ? 'Nao encontramos essa oferta.' : 'Novos achados estao a caminho.'}</h3><p>{offers.length ? 'Tente outra busca ou selecione uma categoria diferente.' : 'A vitrine so exibe ofertas publicadas pela curadoria. Volte em breve para conferir.'}</p>{offers.length > 0 && <button className="clear-filter" onClick={() => { setSearch(''); setCategory('Todas') }}>Limpar filtros <ArrowUpRight size={14} /></button>}</div> : <div className="offer-grid">{visibleOffers.map((offer) => {
          const discountPercent = discount(offer.original_price, offer.current_price)
          return <article className="offer-card" key={offer.id}><a className="product-visual" href={offer.affiliate_url} target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label={`Ver oferta de ${offer.name}`}>
            {offer.image_url ? <img src={offer.image_url} alt={offer.name} loading="lazy" /> : <div className="image-fallback"><Tag size={30} /><span>OFERTA SELECIONADA</span></div>}
            <span className="category-label">{offer.category}</span>{discountPercent !== null && <span className="discount-label">-{discountPercent}%</span>}
          </a><div className="offer-info"><div className="product-title-row"><h3>{offer.name}</h3><a className="offer-arrow" href={offer.affiliate_url} target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="Abrir link afiliado"><ArrowUpRight size={17} /></a></div>{offer.description && <p className="product-description">{offer.description}</p>}<div className="price-line"><strong>{money(offer.current_price)}</strong>{offer.original_price && <del>{money(offer.original_price)}</del>}</div><a className="offer-cta" href={offer.affiliate_url} target="_blank" rel="sponsored nofollow noopener noreferrer">Ver na Shopee <ArrowUpRight size={15} /></a><span className="card-disclosure">Link de afiliado <span>·</span> preco pode mudar</span></div></article>
        })}</div>}
      </section>
      <section className="closing-band"><div><span className="section-kicker">GARIMPO COM RESPONSABILIDADE</span><h2>Preco claro.<br />Link transparente.</h2></div><div className="closing-note"><ShieldCheck size={21} /><p>Os valores e a disponibilidade podem mudar na loja. Confirme as condicoes no destino antes de concluir sua compra.</p></div></section>
    </main>
    <footer className="store-footer"><a className="store-brand small-brand" href="#inicio"><span className="store-logo"><Tag size={15} /></span><span>garimpo<span>de ofertas</span></span></a><span>Vitrine independente · Links de afiliado identificados</span><a href="#inicio">Voltar ao topo <ArrowUpRight size={13} /></a></footer>
  </div>
}