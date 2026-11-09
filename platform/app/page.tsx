import type { Metadata } from 'next'
import Storefront from '@/components/storefront'

export const metadata: Metadata = {
  title: 'Ofertas selecionadas',
  description: 'Confira ofertas e produtos selecionados pela nossa curadoria.',
}

export default function HomePage() {
  return <Storefront />
}