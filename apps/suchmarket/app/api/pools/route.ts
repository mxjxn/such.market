import { NextRequest, NextResponse } from 'next/server'
import { Address, isAddress } from 'viem'
import { queryPools } from '@/lib/indexer'
import { isChainOperational, isSupportedChainId } from '@/lib/chains'

// Process-local cache (fine for Vercel serverless warm instances)
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 60_000

function serializePools(pools: Awaited<ReturnType<typeof queryPools>>['pools']) {
  return pools.map((p) => ({
    poolAddress: p.poolAddress,
    nft: p.nft,
    poolType: p.poolType,
    spotPrice: p.spotPrice.toString(),
    delta: p.delta.toString(),
    fee: p.fee.toString(),
    bondingCurve: p.bondingCurve,
    curveType: p.curveType,
    token: p.token,
    owner: p.owner,
    pairVariant: p.pairVariant,
    nftId: p.nftId?.toString() ?? null,
    createdBlock: p.createdBlock.toString(),
  }))
}

/**
 * GET /api/pools?chainId=8453&nft=0x...&owner=0x...&lookback=500000
 * Discovers pools via factory event logs (no paid subgraph).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const chainId = parseInt(searchParams.get('chainId') || '8453', 10)
    if (!isSupportedChainId(chainId)) {
      return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 })
    }
    if (!isChainOperational(chainId)) {
      return NextResponse.json(
        { error: `Chain ${chainId} is not configured (set factory env vars)` },
        { status: 400 }
      )
    }

    const nft = searchParams.get('nft')
    const owner = searchParams.get('owner')
    const lookback = searchParams.get('lookback')

    if (nft && !isAddress(nft)) {
      return NextResponse.json({ error: 'Invalid nft address' }, { status: 400 })
    }
    if (owner && !isAddress(owner)) {
      return NextResponse.json({ error: 'Invalid owner address' }, { status: 400 })
    }

    const cacheKey = `pools:${chainId}:${nft || ''}:${owner || ''}:${lookback || ''}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ pools: cached.data, cached: true })
    }

    const { pools, source } = await queryPools({
      chainId,
      nftContract: nft ? (nft as Address) : undefined,
      owner: owner ? (owner as Address) : undefined,
      lookbackBlocks: lookback ? BigInt(lookback) : undefined,
    })

    const data = serializePools(pools)
    cache.set(cacheKey, { data, timestamp: Date.now() })
    return NextResponse.json({ pools: data, cached: false, source })
  } catch (error) {
    console.error('Pool discovery error:', error)
    return NextResponse.json(
      {
        error: 'Failed to discover pools',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
