import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { isSupportedChainId } from '@/lib/chains'

/**
 * Stub ingest — queues collection verification applications for manual admin review.
 * No external ticketing integration in Phase 0; logs server-side in dev.
 */
export async function POST(request: NextRequest) {
  let body: {
    chainId?: number
    contractAddress?: string
    contact?: string
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const chainId = Number(body.chainId)
  const contractAddress = body.contractAddress?.trim()
  const contact = body.contact?.trim()
  const notes = body.notes?.trim()

  if (!isSupportedChainId(chainId)) {
    return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 })
  }
  if (!contractAddress || !isAddress(contractAddress)) {
    return NextResponse.json({ error: 'Invalid contract address' }, { status: 400 })
  }
  if (!contact) {
    return NextResponse.json({ error: 'Contact is required' }, { status: 400 })
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[verify-collection] application', {
      chainId,
      contractAddress: contractAddress.toLowerCase(),
      contact,
      notes: notes || null,
    })
  }

  return NextResponse.json(
    {
      ok: true,
      status: 'queued',
      message:
        'Application queued for manual review. Studio-minted collections are auto-verified without this form.',
    },
    { status: 202 }
  )
}