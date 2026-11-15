import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchAuctionById } from '@/lib/auctions-server'
import { AuctionBidPanel } from '@/components/auctions/AuctionBidPanel'
import { getChainName, isSupportedChainId } from '@/lib/chains'

export default async function AuctionDetailPage({
  params,
}: {
  params: { chainId: string; listingId: string }
}) {
  const chainId = parseInt(params.chainId, 10)
  if (!isSupportedChainId(chainId)) notFound()
  let listingId: bigint
  try {
    listingId = BigInt(params.listingId)
  } catch {
    notFound()
  }

  const auction = await fetchAuctionById(chainId, listingId)
  if (!auction) notFound()

  return (
    <div className="sm-band-sky min-h-full">
      <div className="sm-container py-10 md:py-14">
        <Link href="/auctions" className="text-sm text-sky-deep hover:underline">
          ← All auctions
        </Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="sm-card overflow-hidden">
              {auction.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={auction.imageUrl}
                  alt=""
                  className="w-full aspect-square object-cover bg-mist"
                />
              ) : (
                <div className="aspect-square grid place-items-center bg-mist text-mute">NFT</div>
              )}
            </div>
          </div>
          <div>
            <p className="sm-play text-sm text-sky-deep">{getChainName(chainId)}</p>
            <h1 className="sm-heading text-3xl mt-1">
              {auction.title || `Auction #${auction.listingId}`}
            </h1>
            <p className="mt-2 text-sm text-mute font-mono break-all">
              {auction.tokenAddress} · token {auction.tokenId}
            </p>
            <div className="mt-6">
              <AuctionBidPanel chainId={chainId} listingId={listingId} listing={auction.listing} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}