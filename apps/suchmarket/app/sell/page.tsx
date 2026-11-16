import Link from 'next/link'
import { Suspense } from 'react'
import { SellFlow } from '@/components/sell/SellFlow'

export default function SellPage() {
  return (
    <div className="sm-band-sky min-h-full">
      <div className="sm-container py-10 md:py-14 max-w-2xl">
        <p className="sm-play text-sm text-sky-deep mb-2">Sell</p>
        <h1 className="sm-heading text-3xl md:text-4xl">List an NFT you own</h1>
        <p className="mt-4 text-mute text-sm leading-relaxed">
          List a timed <strong>English auction</strong> or <strong>fixed-price</strong> sale on the shared
          marketplace contract. Connect your wallet, pick a token, approve the marketplace, and confirm on-chain.
          LSSVM pools stay under{' '}
          <Link href="/create" className="text-sky-deep hover:underline">
            Create pool
          </Link>
          .
        </p>
        <Suspense fallback={<div className="sm-card p-6 mt-8 text-sm text-mute">Loading…</div>}>
          <SellFlow />
        </Suspense>
      </div>
    </div>
  )
}