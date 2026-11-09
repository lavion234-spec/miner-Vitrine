import { useEffect, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, BadgePercent, Boxes, ChartNoAxesCombined, Check, ChevronDown, CircleHelp, Clock3, Copy, ExternalLink, Filter, LayoutDashboard, LogOut, Menu, PackageSearch, Play, Search, Send, Settings2, ShieldCheck, Sparkles, Store, Tags, WalletCards, X } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ManualOffers from './ManualOffers'

const API = import.meta.env.VITE_API_URL ?? ''
type Offer = { id: number; name: string; category: string; current_price: number; original_price: number | null; commission_rate: number | null; rating: number | null; sales_count: number | null; score: number; confidence: number; demo: boolean; affiliate_url: string | null }
type Dashboard = { products_found: number; recommended: number; published: number; pending: number; estimated_commission: number; demo: boolean; runs: { id: number; date: string; found: number; new: number; source: string }[]; category_counts: { name: string; value: number }[] }
type AuthStatus = { setup_required: boolean }
type Integration = { shopee: { mode: string; status: string; approved: boolean }; telegram: { configured: boolean; status: string }; whatsapp: { mode: string } }

const navItems = [
  { id: 'dashboard', label: 'Visao geral', icon: LayoutDashboard },
  { id: 'offers', label: 'Ofertas', icon: PackageSearch },
  { id: 'manual', label: 'Ofertas manuais', icon: Store },
  { id: 'mining', label: 'Mineracao', icon: Activity },
  { id: 'integrations', label: 'Integracoes', icon: Boxes },
]
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function request(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail ?? 'Nao foi possivel concluir a operacao.')
  }
  return response.json()
}

