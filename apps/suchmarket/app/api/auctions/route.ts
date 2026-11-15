import { NextRequest, NextResponse } from 'next/server'
import { fetchLiveAuctions } from '@/lib/auctions-server'
import { isSupportedChainId, isChainOperational } from '@/lib/chains'
import {
  AUCTION_INDEXER_NOT_CONFIGURED_MESSAGE,
  getAuctionBrowseStatus,
} from '@/lib/auction-indexer'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const chainId = parseInt(searchParams.get('chainId') || '8453', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

  if (!isSupportedChainId(chainId)) {
    return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 })
  }
  const browseStatus = getAuctionBrowseStatus(chainId)
  if (browseStatus === 'marketplace_not_configured') {
    return NextResponse.json(
      { error: `Marketplace not configured for chain ${chainId}`, indexerStatus: 'marketplace_not_configured' },
      { status: 400 }
    )
  }
  if (browseStatus === 'indexer_not_configured') {
    return NextResponse.json(
      {
        auctions: [],
        chainId,
        indexerStatus: 'not_configured',
        error: AUCTION_INDEXER_NOT_CONFIGURED_MESSAGE,
      },
      { status: 503 }
    )
  }
  void isChainOperational

  try {
    const auctions = await fetchLiveAuctions(chainId, limit)
    return NextResponse.json({ auctions, chainId, indexerStatus: 'ready' })
  } catch (error) {
    console.error('[api/auctions]', error)
    return NextResponse.json(
      { error: 'Failed to load auctions', details: error instanceof Error ? error.message : '' },
      { status: 500 }
    )
  }
}