import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { fetchOwnedNftsFromCollection, resolveAlchemyApiKey } from '@/lib/alchemy-nft'
import { isSupportedChainId } from '@/lib/chains'

/**
 * GET /api/nfts/for-owner?owner=0x…&contractAddress=0x…&chainId=8453
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const owner = searchParams.get('owner')
  const contractAddress = searchParams.get('contractAddress')
  const chainId = Number(searchParams.get('chainId') ?? '0')

  if (!owner || !isAddress(owner)) {
    return NextResponse.json({ error: 'Invalid owner address' }, { status: 400 })
  }
  if (!contractAddress || !isAddress(contractAddress)) {
    return NextResponse.json({ error: 'Invalid contract address' }, { status: 400 })
  }
  if (!isSupportedChainId(chainId)) {
    return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 })
  }

  if (!resolveAlchemyApiKey()) {
    return NextResponse.json({
      nfts: [],
      source: 'manual',
      message: 'NFT indexer unavailable. Enter contract address and token ID manually.',
    })
  }

  try {
    const { nfts, source } = await fetchOwnedNftsFromCollection(chainId, owner, contractAddress)
    return NextResponse.json({
      nfts,
      source,
      hasMore: false,
    })
  } catch (error) {
    console.error('[api/nfts/for-owner]', error)
    return NextResponse.json(
      {
        nfts: [],
        source: 'manual',
        message: 'Could not load NFTs from indexer. Use manual token ID entry.',
      },
      { status: 200 }
    )
  }
}