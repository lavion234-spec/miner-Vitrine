import { Suspense } from 'react'
import ClickRedirect from '@/components/click-redirect'

export default function GoPage() {
  return <Suspense fallback={<main className="click-status"><span className="status-dot" /><p>Conferindo a oferta...</p></main>}><ClickRedirect /></Suspense>
}