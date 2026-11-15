import Link from 'next/link'

/**
 * Stub — auction listing creation (owned NFTs only).
 * No mint / metadata / burn-to-mint here; those belong in studio.
 */
export default function CreateAuctionStubPage() {
  return (
    <div className="sm-container py-16 max-w-xl">
      <p className="sm-play text-sm text-sky-deep mb-2">Coming soon</p>
      <h1 className="sm-heading text-3xl md:text-4xl">Create an auction</h1>
      <p className="mt-4 text-mute text-sm leading-relaxed">
        List an NFT you already own in a timed English auction. Creation will live here once the
        auction house lands under such.market.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/auctions" className="sm-btn-secondary">
          View auctions
        </Link>
        <Link href="/create" className="sm-btn-primary">
          Create a pool instead
        </Link>
      </div>
    </div>
  )
}
