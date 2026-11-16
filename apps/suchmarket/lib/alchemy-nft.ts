import { base, baseSepolia, mainnet } from 'viem/chains'

export function alchemyNftApiBaseUrl(chainId: number): string | null {
  if (chainId === mainnet.id) return 'https://eth-mainnet.g.alchemy.com/nft/v3'
  if (chainId === base.id) return 'https://base-mainnet.g.alchemy.com/nft/v3'
  if (chainId === baseSepolia.id) return 'https://base-sepolia.g.alchemy.com/nft/v3'
  return null
}

export function resolveAlchemyApiKey(): string | null {
  return (
    process.env.ALCHEMY_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY?.trim() ||
    null
  )
}

export type OwnedNftRow = {
  tokenId: string
  name: string | null
  image: string | null
  balance?: string
}

type AlchemyOwnedNft = {
  tokenId?: string
  name?: string
  image?: { originalUrl?: string; pngUrl?: string; cachedUrl?: string }
  balance?: string
}

export async function fetchOwnedNftsFromCollection(
  chainId: number,
  owner: string,
  contractAddress: string
): Promise<{ nfts: OwnedNftRow[]; source: 'alchemy' | 'unavailable' }> {
  const apiKey = resolveAlchemyApiKey()
  const baseUrl = alchemyNftApiBaseUrl(chainId)
  if (!apiKey || !baseUrl) {
    return { nfts: [], source: 'unavailable' }
  }

  const url = new URL(`${baseUrl}/${apiKey}/getNFTsForOwner`)
  url.searchParams.set('owner', owner)
  url.searchParams.set('contractAddresses[]', contractAddress)
  url.searchParams.set('withMetadata', 'true')
  url.searchParams.set('pageSize', '100')

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) {
    return { nfts: [], source: 'unavailable' }
  }

  const data = (await res.json()) as { ownedNfts?: AlchemyOwnedNft[] }
  const nfts = (data.ownedNfts ?? []).map((nft) => ({
    tokenId: nft.tokenId ?? '0',
    name: nft.name ?? null,
    image: nft.image?.originalUrl || nft.image?.pngUrl || nft.image?.cachedUrl || null,
    balance: nft.balance ? String(nft.balance) : undefined,
  }))

  nfts.sort((a, b) => {
    try {
      const diff = BigInt(a.tokenId) - BigInt(b.tokenId)
      return diff < 0n ? -1 : diff > 0n ? 1 : 0
    } catch {
      return a.tokenId.localeCompare(b.tokenId)
    }
  })

  return { nfts, source: 'alchemy' }
}