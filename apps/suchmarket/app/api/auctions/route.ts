import { NextRequest, NextResponse } from 'next/server'
import { fetchLiveAuctions } from '@/lib/auctions-server'
import { isSupportedChainId, isChainOperational } from '@/lib/chains'
import { getChainConfig } from '@/lib/chain-config'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const chainId = parseInt(searchParams.get('chainId') || '8453', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

  if (!isSupportedChainId(chainId)) {
    return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 })
  }
  if (!getChainConfig(chainId)?.marketplaceAddress) {
    return NextResponse.json(
      { error: `Marketplace not configured for chain ${chainId}` },
      { status: 400 }
    )
  }
  void isChainOperational

  try {
    const auctions = await fetchLiveAuctions(chainId, limit)
    return NextResponse.json({ auctions, chainId })
  } catch (error) {
    console.error('[api/auctions]', error)
    return NextResponse.json(
      { error: 'Failed to load auctions', details: error instanceof Error ? error.message : '' },
      { status: 500 }
    )
  }
}