function AuthScreen({ setup, onAuthenticated }: { setup: boolean; onAuthenticated: (token: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await fetch(`${API}/api/auth/${setup ? 'setup' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const data = await result.json()
      if (!result.ok) throw new Error(data.detail ?? 'Falha ao autenticar.')
      onAuthenticated(data.access_token)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao conectar a API.') } finally { setBusy(false) }
  }
  return <main className="auth-wrap"><div className="auth-card"><div className="brand-mark"><Boxes size={21} /></div><p className="eyebrow">SHOPEE AFFILIATE MINER</p><h1>{setup ? 'Seu painel comeca aqui.' : 'Bom ter voce de volta.'}</h1><p className="muted">{setup ? 'Crie a conta administrativa para proteger este ambiente.' : 'Entre para acompanhar suas oportunidades.'}</p><form onSubmit={submit}><label>Usuario<input autoComplete="username" minLength={3} value={username} onChange={(e) => setUsername(e.target.value)} required /></label><label>Senha<input autoComplete={setup ? 'new-password' : 'current-password'} type="password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} required /><small>{setup ? 'Use ao menos 12 caracteres.' : 'Sua senha nunca e exibida no painel.'}</small></label>{error && <div className="error-box">{error}</div>}<button className="primary-button full" disabled={busy}>{busy ? 'Conectando...' : setup ? 'Criar acesso' : 'Entrar'}<ArrowUpRight size={16} /></button></form><div className="auth-foot"><ShieldCheck size={15} /> Acesso administrativo protegido</div></div></main>
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('miner_token') ?? '')
  const [setup, setSetup] = useState<boolean | null>(null)
  const [page, setPage] = useState('dashboard')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [integrations, setIntegrations] = useState<Integration | null>(null)
  const [runs, setRuns] = useState<Dashboard['runs']>([])
  const [loading, setLoading] = useState(false)
  const [mining, setMining] = useState(false)
  const [search, setSearch] = useState('')
  const [minimumScore, setMinimumScore] = useState(0)
  const [notice, setNotice] = useState('')
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => { fetch(`${API}/api/auth/status`).then((r) => r.json()).then((data: AuthStatus) => setSetup(data.setup_required)).catch(() => setSetup(false)) }, [])
  useEffect(() => { if (!token) return; localStorage.setItem('miner_token', token); void loadData() }, [token])
  async function loadData() {
    setLoading(true)
    try {
      const [stats, items, connections, history] = await Promise.all([request('/api/dashboard', token), request('/api/offers', token), request('/api/integrations', token), request('/api/runs', token)])
      setDashboard(stats); setOffers(items); setIntegrations(connections); setRuns(history)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Erro ao carregar painel.') }
    finally { setLoading(false) }
  }
  async function runMining() {
    setMining(true); setNotice('')
    try { const result = await request('/api/mining/run', token, { method: 'POST' }); setNotice(`Busca demo concluida: ${result.found} ofertas verificadas, ${result.new} novas.`); await loadData() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Falha na mineracao.') }
    finally { setMining(false) }
  }
  function logout() { localStorage.removeItem('miner_token'); setToken(''); setDashboard(null) }
  if (setup === null) return <div className="loading-screen"><span className="loader" />Conectando ao painel...</div>
  if (!token) return <AuthScreen setup={setup} onAuthenticated={(value) => { localStorage.setItem('miner_token', value); setToken(value); setSetup(false) }} />

  const visibleOffers = offers.filter((offer) => offer.score >= minimumScore && (!search || offer.name.toLowerCase().includes(search.toLowerCase()) || offer.category.toLowerCase().includes(search.toLowerCase())))
  const topCategories = dashboard?.category_counts ?? []
  const chartData = [...(dashboard?.runs ?? [])].reverse().map((run, index) => ({ day: new Date(run.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), ofertas: run.found, novas: run.new, index }))
  const currentLabel = navItems.find((item) => item.id === page)?.label ?? 'Visao geral'

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#dashboard" onClick={(event) => { event.preventDefault(); setPage('dashboard') }}><span className="brand-mark"><Boxes size={19} /></span><span className="brand-copy">miner<span>affiliate intelligence</span></span></a>
      <div className="workspace-label">WORKSPACE</div><div className="workspace-switch"><span className="workspace-icon"><Store size={16} /></span><span>Operacao principal<small>Ambiente local</small></span><ChevronDown size={14} /></div>
      <div className="nav-caption">OPERACAO</div><nav>{navItems.map((item) => <button key={item.id} className={`nav-link ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileNav(false) }}><item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'offers' && <span className="nav-count">{offers.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-icon"><Sparkles size={16} /></div><div><strong>Modo demonstracao</strong><span>Dados ficticios e isolados</span></div><span className="pulse-dot" /></div><button className="nav-link logout-link" onClick={logout}><LogOut size={17} /><span>Sair da conta</span></button><div className="profile-row"><div className="avatar">AM</div><div><strong>Administrador</strong><span>Painel privado</span></div><CircleHelp size={17} /></div></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" aria-label="Fechar menu" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu size={19} /></button><div className="breadcrumbs">Workspace <span>/</span> <strong>{currentLabel}</strong></div><div className="topbar-right"><span className="environment-pill"><span /> DEMO ATIVO</span><button className="icon-button" title="Configuracoes" onClick={() => setPage('integrations')}><Settings2 size={18} /></button><div className="top-avatar">AM</div></div></header>
      <div className="page-content">
        {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fechar"><X size={15} /></button></div>}
        {page === 'dashboard' && <>
          <section className="page-heading"><div><div className="overline"><span className="live-dot" /> CENTRAL DE OFERTAS <span className="heading-separator">/</span> 09 NOV 2026</div><h1>Bom dia. <span>Vamos minerar?</span></h1><p>Acompanhe oportunidades e sinais da sua operacao em um so lugar.</p></div><button className="primary-button" onClick={runMining} disabled={mining}>{mining ? <span className="button-loader" /> : <Play size={15} fill="currentColor" />}{mining ? 'Minerando...' : 'Iniciar mineracao'}</button></section>
          <div className="demo-notice"><span className="demo-symbol"><Sparkles size={16} /></span><span><strong>Ambiente de demonstracao</strong> Os produtos e indicadores exibidos sao ficticios. Nenhuma consulta foi feita a Shopee e nenhum link de afiliado foi criado.</span><button onClick={() => setPage('integrations')}>Ver integracoes <ArrowUpRight size={14} /></button></div>
          <section className="metrics-grid">
            <Metric icon={PackageSearch} label="Produtos minerados" value={dashboard?.products_found ?? 0} note="no catalogo demo" accent="green" />
            <Metric icon={BadgePercent} label="Boas oportunidades" value={dashboard?.recommended ?? 0} note="pontuacao a partir de 80" accent="amber" />
            <Metric icon={Send} label="Publicacoes" value="0" note="telegram nao conectado" accent="blue" />
            <Metric icon={WalletCards} label="Comissao estimada" value={money(dashboard?.estimated_commission ?? 0)} note="simulacao, nao confirmada" accent="coral" />
          </section>
          <section className="dashboard-grid"><div className="panel chart-panel"><div className="panel-heading"><div><div className="panel-kicker">ATIVIDADE RECENTE</div><h2>Ritmo de mineracao</h2></div><button className="subtle-button" onClick={() => setPage('mining')}>Ver execucoes <ArrowUpRight size={14} /></button></div><div className="chart-legend"><span><i className="legend-dot green-dot" /> Ofertas verificadas</span><span><i className="legend-dot amber-dot" /> Novas no catalogo</span><span className="chart-period">Ultimas execucoes</span></div><div className="chart-wrap">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 6, left: -18, bottom: 0 }}><defs><linearGradient id="offersFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#41d98a" stopOpacity={0.19} /><stop offset="100%" stopColor="#41d98a" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#242a27" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#858e88', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#858e88', fontSize: 11 }} /><Tooltip contentStyle={{ background: '#171c19', border: '1px solid #2a322d', borderRadius: 8, color: '#f1f3f1' }} /><Area type="monotone" dataKey="ofertas" stroke="#41d98a" strokeWidth={2} fill="url(#offersFill)" /><Area type="monotone" dataKey="novas" stroke="#e8ab57" strokeWidth={1.5} fill="transparent" /></AreaChart></ResponsiveContainer> : <div className="empty-chart"><div className="empty-icon"><ChartNoAxesCombined size={21} /></div><strong>{loading ? 'Carregando atividade...' : 'Sua primeira busca comeca aqui'}</strong><span>Execute a mineracao para registrar uma atividade.</span><button className="text-action" onClick={runMining} disabled={mining}><Play size={13} /> Minerar agora</button></div>}</div><div className="chart-footer"><span><i className="small-status" /> Ultima execucao: {dashboard?.runs[0] ? new Date(dashboard.runs[0].date).toLocaleString('pt-BR') : 'Ainda nao executada'}</span><span>Fuso horario: America/Fortaleza</span></div></div>
            <div className="panel category-panel"><div className="panel-heading"><div><div className="panel-kicker">INVENTARIO</div><h2>Por categoria</h2></div><button className="icon-button small" title="Ver ofertas" onClick={() => setPage('offers')}><ArrowUpRight size={16} /></button></div><div className="category-list">{topCategories.length ? topCategories.map((category, index) => <div className="category-row" key={category.name}><div className={`category-icon cat-${index % 4}`}><Tags size={15} /></div><div className="category-info"><span>{category.name}</span><div className="category-bar"><i style={{ width: `${Math.max(14, category.value / Math.max(...topCategories.map((item) => item.value)) * 100)}%` }} /></div></div><strong>{category.value.toString().padStart(2, '0')}</strong></div>) : <div className="empty-side">As categorias aparecem depois da primeira mineracao.</div>}</div><button className="panel-link" onClick={() => setPage('offers')}>Explorar catalogo <ArrowUpRight size={14} /></button></div></section>
          <section className="panel table-panel"><div className="panel-heading"><div><div className="panel-kicker">CURADORIA DO MINERADOR</div><h2>Oportunidades em destaque</h2></div><button className="subtle-button" onClick={() => setPage('offers')}>Ver todas <ArrowUpRight size={14} /></button></div><OfferTable offers={offers.slice(0, 5)} onShare={() => setNotice('Links de afiliado ficam indisponiveis no modo demo.')} /></section>
          <footer className="page-footer"><span>SHOPEE AFFILIATE MINER <b>·</b> V0.1.0</span><span><ShieldCheck size={13} /> Dados demonstrativos identificados</span></footer>
        </>}
        {page === 'offers' && <><section className="page-heading compact"><div><div className="overline">CATALOGO <span className="heading-separator">/</span> OPORTUNIDADES</div><h1>Ofertas <span>encontradas</span></h1><p>Ordenadas pela pontuacao comercial, com confianca exibida separadamente.</p></div><button className="primary-button" onClick={runMining} disabled={mining}>{mining ? <span className="button-loader" /> : <Play size={15} fill="currentColor" />}{mining ? 'Minerando...' : 'Minerar ofertas'}</button></section><div className="demo-notice"><span className="demo-symbol"><Sparkles size={16} /></span><span><strong>Dados DEMO ficticios.</strong> Links e precos reais nao estao disponiveis nesta etapa.</span></div><section className="panel table-panel offers-full"><div className="filter-toolbar"><div className="search-field"><Search size={16} /><input placeholder="Buscar produto ou categoria" value={search} onChange={(event) => setSearch(event.target.value)} /></div><label className="score-filter"><Filter size={15} /><span>Pontuacao minima</span><select value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))}><option value={0}>Todas</option><option value={60}>60+</option><option value={70}>70+</option><option value={80}>80+</option><option value={90}>90+</option></select></label><span className="result-count">{visibleOffers.length} resultados</span></div><OfferTable offers={visibleOffers} onShare={() => setNotice('Compartilhamento bloqueado: nenhuma oferta DEMO possui link de afiliado valido.')} /></section></>}
        {page === 'mining' && <><section className="page-heading compact"><div><div className="overline">AUTOMACAO <span className="heading-separator">/</span> EXECUCOES</div><h1>Mineracao <span>de ofertas</span></h1><p>Historico de execucoes e estado do mecanismo de coleta.</p></div><button className="primary-button" onClick={runMining} disabled={mining}>{mining ? <span className="button-loader" /> : <Play size={15} fill="currentColor" />}{mining ? 'Executando...' : 'Executar agora'}</button></section><div className="demo-notice"><span className="demo-symbol"><Sparkles size={16} /></span><span><strong>Provedor DEMO ativo.</strong> A busca usa um conjunto local de produtos ficticios; nenhuma requisicao e enviada a Shopee.</span></div><div className="mining-summary"><Metric icon={Activity} label="Execucoes registradas" value={runs.length} note="historico local" accent="green" /><Metric icon={Clock3} label="Frequencia" value="Manual" note="agendamento sera configurado" accent="blue" /><Metric icon={Tags} label="Categorias" value={dashboard?.category_counts.length ?? 0} note="amostra demonstrativa" accent="amber" /></div><section className="panel table-panel"><div className="panel-heading"><div><div className="panel-kicker">LOG DE EXECUCOES</div><h2>Atividade recente</h2></div><span className="table-count">{runs.length} registros</span></div><div className="run-list">{runs.length ? runs.map((run) => <div className="run-row" key={run.id}><div className="run-status"><Check size={14} /></div><div className="run-details"><strong>Mineracao DEMO concluida</strong><span>{new Date(run.date).toLocaleString('pt-BR')} · origem: dados ficticios</span></div><div className="run-result"><b>{run.found}</b><span>verificadas</span></div><div className="run-result new-result"><b>{run.new}</b><span>novas</span></div><span className="success-tag">Concluida</span></div>) : <div className="empty-state"><div className="empty-icon"><Activity size={21} /></div><strong>Nenhuma execucao registrada</strong><span>Inicie uma busca para preencher o historico.</span></div>}</div></section></>}
        {page === 'integrations' && <><section className="page-heading compact"><div><div className="overline">CONFIGURACAO <span className="heading-separator">/</span> INTEGRACOES</div><h1>Conecte seus <span>canais</span></h1><p>O estado das integracoes e claro: nenhum dado demo e tratado como acesso real.</p></div></section><div className="integration-grid"><IntegrationCard icon={Store} name="Shopee Affiliate API" label="Fonte de produtos" status={integrations?.shopee.status === 'demo' ? 'Modo demo' : 'Nao configurada'} color="orange" description="Busca, comissoes e links oficiais so serao ativados com documentacao e credenciais aprovadas." foot="Endpoint nao configurado" /><IntegrationCard icon={Send} name="Telegram" label="Canal de publicacao" status={integrations?.telegram.configured ? 'Credenciais detectadas' : 'Nao conectado'} color="blue" description="A publicacao automatica exige bot e canal configurados no backend. Nenhuma mensagem sera enviada sem validacao." foot="Configure no ambiente do servidor" /><IntegrationCard icon={Copy} name="WhatsApp manual" label="Compartilhamento" status="Manual somente" color="green" description="Sem automacao de envio. O compartilhamento sera liberado quando houver link de afiliado validado." foot="Automacao nao utilizada" /></div><section className="panel security-panel"><div className="security-icon"><ShieldCheck size={19} /></div><div><strong>Credenciais protegidas no servidor</strong><p>Secrets nao sao solicitados nem exibidos no navegador. Configure-os somente por variaveis de ambiente quando as integracoes forem implementadas.</p></div></section></>}
        {page === 'manual' && <ManualOffers token={token} />}
      </div>
    </main>
  </div>
}

