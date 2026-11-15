import { NextRequest, NextResponse } from 'next/server'
import { runIndexerSync } from '@/indexer/sync'

/**
 * Vercel Cron — incremental RPC indexer sync.
 * Set CRON_SECRET and send Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await runIndexerSync()
    if (!result.ok) {
      return NextResponse.json(result, { status: 503 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('[cron/sync-indexer]', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}