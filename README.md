# such.market

Barter NFT marketplace on Base. Read the [manifesto](MANIFESTO.md).

The previous Farcaster mini-app lives on the `legacy-miniapp` branch.

## Monorepo layout

pnpm + Turborepo workspace:

| Path | Purpose |
|------|---------|
| [`apps/suchmarket`](apps/suchmarket/) | Next.js app (Farcaster mini app), RPC indexer, product docs (`ROADMAP.md`, `BARTER_OFFERS.md`, `ENV_VARS.md`) |
| [`packages/lssvm-abis`](packages/lssvm-abis/) | Shared ABIs, deployment addresses (Base mainnet & Sepolia), bonding curves |
| [`packages/lssvm-contracts`](packages/lssvm-contracts/) | LSSVM Solidity contracts, deploy docs, Foundry tests |

Imported from [`mxjxn/such-lssvm`](https://github.com/mxjxn/such-lssvm) @ `cursor/suchmarket-app-28f7` ([`3adb97d`](https://github.com/mxjxn/such-lssvm/commit/3adb97d3e05801863e65af88649f66b1bb73584c)).

## Commands (from repo root)

```bash
pnpm install
pnpm run check-types
pnpm run build
pnpm run test
```

App dev server: `pnpm --filter @lssvm/suchmarket dev` (port 3001).

Contracts (requires [Foundry](https://book.getfoundry.sh/) and `git submodule update --init --recursive packages/lssvm-contracts/lib`):

```bash
pnpm --filter @lssvm/contracts test          # Base Sepolia fork smoke tests (requires network)
pnpm --filter @lssvm/contracts run test:full # full upstream LSSVM suite (Foundry on PATH)
```

Environment variables are documented in [`apps/suchmarket/ENV_VARS.md`](apps/suchmarket/ENV_VARS.md). Do not commit secrets.