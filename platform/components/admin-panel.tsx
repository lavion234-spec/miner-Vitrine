'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { Activity, Archive, BadgeCheck, Boxes, ChartNoAxesCombined, ExternalLink, FileClock, ImagePlus, LayoutDashboard, LogOut, Megaphone, Package, Pencil, Plus, Save, ShieldCheck, Tags, Trash2, Upload, Users, X } from 'lucide-react'
import { getSupabase, supabaseIsConfigured } from '@/lib/supabase/client'
import { affiliateHostAllowed, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type Role = 'OWNER' | 'ADMIN' | 'EDITOR'
type AdminTab = 'overview' | 'products' | 'categories' | 'campaigns' | 'users' | 'audit'
type Category = { id: string; name: string; slug: string; is_active: boolean }
type Product = { id: string; name: string; slug: string; description: string; image_url: string | null; original_price: number | null; current_price: number; affiliate_url: string; category_id: string; is_featured: boolean; is_active: boolean; categories?: { name: string } | { name: string }[] | null }
type Campaign = { id: string; name: string; slug: string; is_active: boolean }
type Profile = { id: string; email: string | null; display_name: string; role: Role }
type ClickEvent = { product_id: string; clicked_at: string; campaign_id: string | null }
type ProductForm = { name: string; description: string; original_price: string; current_price: string; affiliate_url: string; category_id: string; is_featured: boolean; is_active: boolean }

const emptyProductForm: ProductForm = { name: '', description: '', original_price: '', current_price: '', affiliate_url: '', category_id: '', is_featured: false, is_active: false }
const menu: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'products', label: 'Produtos', icon: Package },
  { id: 'categories', label: 'Categorias', icon: Tags },
  { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'audit', label: 'Auditoria', icon: FileClock },
]

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function RoleBadge({ role }: { role: Role }) {
  return <Badge className={role === 'OWNER' ? 'role-owner' : role === 'ADMIN' ? 'role-admin' : 'role-editor'}>{role}</Badge>
}

