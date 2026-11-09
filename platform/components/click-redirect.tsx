'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSupabase, supabaseIsConfigured } from '@/lib/supabase/client'
import { affiliateHostAllowed } from '@/lib/utils'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function ClickRedirect() {
  const searchParams = useSearchParams()
  const productId = searchParams.get('id') ?? ''
  const campaignId = searchParams.get('campaign')
  const [message, setMessage] = useState('Conferindo a oferta...')
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    let active = true
    async function redirect() {
      const supabase = getSupabase()
      if (!supabase || !uuidPattern.test(productId)) {
        setMessage(supabase ? 'O identificador do produto é inválido.' : 'A vitrine ainda não está conectada ao catálogo.')
        setFinished(true)
        return
      }

      const { data: product, error } = await supabase.from('products').select('affiliate_url').eq('id', productId).eq('is_active', true).maybeSingle()
      if (error || !product || !affiliateHostAllowed(product.affiliate_url)) {
        if (active) { setMessage('Esta oferta está indisponível ou não possui um link afiliado válido.'); setFinished(true) }
        return
      }

      if (campaignId && uuidPattern.test(campaignId)) {
        await supabase.from('click_events').insert({ product_id: productId, campaign_id: campaignId })
      } else {
        await supabase.from('click_events').insert({ product_id: productId })
      }
      if (active) window.location.assign(product.affiliate_url)
    }
    void redirect().catch(() => {
      if (active) { setMessage('Não foi possível validar esta oferta.'); setFinished(true) }
    })
    return () => { active = false }
  }, [productId, campaignId])

  return <main className="click-status"><span className="status-dot" /><h1>{finished ? 'Oferta não aberta' : 'Indo para a oferta'}</h1><p>{message}</p>{finished && supabaseIsConfigured() && <Button asChild variant="secondary"><Link href="/"><ArrowLeft size={14} /> Voltar à vitrine</Link></Button>}{finished && !supabaseIsConfigured() && <Button asChild variant="secondary"><Link href="/admin/"><ExternalLink size={14} /> Abrir painel</Link></Button>}</main>
}