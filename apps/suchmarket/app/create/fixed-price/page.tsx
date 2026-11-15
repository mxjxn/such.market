import Link from 'next/link'

/**
 * Stub — fixed-price listing creation (owned NFTs only).
 * No mint / metadata / burn-to-mint here; those belong in studio.
 */
export default function CreateFixedPriceStubPage() {
  return (
    <div className="sm-container py-16 max-w-xl">
      <p className="sm-play text-sm text-sky-deep mb-2">Coming soon</p>
      <h1 className="sm-heading text-3xl md:text-4xl">Create a fixed-price listing</h1>
      <p className="mt-4 text-mute text-sm leading-relaxed">
        Set a single ask for NFTs you already own. This marketplace listing type is reserved here;
        minting and metadata stay in cryptoart.studio.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="sm-btn-secondary">
          Back home
        </Link>
        <Link href="/create" className="sm-btn-primary">
          Create a pool instead
        </Link>
      </div>
    </div>
  )
}