function Metric({ icon: Icon, label, value, note, accent }: { icon: typeof PackageSearch; label: string; value: string | number; note: string; accent: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${accent}`}><Icon size={16} /></span></div><strong className="metric-value">{value}</strong><div className="metric-note"><span className={`metric-trend ${accent}`}><ArrowDownRight size={13} /></span>{note}</div></article>
}

function OfferTable({ offers, onShare }: { offers: Offer[]; onShare: () => void }) {
  if (!offers.length) return <div className="empty-state"><div className="empty-icon"><PackageSearch size={21} /></div><strong>Nenhuma oferta neste filtro</strong><span>Altere os filtros ou execute uma mineracao.</span></div>
  return <div className="table-scroll"><table><thead><tr><th>PRODUTO</th><th>CATEGORIA</th><th>PRECO DEMO</th><th>COMISSAO</th><th>OPORTUNIDADE</th><th>CONFIANCA</th><th></th></tr></thead><tbody>{offers.map((offer) => <tr key={offer.id}><td><div className="product-cell"><div className="product-thumb"><PackageSearch size={17} /></div><div><strong>{offer.name}</strong><span>Produto ficticio · ID {offer.id.toString().padStart(4, '0')}</span></div></div></td><td><span className="category-chip">{offer.category}</span></td><td><strong className="price-value">{money(offer.current_price)}</strong><span className="price-old">{offer.original_price ? money(offer.original_price) : 'sem referencia'}</span></td><td><strong>{offer.commission_rate ? `${offer.commission_rate}%` : '--'}</strong></td><td><div className="score-cell"><span className={`score-number ${offer.score >= 80 ? 'score-high' : offer.score >= 70 ? 'score-mid' : 'score-low'}`}>{offer.score}</span><span className="score-track"><i style={{ width: `${offer.score}%` }} /></span></div></td><td><span className="confidence">{offer.confidence}% <small>confianca</small></span></td><td><button className="icon-button disabled-action" onClick={onShare} title="Sem link afiliado no modo demo" aria-label="Compartilhar bloqueado"><ExternalLink size={16} /></button></td></tr>)}</tbody></table></div>
}

function IntegrationCard({ icon: Icon, name, label, status, color, description, foot }: { icon: typeof Store; name: string; label: string; status: string; color: string; description: string; foot: string }) {
  return <article className="panel integration-card"><div className="integration-head"><div className={`integration-icon ${color}`}><Icon size={19} /></div><span className="integration-status"><i />{status}</span></div><div className="panel-kicker">{label}</div><h2>{name}</h2><p>{description}</p><div className="integration-foot"><span className="integration-lock"><ShieldCheck size={14} /> {foot}</span><button className="icon-button small" title="Integracao ainda nao configuravel nesta etapa"><Settings2 size={16} /></button></div></article>
}

export default App