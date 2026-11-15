import Link from 'next/link'

/**
 * Stub — such.market Sell flow (auction + fixed-price on the shared marketplace contract).
 * Implementation tracked in docs/ROADMAP.md (day-one launch scope).
 */
export default function SellPage() {
  return (
    <div className="sm-band-sky min-h-full">
      <div className="sm-container py-10 md:py-14 max-w-xl">
        <p className="sm-play text-sm text-sky-deep mb-2">Sell</p>
        <h1 className="sm-heading text-3xl md:text-4xl">List an NFT you own</h1>
        <p className="mt-4 text-mute text-sm leading-relaxed">
          Day-one launch uses the same **auction house / marketplace contract** as cryptoart.studio:
          timed **English auctions** and **fixed-price** listings. This route will host such.market&apos;s
          own sell flow (wallet connect → pick NFT → list on-chain). Pools stay under{' '}
          <Link href="/create" className="text-sky-deep hover:underline">
            Create pool
          </Link>
          .
        </p>
        <p className="mt-3 text-mute text-sm leading-relaxed">
          Studio artists can already list from the studio app without opening such.market; that flow lives
          in the cryptoart-studio repository.
        </p>
        <div className="sm-card p-6 mt-8 space-y-4">
          <ListingTypeStub title="Auction" body="Timed English auction for one or more tokens you hold." />
          <ListingTypeStub title="Fixed price" body="Set a single ask; buyers fill from the marketplace contract." />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/explore" className="sm-btn-secondary">
            Explore pools
          </Link>
          <Link href="/auctions" className="sm-btn-secondary">
            Browse auctions
          </Link>
        </div>
      </div>
    </div>
  )
}

function ListingTypeStub({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border-2 border-line px-4 py-3.5 opacity-90">
      <p className="sm-heading text-base text-ink">{title}</p>
      <p className="mt-0.5 text-xs text-mute leading-relaxed">{body}</p>
      <p className="mt-2 sm-play text-[11px] uppercase tracking-wider text-soft">Coming in Sell flow</p>
    </div>
  )
}