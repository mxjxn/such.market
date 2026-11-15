import { NextRequest, NextResponse } from 'next/server'
import { Address, isAddress } from 'viem'
import { queryPools } from '@/lib/indexer'
import { isSupportedChainId } from '@/lib/chains'

const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 60_000

/**
 * GET /api/pools/:nftContract?chainId=8453
 * Pool discovery via factory event logs (Vercel-friendly, no paid subgraph).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  try {
    const { contractAddress } = params
    if (!isAddress(contractAddress)) {
      return NextResponse.json({ error: 'Invalid contract address' }, { status: 400 })
    }

    const chainId = parseInt(request.nextUrl.searchParams.get('chainId') || '8453', 10)
    if (!isSupportedChainId(chainId)) {
      return NextResponse.json({ error: 'Unsupported chain ID' }, { status: 400 })
    }

    const cacheKey = `nft:${chainId}:${contractAddress.toLowerCase()}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ pools: cached.data })
    }

    const { pools } = await queryPools({
      chainId,
      nftContract: contractAddress as Address,
      lookbackBlocks: 400_000n,
    })

    const data = pools.map((p) => ({
      poolAddress: p.poolAddress,
      spotPrice: p.spotPrice.toString(),
      poolType: p.poolType,
      nftAddress: p.nft,
      poolVariant: p.pairVariant,
      tokenContract: p.token,
      delta: p.delta.toString(),
      fee: p.fee.toString(),
      bondingCurve: p.bondingCurve,
      curveType: p.curveType,
      owner: p.owner,
    }))

    cache.set(cacheKey, { data, timestamp: Date.now() })
    return NextResponse.json({ pools: data })
  } catch (error) {
    console.error('Error fetching pools:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch pools',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