function LoginForm({ onLogin, message, error }: { onLogin: (email: string, password: string) => Promise<void>; message: string; error: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true)
    try { await onLogin(email, password) } finally { setBusy(false) }
  }
  return <main className="auth-wrap"><section className="auth-card"><span className="brand-icon"><Boxes size={18} /></span><div className="eyebrow mt-5">ÁREA RESTRITA</div><h1>Acesse seu painel</h1><p>Entre com o usuário criado pelo proprietário do workspace.</p>{message && <div className="admin-message">{message}</div>}{error && <div className="admin-message error">{error}</div>}<form onSubmit={submit}><label>Email<input className="mt-1 h-10 rounded-md border border-border px-3 text-sm" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Senha<input className="mt-1 h-10 rounded-md border border-border px-3 text-sm" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><Button disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</Button></form><p className="auth-foot"><ShieldCheck size={14} /> As permissões são verificadas pelo banco Supabase.</p></section></main>
}

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [tab, setTab] = useState<AdminTab>('overview')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [clicks, setClicks] = useState<ClickEvent[]>([])
  const [totalClicks, setTotalClicks] = useState(0)
  const [auditLogs, setAuditLogs] = useState<{ id: number; entity_type: string; entity_id: string; action: string; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'EDITOR'>('EDITOR')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [authReady, setAuthReady] = useState(false)
  const configured = supabaseIsConfigured()
  const supabase = getSupabase()

  useEffect(() => {
    if (!supabase) { setAuthReady(true); setLoading(false); return }
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) { setUser(data.session?.user ?? null); setAuthReady(true); setLoading(false) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session) { setRole(null); setDisplayName('') }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [supabase])

  useEffect(() => {
    if (!supabase || !user) { setRole(null); setLoading(false); return }
    let active = true
    setLoading(true)
    void supabase.from('profiles').select('role,display_name').eq('id', user.id).maybeSingle().then(({ data, error: profileError }) => {
      if (!active) return
      if (profileError || !data) setError('Seu perfil não foi criado. Peça ao OWNER para verificar a configuração do Supabase.')
      else { setRole(data.role as Role); setDisplayName(data.display_name || user.email || '') }
      setLoading(false)
    })
    return () => { active = false }
  }, [supabase, user])

  async function loadData(activeRole: Role) {
    if (!supabase) return
    setLoading(true)
    const [productResult, categoryResult, campaignResult] = await Promise.all([
      supabase.from('products').select('id,name,slug,description,image_url,original_price,current_price,affiliate_url,category_id,is_featured,is_active,categories(name)').order('updated_at', { ascending: false }),
      supabase.from('categories').select('id,name,slug,is_active').order('name'),
      supabase.from('campaigns').select('id,name,slug,is_active').order('created_at', { ascending: false }),
    ])
    if (productResult.error || categoryResult.error || campaignResult.error) {
      setError(productResult.error?.message ?? categoryResult.error?.message ?? campaignResult.error?.message ?? 'Falha ao carregar o painel.')
    } else {
      setProducts((productResult.data ?? []) as Product[])
      setCategories((categoryResult.data ?? []) as Category[])
      setCampaigns((campaignResult.data ?? []) as Campaign[])
      setError('')
    }

    if (activeRole === 'OWNER' || activeRole === 'ADMIN') {
      const [clickResult, countResult, logResult] = await Promise.all([
        supabase.from('click_events').select('product_id,clicked_at,campaign_id').gte('clicked_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).order('clicked_at', { ascending: false }).limit(3000),
        supabase.from('click_events').select('id', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('id,entity_type,entity_id,action,created_at').order('created_at', { ascending: false }).limit(100),
      ])
      setClicks((clickResult.data ?? []) as ClickEvent[])
      setTotalClicks(countResult.count ?? 0)
      setAuditLogs(logResult.data ?? [])
    }
    if (activeRole === 'OWNER') {
      const { data } = await supabase.from('profiles').select('id,email,display_name,role').order('created_at', { ascending: false })
      setProfiles((data ?? []) as Profile[])
    }
    setLoading(false)
  }

  useEffect(() => { if (role) void loadData(role) }, [role])

  async function login(email: string, password: string) {
    if (!supabase) return
    setError(''); setNotice('')
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) setError(loginError.message)
  }

  async function signOut() {
    await supabase?.auth.signOut()
    setProducts([]); setCategories([]); setCampaigns([]); setClicks([]); setAuditLogs([])
  }

  function startProduct(product?: Product) {
    setEditingProduct(product?.id ?? null)
    setImageFile(null)
    setProductForm(product ? {
      name: product.name,
      description: product.description,
      original_price: product.original_price === null ? '' : String(product.original_price),
      current_price: String(product.current_price),
      affiliate_url: product.affiliate_url,
      category_id: product.category_id,
      is_featured: product.is_featured,
      is_active: product.is_active,
    } : { ...emptyProductForm, category_id: categories.find((category) => category.is_active)?.id ?? '' })
    setFormOpen(true); setTab('products'); setError(''); setNotice('')
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !user) return
    setError(''); setNotice('')
    const currentPrice = Number(productForm.current_price)
    const originalPrice = productForm.original_price ? Number(productForm.original_price) : null
    if (!productForm.name.trim() || !productForm.category_id || !Number.isFinite(currentPrice) || currentPrice <= 0) {
      setError('Preencha nome, categoria e preço atual válido.'); return
    }
    if (originalPrice !== null && originalPrice <= currentPrice) { setError('O preço original deve ser maior que o preço atual.'); return }
    if (!affiliateHostAllowed(productForm.affiliate_url)) { setError('O link precisa ser HTTPS e pertencer a shopee.com.br ou shope.ee.'); return }

    let imageUrl: string | null = null
    if (imageFile) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
      if (!allowedTypes.includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024) {
        setError('Use uma imagem JPG, PNG, WebP ou AVIF de até 5 MB.'); return
      }
      const extension = imageFile.type.split('/')[1].replace('jpeg', 'jpg')
      const imagePath = `${user.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('product-images').upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false })
      if (uploadError) { setError(`Falha no upload: ${uploadError.message}`); return }
      imageUrl = supabase.storage.from('product-images').getPublicUrl(imagePath).data.publicUrl
    } else if (editingProduct) {
      imageUrl = products.find((product) => product.id === editingProduct)?.image_url ?? null
    }

    const payload = {
      name: productForm.name.trim(),
      slug: `${slugify(productForm.name)}-${(editingProduct ?? crypto.randomUUID()).slice(0, 8)}`,
      description: productForm.description.trim(),
      image_url: imageUrl,
      original_price: originalPrice,
      current_price: currentPrice,
      affiliate_url: productForm.affiliate_url.trim(),
      category_id: productForm.category_id,
      is_featured: productForm.is_featured,
      is_active: productForm.is_active,
      created_by: user.id,
    }
    const result = editingProduct
      ? await supabase.from('products').update({ ...payload, slug: products.find((product) => product.id === editingProduct)?.slug ?? payload.slug }).eq('id', editingProduct)
      : await supabase.from('products').insert(payload)
    if (result.error) { setError(result.error.message); return }
    setNotice(editingProduct ? 'Produto atualizado.' : 'Produto cadastrado.')
    setFormOpen(false); setProductForm(emptyProductForm); setImageFile(null)
    await loadData(role ?? 'EDITOR')
  }

  async function toggleProduct(product: Product, field: 'is_active' | 'is_featured') {
    if (!supabase) return
    const { error: updateError } = await supabase.from('products').update({ [field]: !product[field] }).eq('id', product.id)
    if (updateError) setError(updateError.message)
    else { setNotice('Produto atualizado.'); await loadData(role ?? 'EDITOR') }
  }

  async function deleteProduct(product: Product) {
    if (!supabase || !window.confirm(`Excluir "${product.name}"?`)) return
    const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id)
    if (deleteError) setError(deleteError.message)
    else { setNotice('Produto excluído.'); await loadData(role ?? 'EDITOR') }
  }

  async function createCategory(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !user || categoryName.trim().length < 2) return
    const { error: insertError } = await supabase.from('categories').insert({ name: categoryName.trim(), slug: slugify(categoryName), created_by: user.id })
    if (insertError) setError(insertError.message)
    else { setCategoryName(''); setNotice('Categoria criada.'); await loadData(role ?? 'EDITOR') }
  }

  async function setCategoryActive(category: Category) {
    if (!supabase) return
    const { error: updateError } = await supabase.from('categories').update({ is_active: !category.is_active }).eq('id', category.id)
    if (updateError) setError(updateError.message)
    else await loadData(role ?? 'EDITOR')
  }

  async function createCampaign(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !user || campaignName.trim().length < 2) return
    const { error: insertError } = await supabase.from('campaigns').insert({ name: campaignName.trim(), slug: `${slugify(campaignName)}-${crypto.randomUUID().slice(0, 6)}`, created_by: user.id })
    if (insertError) setError(insertError.message)
    else { setCampaignName(''); setNotice('Campanha criada.'); await loadData(role ?? 'ADMIN') }
  }

  async function toggleCampaign(campaign: Campaign) {
    if (!supabase) return
    const { error: updateError } = await supabase.from('campaigns').update({ is_active: !campaign.is_active }).eq('id', campaign.id)
    if (updateError) setError(updateError.message)
    else await loadData(role ?? 'ADMIN')
  }

  async function inviteUser(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setError(''); setNotice('')
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) { setError('Sessão expirada. Entre novamente.'); return }
    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível enviar o convite. Configure a Pages Function no Cloudflare.')
      setNotice(`Convite enviado para ${body.email}.`); setInviteEmail(''); await loadData('OWNER')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao convidar usuário.') }
  }

  async function changeUserRole(profile: Profile, nextRole: 'ADMIN' | 'EDITOR') {
    if (!supabase || profile.role === 'OWNER' || profile.id === user?.id) return
    const { error: updateError } = await supabase.from('profiles').update({ role: nextRole }).eq('id', profile.id)
    if (updateError) setError(updateError.message)
    else { setNotice(`Função de ${profile.email} atualizada.`); await loadData('OWNER') }
  }

  const clickCounts = useMemo(() => clicks.reduce<Record<string, number>>((counts, event) => {
    counts[event.product_id] = (counts[event.product_id] ?? 0) + 1
    return counts
  }, {}), [clicks])
  const dailyClicks = useMemo(() => clicks.reduce<Record<string, number>>((counts, event) => {
    const day = new Date(event.clicked_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    counts[day] = (counts[day] ?? 0) + 1
    return counts
  }, {}), [clicks])
  const visibleMenu = menu.filter((item) => item.id !== 'users' || role === 'OWNER').filter((item) => item.id !== 'audit' || role === 'OWNER' || role === 'ADMIN').filter((item) => item.id !== 'campaigns' || role === 'OWNER' || role === 'ADMIN')
  const activeProducts = products.filter((product) => product.is_active).length
  const inactiveProducts = products.length - activeProducts
  const maxDailyClicks = Math.max(1, ...Object.values(dailyClicks))

  if (!configured) return <main className="auth-wrap"><section className="auth-card"><span className="brand-icon"><Boxes size={18} /></span><div className="eyebrow mt-5">CONFIGURAÇÃO SUPABASE</div><h1>Conecte seu projeto</h1><p>Defina <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> em <code>platform/.env.local</code>. A chave service_role nunca deve ser colocada neste arquivo.</p><div className="setup-notice">O painel permanece desativado até as variáveis públicas e a migration RLS serem configuradas.</div></section></main>
  if (!authReady || loading) return <main className="click-status"><span className="status-dot" /><p>Carregando painel seguro...</p></main>
  if (!user) return <LoginForm onLogin={login} message={notice} error={error} />
  if (!role) return <main className="click-status"><h1>Perfil sem função</h1><p>Peça ao proprietário para revisar seu perfil no Supabase.</p><Button variant="secondary" onClick={signOut}><LogOut size={14} /> Sair</Button></main>

  return <main className="admin-shell"><header className="admin-topbar"><Link className="site-brand" href="/"><span className="brand-icon"><Boxes size={17} /></span><span>garimpo<small>console de curadoria</small></span></Link><div className="flex items-center gap-3"><RoleBadge role={role} /><span className="hidden text-xs text-muted sm:inline">{displayName}</span><Button variant="ghost" size="sm" onClick={signOut}><LogOut size={14} /> Sair</Button></div></header><div className="admin-layout"><nav className="admin-sidebar" aria-label="Navegação administrativa">{visibleMenu.map((item) => <button key={item.id} className={`admin-nav-button ${tab === item.id ? 'active' : ''}`} onClick={() => { setTab(item.id); setError(''); setNotice('') }}><item.icon size={16} /><span>{item.label}</span></button>)}</nav><section className="admin-content"><div className="admin-panel">{notice && <div className="admin-message">{notice}</div>}{error && <div className="admin-message error">{error}</div>}
    {tab === 'overview' && <><div className="admin-heading"><div><div className="eyebrow">VISÃO GERAL</div><h1>Olá, {displayName.split(' ')[0]}</h1><p>Métricas reais de catálogo e cliques, sem estimar vendas ou faturamento.</p></div><Badge><Activity size={13} /> Ao vivo do Supabase</Badge></div><div className="admin-stats"><Stat label="Produtos cadastrados" value={products.length} icon={<Package size={17} />} /><Stat label="Produtos ativos" value={activeProducts} icon={<BadgeCheck size={17} />} /><Stat label="Produtos inativos" value={inactiveProducts} icon={<Archive size={17} />} /><Stat label="Cliques registrados" value={role === 'EDITOR' ? 'Restrito' : totalClicks} icon={<ExternalLink size={17} />} /></div>{role !== 'EDITOR' && <div className="admin-dashboard-grid"><Card><CardHeader><CardTitle><ChartNoAxesCombined size={17} /> Cliques nos últimos 30 dias</CardTitle></CardHeader><CardContent><div className="click-bars">{Object.entries(dailyClicks).slice(-14).map(([day, count]) => <div className="click-bar-column" key={day} title={`${day}: ${count}`}><span style={{ height: `${Math.max(4, count / maxDailyClicks * 100)}%` }} /><small>{day}</small></div>)}{Object.keys(dailyClicks).length === 0 && <p className="text-sm text-muted">Ainda não há cliques registrados.</p>}</div></CardContent></Card><Card><CardHeader><CardTitle><Package size={17} /> Mais clicados</CardTitle></CardHeader><CardContent><div className="top-click-list">{products.slice().sort((a, b) => (clickCounts[b.id] ?? 0) - (clickCounts[a.id] ?? 0)).slice(0, 5).map((product, index) => <div key={product.id}><span>{index + 1}</span><strong>{product.name}</strong><Badge>{clickCounts[product.id] ?? 0}</Badge></div>)}{products.length === 0 && <p className="text-sm text-muted">Cadastre produtos para ver o ranking.</p>}</div></CardContent></Card></div>}</>}
    {tab === 'products' && <><div className="admin-heading"><div><div className="eyebrow">CATÁLOGO</div><h1>Produtos</h1><p>Cadastre, edite e controle o que aparece na vitrine.</p></div><Button onClick={() => startProduct()}><Plus size={15} /> Novo produto</Button></div>{formOpen && <Card className="mb-4"><CardHeader><div className="flex items-center justify-between"><CardTitle>{editingProduct ? 'Editar produto' : 'Cadastrar produto'}</CardTitle><Button variant="ghost" size="icon" onClick={() => setFormOpen(false)} aria-label="Fechar formulário"><X size={16} /></Button></div></CardHeader><CardContent><form className="admin-form-grid" onSubmit={saveProduct}>
      <Field label="Nome"><Input maxLength={180} value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} required /></Field>
      <Field label="Categoria"><select value={productForm.category_id} onChange={(event) => setProductForm({ ...productForm, category_id: event.target.value })} required><option value="">Selecione</option>{categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
      <Field label="Preço original (opcional)"><Input type="number" min="0.01" step="0.01" value={productForm.original_price} onChange={(event) => setProductForm({ ...productForm, original_price: event.target.value })} /></Field>
      <Field label="Preço atual"><Input type="number" min="0.01" step="0.01" value={productForm.current_price} onChange={(event) => setProductForm({ ...productForm, current_price: event.target.value })} required /></Field>
      <Field label="Link de afiliado" wide><Input type="url" placeholder="https://s.shopee.com.br/..." value={productForm.affiliate_url} onChange={(event) => setProductForm({ ...productForm, affiliate_url: event.target.value })} required /></Field>
      <Field label="Descrição" wide><textarea maxLength={5000} rows={3} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></Field>
      <Field label="Imagem do produto" wide><label className="file-picker"><ImagePlus size={16} />{imageFile?.name ?? 'Escolha JPG, PNG, WebP ou AVIF (máx. 5 MB)'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label></Field>
      <label className="check-field"><input type="checkbox" checked={productForm.is_featured} onChange={(event) => setProductForm({ ...productForm, is_featured: event.target.checked })} /> Destaque</label><label className="check-field"><input type="checkbox" checked={productForm.is_active} onChange={(event) => setProductForm({ ...productForm, is_active: event.target.checked })} /> Produto ativo na vitrine</label>
      <div className="admin-actions wide"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button><Button><Save size={14} /> Salvar produto</Button></div>
    </form></CardContent></Card>}
    <AdminTable headers={['PRODUTO', 'CATEGORIA', 'PREÇO', 'STATUS', 'DESTAQUE', 'AÇÕES']}><>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{Array.isArray(product.categories) ? product.categories[0]?.name ?? '—' : product.categories?.name ?? '—'}</td><td>{formatCurrency(product.current_price)}</td><td><Badge className={product.is_active ? 'state-active' : 'state-inactive'}>{product.is_active ? 'Ativo' : 'Inativo'}</Badge></td><td>{product.is_featured ? 'Sim' : 'Não'}</td><td><div className="admin-actions"><Button variant="secondary" size="sm" onClick={() => startProduct(product)}><Pencil size={13} /> Editar</Button><Button variant="secondary" size="sm" onClick={() => void toggleProduct(product, 'is_active')}>{product.is_active ? 'Desativar' : 'Ativar'}</Button><Button variant="ghost" size="icon" disabled={role === 'EDITOR'} onClick={() => void deleteProduct(product)} title="Excluir produto" aria-label={`Excluir ${product.name}`}><Trash2 size={14} /></Button></div></td></tr>)}</></AdminTable></>}
    {tab === 'categories' && <><div className="admin-heading"><div><div className="eyebrow">ORGANIZAÇÃO</div><h1>Categorias</h1><p>Gerencie as categorias exibidas nos filtros da vitrine.</p></div></div>{(role === 'OWNER' || role === 'ADMIN') && <Card className="mb-4"><CardContent><form className="flex flex-wrap gap-2 pt-5" onSubmit={createCategory}><Input className="max-w-sm" placeholder="Nome da categoria" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} minLength={2} maxLength={80} required /><Button><Plus size={14} /> Criar categoria</Button></form></CardContent></Card>}<AdminTable headers={['CATEGORIA', 'SLUG', 'STATUS', 'AÇÕES']}><>{categories.map((category) => <tr key={category.id}><td><strong>{category.name}</strong></td><td>{category.slug}</td><td><Badge className={category.is_active ? 'state-active' : 'state-inactive'}>{category.is_active ? 'Ativa' : 'Inativa'}</Badge></td><td>{(role === 'OWNER' || role === 'ADMIN') && <Button variant="secondary" size="sm" onClick={() => void setCategoryActive(category)}>{category.is_active ? 'Desativar' : 'Ativar'}</Button>}</td></tr>)}</></AdminTable></>}
    {tab === 'campaigns' && <><div className="admin-heading"><div><div className="eyebrow">ATRIBUIÇÃO DE TRÁFEGO</div><h1>Campanhas</h1><p>Use o identificador da campanha nos links de saída para comparar cliques.</p></div></div>{(role === 'OWNER' || role === 'ADMIN') && <Card className="mb-4"><CardContent><form className="flex flex-wrap gap-2 pt-5" onSubmit={createCampaign}><Input className="max-w-sm" placeholder="Nome da campanha" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} minLength={2} maxLength={120} required /><Button><Plus size={14} /> Criar campanha</Button></form></CardContent></Card>}<AdminTable headers={['CAMPANHA', 'IDENTIFICADOR', 'STATUS', 'CLIQUES (30 DIAS)', 'LINK DE EXEMPLO']}><>{campaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.name}</strong></td><td><code>{campaign.slug}</code></td><td>{(role === 'OWNER' || role === 'ADMIN') ? <Button variant="secondary" size="sm" onClick={() => void toggleCampaign(campaign)}>{campaign.is_active ? 'Ativa' : 'Inativa'}</Button> : campaign.is_active ? 'Ativa' : 'Inativa'}</td><td>{clicks.filter((event) => event.campaign_id === campaign.id).length}</td><td><code>{`/go/?id=PRODUCT_UUID&campaign=${campaign.id}`}</code></td></tr>)}</></AdminTable></>}
    {tab === 'users' && role === 'OWNER' && <><div className="admin-heading"><div><div className="eyebrow">CONTROLE DE ACESSO</div><h1>Usuários</h1><p>Convide ADMIN ou EDITOR. A função OWNER não pode ser atribuída por convite.</p></div></div><Card className="mb-4"><CardContent><form className="invite-form pt-5" onSubmit={inviteUser}><Field label="Email"><Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /></Field><Field label="Função"><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'ADMIN' | 'EDITOR')}><option value="EDITOR">EDITOR</option><option value="ADMIN">ADMIN</option></select></Field><Button><Plus size={14} /> Enviar convite</Button></form><p className="mt-3 text-xs text-muted">O envio usa uma Cloudflare Pages Function com chave service_role guardada como segredo. Em desenvolvimento local, convide usuários pelo painel Supabase.</p></CardContent></Card><AdminTable headers={['NOME', 'EMAIL', 'FUNÇÃO']}><>{profiles.map((profile) => <tr key={profile.id}><td>{profile.display_name || '—'}</td><td>{profile.email}</td><td>{profile.role === 'OWNER' || profile.id === user?.id ? <RoleBadge role={profile.role} /> : <select aria-label={`Função de ${profile.email}`} value={profile.role} onChange={(event) => void changeUserRole(profile, event.target.value as 'ADMIN' | 'EDITOR')}><option value="EDITOR">EDITOR</option><option value="ADMIN">ADMIN</option></select>}</td></tr>)}</></AdminTable></>}
    {tab === 'audit' && (role === 'OWNER' || role === 'ADMIN') && <><div className="admin-heading"><div><div className="eyebrow">RASTREABILIDADE</div><h1>Histórico de alterações</h1><p>Eventos gerados por triggers no banco Supabase.</p></div></div><AdminTable headers={['DATA', 'ENTIDADE', 'ID', 'AÇÃO']}><>{auditLogs.map((entry) => <tr key={entry.id}><td>{new Date(entry.created_at).toLocaleString('pt-BR')}</td><td>{entry.entity_type}</td><td><code>{entry.entity_id.slice(0, 12)}</code></td><td>{entry.action}</td></tr>)}</></AdminTable></>}
    {loading && <div className="admin-loading">Atualizando dados do Supabase...</div>}
    <footer className="admin-footer"><span>GARIMPO · ADMIN</span><span>RLS ativo · {role}</span></footer>
  </div></section></div></main>
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`admin-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <article className="stat-card"><div className="flex items-center justify-between text-primary">{label}{icon}</div><strong>{value}</strong></article>
}

function AdminTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}