import { useEffect, useState } from 'react'
import { ArrowUpRight, Check, Edit3, ExternalLink, Plus, Save, ShieldCheck, Store, X } from 'lucide-react'
import './manual-offers.css'

const API = import.meta.env.VITE_API_URL ?? ''
const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://127.0.0.1:5174'
type PublicationStatus = 'draft' | 'published' | 'archived'
type ManualOffer = {
  id: number
  name: string
  description: string | null
  category: string
  current_price: number
  original_price: number | null
  commission_rate: number | null
  estimated_commission_per_sale: number | null
  image_url: string | null
  affiliate_url: string | null
  publication_status: PublicationStatus
  published_at: string | null
}
type OfferForm = {
  name: string
  description: string
  category: string
  current_price: string
  original_price: string
  commission_rate: string
  image_url: string
  affiliate_url: string
  publication_status: PublicationStatus
}

const emptyForm: OfferForm = {
  name: '', description: '', category: '', current_price: '', original_price: '',
  commission_rate: '', image_url: '', affiliate_url: '', publication_status: 'draft',
}
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ManualOffers({ token }: { token: string }) {
  const [offers, setOffers] = useState<ManualOffer[]>([])
  const [form, setForm] = useState<OfferForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function loadOffers() {
    setLoading(true)
    try {
      const response = await fetch(`${API}/api/admin/manual-offers`, { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json()
      if (!response.ok) throw new Error(body.detail ?? 'Nao foi possivel carregar as ofertas.')
      setOffers(body)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao carregar ofertas.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadOffers() }, [token])

  function editOffer(offer: ManualOffer) {
    setEditingId(offer.id)
    setForm({
      name: offer.name,
      description: offer.description ?? '',
      category: offer.category,
      current_price: String(offer.current_price),
      original_price: offer.original_price === null ? '' : String(offer.original_price),
      commission_rate: offer.commission_rate === null ? '' : String(offer.commission_rate),
      image_url: offer.image_url ?? '',
      affiliate_url: offer.affiliate_url ?? '',
      publication_status: offer.publication_status,
    })
    setFormOpen(true)
    setNotice('')
    setError('')
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setFormOpen(false)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError(''); setNotice('')
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim(),
      current_price: Number(form.current_price),
      original_price: form.original_price ? Number(form.original_price) : null,
      commission_rate: form.commission_rate ? Number(form.commission_rate) : null,
      image_url: form.image_url.trim() || null,
      affiliate_url: form.affiliate_url.trim() || null,
      publication_status: form.publication_status,
    }
    try {
      const response = await fetch(`${API}/api/admin/manual-offers${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(Array.isArray(body.detail) ? body.detail.map((item: { msg: string }) => item.msg).join(' ') : body.detail ?? 'Nao foi possivel salvar a oferta.')
      setNotice(payload.publication_status === 'published' ? 'Oferta publicada na vitrine.' : 'Rascunho salvo. Ele nao aparece na vitrine publica.')
      resetForm()
      await loadOffers()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao salvar oferta.') }
    finally { setSaving(false) }
  }

  return <>
    <section className="page-heading compact"><div><div className="overline">CATALOGO <span className="heading-separator">/</span> CADASTRO MANUAL</div><h1>Ofertas <span>manuais</span></h1><p>Cadastre agora; publique somente quando revisar os dados e inserir seu link de afiliado.</p></div><button className="primary-button" onClick={() => { resetForm(); setFormOpen(true) }}><Plus size={16} /> Nova oferta</button></section>
    <div className="manual-safety"><span><ShieldCheck size={17} /></span><p><strong>Sem chave da API Shopee.</strong> Informe os dados e o link afiliado que você gerou. O sistema valida o domínio, mas não consegue confirmar a atribuição de comissão.</p><a href={STOREFRONT_URL} target="_blank" rel="noreferrer">Abrir vitrine <ArrowUpRight size={14} /></a></div>
    {notice && <div className="manual-feedback success"><Check size={15} />{notice}<button onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={14} /></button></div>}
    {error && <div className="manual-feedback error">{error}<button onClick={() => setError('')} aria-label="Fechar erro"><X size={14} /></button></div>}
    {formOpen && <section className="panel manual-form-panel"><div className="manual-form-heading"><div><div className="panel-kicker">{editingId ? 'EDITAR CADASTRO' : 'NOVO CADASTRO'}</div><h2>{editingId ? 'Revise a oferta' : 'Detalhes da oferta'}</h2></div><button className="icon-button" onClick={resetForm} aria-label="Fechar formulario"><X size={17} /></button></div><form className="manual-form" onSubmit={submit}>
      <label className="field-wide">Nome do produto<input maxLength={240} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
      <label>Categoria<input maxLength={100} placeholder="Ex.: Casa e cozinha" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /></label>
      <label>Preco atual (R$)<input type="number" min="0.01" step="0.01" value={form.current_price} onChange={(event) => setForm({ ...form, current_price: event.target.value })} required /></label>
      <label>Preco anterior (opcional)<input type="number" min="0.01" step="0.01" value={form.original_price} onChange={(event) => setForm({ ...form, original_price: event.target.value })} /><small>Informe apenas se confirmado.</small></label>
      <label>Comissao informada (%)<input type="number" min="0" max="100" step="0.01" value={form.commission_rate} onChange={(event) => setForm({ ...form, commission_rate: event.target.value })} /><small>Uso interno; nao aparece na vitrine.</small></label>
      <label className="field-wide">Descricao<textarea maxLength={2000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <label className="field-wide">URL da imagem (HTTPS)<input type="url" placeholder="https://..." value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} /></label>
      <label className="field-wide">Seu link afiliado Shopee<input type="url" placeholder="https://s.shopee.com.br/..." value={form.affiliate_url} onChange={(event) => setForm({ ...form, affiliate_url: event.target.value })} /><small>Para publicar, use um link https://shopee.com.br, subdominio Shopee ou shope.ee.</small></label>
      <label>Status<select value={form.publication_status} onChange={(event) => setForm({ ...form, publication_status: event.target.value as PublicationStatus })}><option value="draft">Rascunho</option><option value="published">Publicada na vitrine</option><option value="archived">Arquivada</option></select></label>
      <div className="manual-form-actions"><button className="secondary-button" type="button" onClick={resetForm}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Salvando...' : <><Save size={15} />{form.publication_status === 'published' ? 'Salvar e publicar' : 'Salvar oferta'}</>}</button></div>
    </form></section>}
    <section className="panel manual-list-panel"><div className="panel-heading"><div><div className="panel-kicker">GERENCIAMENTO</div><h2>Suas ofertas</h2></div><span className="table-count">{offers.length} cadastradas</span></div>{loading ? <div className="empty-state">Carregando ofertas...</div> : offers.length === 0 ? <div className="empty-state"><div className="empty-icon"><Store size={20} /></div><strong>Nenhuma oferta manual</strong><span>Adicione um produto para iniciar sua vitrine.</span><button className="text-action" onClick={() => setFormOpen(true)}><Plus size={14} /> Cadastrar oferta</button></div> : <div className="manual-offer-list">{offers.map((offer) => <article className="manual-offer-row" key={offer.id}><div className="manual-offer-image">{offer.image_url ? <img src={offer.image_url} alt="" /> : <Store size={18} />}</div><div className="manual-offer-main"><strong>{offer.name}</strong><span>{offer.category} · {money(offer.current_price)}{offer.original_price ? ` · De ${money(offer.original_price)}` : ''}</span><span className="internal-commission">{offer.estimated_commission_per_sale == null ? 'Comissao nao informada' : `${money(offer.estimated_commission_per_sale)} estimados por venda`}</span></div><span className={`publication-chip ${offer.publication_status}`}>{offer.publication_status === 'published' ? 'Publicada' : offer.publication_status === 'archived' ? 'Arquivada' : 'Rascunho'}</span><span className={offer.affiliate_url ? 'link-status valid' : 'link-status'}>{offer.affiliate_url ? 'Link informado' : 'Sem link'}</span><button className="icon-button" onClick={() => editOffer(offer)} title="Editar oferta" aria-label={`Editar ${offer.name}`}><Edit3 size={15} /></button>{offer.publication_status === 'published' && offer.affiliate_url && <a className="icon-button" href={offer.affiliate_url} target="_blank" rel="noreferrer" title="Abrir link informado"><ExternalLink size={15} /></a>}</article>)}</div>}</section>
  </>
}