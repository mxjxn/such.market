'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SiteFooter() {
  const pathname = usePathname()
  if (pathname?.startsWith('/embed')) return null

  return (
    <footer className="sm-footer-bar mt-auto">
      <div className="sm-container py-10 flex flex-col sm:flex-row gap-6 sm:items-end sm:justify-between">
        <div>
          <p className="sm-wordmark text-2xl text-white">such.market</p>
          <p className="mt-1 max-w-md text-sm text-white/85 leading-relaxed">
            NFT AMM pools on Base — the sales home for the cryptoart ecosystem. Studio launches
            contracts; social embeds the market; auctions arrive here next.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-white/90">
          <Link href="/explore" className="hover:text-white underline-offset-2 hover:underline">
            Explore
          </Link>
          <Link href="/create" className="hover:text-white underline-offset-2 hover:underline">
            Create pool
          </Link>
          <Link href="/auctions" className="hover:text-white underline-offset-2 hover:underline">
            Auctions
          </Link>
          <a
            href="https://github.com/mxjxn/such-lssvm"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white underline-offset-2 hover:underline"
          >
            Protocol
          </a>
        </div>
      </div>
    </footer>
  )
}
