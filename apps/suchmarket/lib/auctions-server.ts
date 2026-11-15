import { Address, formatEther, decodeEventLog, parseAbiItem } from 'viem'
import { getChainConfig } from './chain-config'
import { getPublicClient } from './rpc'
import {
  MARKETPLACE_ABI,
  getMarketplaceAddress,
  isActiveAuction,
  isAuctionListing,
  ListingType,
  type ContractListing,
} from './marketplace'
import { hasDatabase, listAuctionListingIds } from '@/indexer/db'
import { resolveIPFSUrl } from './ipfs'

export type AuctionSummary = {
  chainId: number
  listingId: string
  title?: string
  imageUrl?: string
  currentBid: string
  reserve: string
  endsAt: number
  startsAt: number
  seller: string
  tokenAddress: string
  tokenId: string
  hasBid: boolean
}

async function fetchListing(chainId: number, listingId: bigint): Promise<ContractListing | null> {
  try {
    const client = getPublicClient(chainId)
    const marketplace = getMarketplaceAddress(chainId)
    return (await client.readContract({
      address: marketplace,
      abi: MARKETPLACE_ABI,
      functionName: 'getListing',
      args: [Number(listingId)],
    })) as unknown as ContractListing
  } catch {
    return null
  }
}

async function enrichMedia(
  tokenAddress: Address,
  tokenId: bigint,
  chainId: number
): Promise<{ title?: string; imageUrl?: string }> {
  try {
    const client = getPublicClient(chainId)
    const uri = (await client.readContract({
      address: tokenAddress,
      abi: [
        {
          inputs: [{ name: 'tokenId', type: 'uint256' }],
          name: 'tokenURI',
          outputs: [{ type: 'string' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'tokenURI',
      args: [tokenId],
    })) as string
    const resolved = resolveIPFSUrl(uri)
    const res = await fetch(resolved, { next: { revalidate: 300 } })
    if (!res.ok) return {}
    const meta = (await res.json()) as { name?: string; title?: string; image?: string }
    const image = meta.image ? resolveIPFSUrl(meta.image) : undefined
    return { title: meta.name || meta.title, imageUrl: image }
  } catch {
    return {}
  }
}

function listingToSummary(chainId: number, listing: ContractListing): AuctionSummary {
  const bid = listing.bid.amount > 0n ? listing.bid.amount : 0n
  const reserve = listing.details.initialAmount
  return {
    chainId,
    listingId: listing.id.toString(),
    currentBid: formatEther(bid),
    reserve: formatEther(reserve),
    endsAt: Number(listing.details.endTime),
    startsAt: Number(listing.details.startTime),
    seller: listing.seller,
    tokenAddress: listing.token.address_,
    tokenId: listing.token.id.toString(),
    hasBid: listing.bid.amount > 0n,
  }
}

/** Discover listing IDs: Postgres index when available, else recent CreateListing scan is empty — returns []. */
const CREATE_LISTING = parseAbiItem(
  'event CreateListing(uint40 indexed listingId, uint16 marketplaceBPS, uint16 referrerBPS, uint8 listingType, uint24 totalAvailable, uint24 totalPerSale, uint48 startTime, uint48 endTime, uint256 initialAmount, uint16 extensionInterval, uint16 minIncrementBPS, address erc20, address identityVerifier)'
)

async function discoverListingIdsRpc(chainId: number, limit: number): Promise<bigint[]> {
  try {
    const marketplace = getMarketplaceAddress(chainId)
    const client = getPublicClient(chainId)
    const latest = await client.getBlockNumber()
    const cfg = getChainConfig(chainId)
    const from = cfg?.marketplaceStartBlock ?? latest - 500_000n
    const logs = await client.getLogs({
      address: marketplace,
      event: CREATE_LISTING,
      fromBlock: from > latest ? 0n : from,
      toBlock: latest,
    })
    const ids: bigint[] = []
    for (const log of logs.reverse()) {
      try {
        const decoded = decodeEventLog({ abi: [CREATE_LISTING], data: log.data, topics: log.topics })
        const args = decoded.args as { listingId: bigint | number; listingType: number }
        const listingId =
          typeof args.listingId === 'bigint' ? args.listingId : BigInt(args.listingId)
        const listingType = Number(args.listingType)
        if (listingType !== ListingType.INDIVIDUAL_AUCTION) continue
        ids.push(listingId)
        if (ids.length >= limit) break
      } catch {
        /* skip */
      }
    }
    return ids
  } catch {
    return []
  }
}

async function discoverListingIds(chainId: number, limit: number): Promise<bigint[]> {
  if (hasDatabase()) {
    try {
      const ids = await listAuctionListingIds(chainId, limit)
      if (ids.length) return ids
    } catch {
      /* fall through */
    }
  }
  return discoverListingIdsRpc(chainId, limit)
}

export async function fetchLiveAuctions(chainId: number, limit = 20): Promise<AuctionSummary[]> {
  let marketplace: Address
  try {
    marketplace = getMarketplaceAddress(chainId)
  } catch {
    return []
  }
  void marketplace

  const ids = await discoverListingIds(chainId, limit * 3)
  const auctions: AuctionSummary[] = []

  for (const id of ids) {
    const listing = await fetchListing(chainId, id)
    if (!listing || !isAuctionListing(listing) || !isActiveAuction(listing)) continue
    const summary = listingToSummary(chainId, listing)
    const media = await enrichMedia(
      listing.token.address_,
      listing.token.id,
      chainId
    )
    auctions.push({ ...summary, ...media })
    if (auctions.length >= limit) break
  }

  return auctions
}

export async function fetchAuctionById(
  chainId: number,
  listingId: bigint
): Promise<(AuctionSummary & { listing: ContractListing }) | null> {
  const listing = await fetchListing(chainId, listingId)
  if (!listing || !isAuctionListing(listing)) return null
  const summary = listingToSummary(chainId, listing)
  const media = await enrichMedia(listing.token.address_, listing.token.id, chainId)
  return { ...summary, ...media, listing }
}

export { ListingType, type ContractListing }