import type { Metadata } from 'next'
import { Suspense } from 'react'
import ProductDetail from '@/components/product-detail'

export const metadata: Metadata = { title: 'Detalhes do produto' }

export default function ProductPage() {
  return <Suspense fallback={<main className="click-status"><p>Carregando produto...</p></main>}><ProductDetail /></Suspense>
}