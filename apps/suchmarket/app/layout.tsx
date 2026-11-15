import type { Metadata } from 'next'
import { Comic_Neue, Luckiest_Guy, Sora } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'

const comicNeue = Comic_Neue({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-comic',
  display: 'swap',
})

const luckiestGuy = Luckiest_Guy({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-wordmark',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'such.market — NFT AMM pools',
  description:
    'Buy and sell cryptoart on bonding-curve liquidity pools. Create pools, trade on the curve, and stay liquid on Base.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${comicNeue.variable} ${luckiestGuy.variable} ${sora.variable}`}>
      <body className="font-sans min-h-screen flex flex-col bg-paper text-ink antialiased">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  )
}
