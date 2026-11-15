import Link from 'next/link'
import { studioUrl } from '@/lib/studio'

/**
 * Stub — auction listing creation (owned NFTs only).
 * No mint / metadata / burn-to-mint here; those belong in studio.
 */
export default function CreateAuctionStubPage() {
  return (
    <div className="sm-container py-16 max-w-xl">
      <p className="sm-play text-sm text-sky-deep mb-2">Studio</p>
      <h1 className="sm-heading text-3xl md:text-4xl">Create an auction</h1>
      <p className="mt-4 text-mute text-sm leading-relaxed">
        Timed English auction listings are created in cryptoart.studio. such.market surfaces live lots
        once the indexer is running.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={studioUrl('/create/auction')} className="sm-btn-primary" target="_blank" rel="noreferrer">
          Open in studio
        </a>
        <Link href="/auctions" className="sm-btn-secondary">
          View auctions
        </Link>
        <Link href="/create" className="sm-btn-secondary">
          Create a pool instead
        </Link>
      </div>
    </div>
  )
}
