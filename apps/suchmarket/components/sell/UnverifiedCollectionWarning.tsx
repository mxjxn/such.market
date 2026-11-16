import Link from 'next/link'
import { Address } from 'viem'
import { getCollectionVerification } from '@/lib/collection-verification'

export function UnverifiedCollectionWarning({
  chainId,
  contract,
}: {
  chainId: number
  contract: Address | undefined
}) {
  if (!contract) return null

  const { verified } = getCollectionVerification(chainId, contract)
  if (verified) return null

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-50/80 px-4 py-3 text-sm text-ink">
      <p className="sm-heading text-sm text-amber-900">Unverified collection</p>
      <p className="mt-1 text-xs text-mute leading-relaxed">
        You can still list this contract on the auction house. Unverified collections may be hidden from
        default discovery surfaces until curated. Studio-minted collections are auto-verified; others can{' '}
        <Link href="/verify-collection" className="text-sky-deep hover:underline">
          apply for verification
        </Link>
        .
      </p>
    </div>
  )
}