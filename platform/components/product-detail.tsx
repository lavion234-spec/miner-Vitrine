'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, ShieldCheck, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSupabase, supabaseIsConfigured } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { StoreProduct } from '@/components/storefront'

export default function ProductDetail() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [product, setProduct] = useState<StoreProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase || !id) { setLoading(false); return }
    void supabase.from('products').select('id,name,description,image_url,original_price,current_price,affiliate_url,category_id,is_featured,categories(id,name,slug)').eq('id', id).eq('is_active', true).maybeSingle().then(({ data, error: queryError }) => {
      if (queryError) setError(queryError.message)
      else setProduct(data as StoreProduct | null)
      setLoading(false)
    })
  }, [id])

  if (loading) return <main className="click-status"><span className="status-dot" /><p>Carregando produto...</p></main>
  if (!supabaseIsConfigured()) return <main className="click-status"><h1>Catálogo não configurado</h1><p>Conecte o projeto Supabase para consultar os produtos.</p><Button asChild variant="secondary"><Link href="/">Voltar à vitrine</Link></Button></main>
  if (error || !product) return <main className="click-status"><h1>Produto indisponível</h1><p>{error || 'Este produto não está ativo ou não existe.'}</p><Button asChild variant="secondary"><Link href="/">Voltar à vitrine</Link></Button></main>

  return <div className="site-shell"><header className="site-header"><Link className="site-brand" href="/"><span className="brand-icon"><Tag size={17} /></span><span>garimpo<small>de ofertas</small></span></Link><Link className="site-nav" href="/">Ofertas</Link></header><main className="detail-layout"><div className="detail-image">{product.image_url ? <img src={product.image_url} alt={product.name} /> : <Tag size={32} />}</div><section className="detail-copy"><div className="eyebrow">PRODUTO SELECIONADO</div><h1>{product.name}</h1><p>{product.description}</p><div className="product-price detail-price"><strong>{formatCurrency(product.current_price)}</strong>{product.original_price !== null && <del>{formatCurrency(product.original_price)}</del>}</div><div className="setup-notice"><ShieldCheck size={16} /> Preço e disponibilidade podem mudar na loja. Links de afiliado podem gerar comissão para a plataforma, sem custo extra para você.</div><Button asChild className="mt-5 w-full"><Link href={`/go/?id=${encodeURIComponent(product.id)}`}>Ver oferta <ArrowUpRight size={15} /></Link></Button><Button asChild variant="ghost" className="mt-2 w-full"><Link href="/"><ArrowLeft size={14} /> Voltar à vitrine</Link></Button></section></main></div>
}