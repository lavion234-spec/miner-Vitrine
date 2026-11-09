import type { Metadata } from 'next'
import './globals.css'
import './admin-ui.css'

export const metadata: Metadata = {
  title: { default: 'Garimpo | Ofertas selecionadas', template: '%s | Garimpo' },
  description: 'Produtos e ofertas selecionados, com links de afiliado identificados e preços transparentes.',
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>
}