# such.market RPC indexer

Lightweight Postgres indexer: factory pool creation, spot/delta refresh, marketplace `CreateListing` events.

- **Schema:** `schema/001_initial.sql`
- **Sync logic:** `sync.ts` (`runIndexerSync`)
- **Cron:** `GET /api/cron/sync-indexer` (Vercel, every 15m)
- **CLI:** `pnpm --filter @lssvm/suchmarket run indexer:sync`

The Next.js app reads pools from Postgres when `DATABASE_URL` is set; otherwise it falls back to bounded `eth_getLogs` scans (`lib/rpc-pools.ts`).