# such.market environment variables

Set these in the Vercel project for `apps/suchmarket`. No private keys in the app.

## Global

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres for the RPC indexer (pools + listing IDs + cursors) |
| `CRON_SECRET` | Bearer token for `/api/cron/sync-indexer` |
| `INDEXER_MAX_BLOCKS_PER_RUN` | Max blocks per cron tick (default `250000`) |
| `INDEXER_LOG_CHUNK` | `eth_getLogs` chunk size (default `50000`) |
| `NEXT_PUBLIC_IPFS_URL` | IPFS gateway (default `https://ipfs.io`) |

## Trader defaults (optional)

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_DEFAULT_POOL_FEE_BPS` | `100` |
| `NEXT_PUBLIC_DEFAULT_SPOT_PRICE` | `0.002` |
| `NEXT_PUBLIC_DEFAULT_DELTA` | `0.01` |
| `NEXT_PUBLIC_DEFAULT_SLIPPAGE_BPS` | `100` |
| `NEXT_PUBLIC_ERC721_CREATE_MAX_IDS_PER_TX` | `50` (UI guidance only) |

## Base Mainnet (chain `8453`)

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_BASE_RPC_URL` | Dedicated RPC strongly recommended |
| `NEXT_PUBLIC_ROUTER_ADDRESS_8453` | Defaults from `@mxjxn/lssvm-abis` |
| `NEXT_PUBLIC_FACTORY_ADDRESS_8453` | Defaults from `@mxjxn/lssvm-abis` |
| `NEXT_PUBLIC_MARKETPLACE_ADDRESS_8453` | Marketplace proxy (alias: `NEXT_PUBLIC_MARKETPLACE_ADDRESS`) |
| `INDEXER_FACTORY_START_BLOCK_8453` | Default `38239761` |
| `INDEXER_MARKETPLACE_START_BLOCK_8453` | Default `38000000` |

## Base Sepolia (chain `84532`)

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` | |
| `NEXT_PUBLIC_ROUTER_ADDRESS_84532` | Defaults from package |
| `NEXT_PUBLIC_FACTORY_ADDRESS_84532` | Defaults from package |
| `NEXT_PUBLIC_MARKETPLACE_ADDRESS_84532` | |
| `INDEXER_FACTORY_START_BLOCK_84532` | Default `18000000` |
| `INDEXER_MARKETPLACE_START_BLOCK_84532` | Default `18000000` |

## Ethereum Mainnet (chain `1`)

such.market uses **mxjxn's own LSSVM factory + router** on Ethereum (not sudoswap's canonical deployment). There are no hardcoded mainnet LSSVM addresses in the app — set these after Max deploys (see [`docs/ROADMAP.md`](./docs/ROADMAP.md)).

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_ETHEREUM_RPC_URL` | Required for mainnet reads |
| `NEXT_PUBLIC_ROUTER_ADDRESS_1` | **Your** VeryFastRouter — required to enable mainnet pools |
| `NEXT_PUBLIC_FACTORY_ADDRESS_1` | **Your** LSSVMPairFactory — required for discovery/indexer |
| `NEXT_PUBLIC_MARKETPLACE_ADDRESS_1` | Default studio proxy; alias `NEXT_PUBLIC_MARKETPLACE_ADDRESS_ETHEREUM` |
| `INDEXER_FACTORY_START_BLOCK_1` | Set to your factory deployment block |
| `INDEXER_MARKETPLACE_START_BLOCK_1` | Set to marketplace deployment block |

## Indexer

### Migrations

```bash
psql "$DATABASE_URL" -f apps/suchmarket/indexer/schema/001_initial.sql
```

On first cron run, `ensureSchema()` also applies the same DDL idempotently.

### Run manually

```bash
DATABASE_URL=... CRON_SECRET=... pnpm --filter @lssvm/suchmarket run indexer:sync
```

### Vercel cron

`vercel.json` schedules `GET /api/cron/sync-indexer` every 15 minutes with `Authorization: Bearer $CRON_SECRET`.