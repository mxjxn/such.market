# such.market roadmap

Marketplace-only surface (pools + auctions). Artist/studio flows stay in cryptoart.studio.

## Done (this branch / PR #4)

- [x] **Pools UI** — browse, pool detail, buy/sell via VeryFastRouter (721 any-N + specific IDs).
- [x] **Multi-chain config** — Base (`8453`), Base Sepolia (`84532`), Ethereum (`1` — LSSVM addresses via env after deploy).
- [x] **Address alignment** — `apps/suchmarket` + `@mxjxn/lssvm-abis` match Base mainnet (`0xF6B4…` / `0x4352…`) and Base Sepolia deployment docs; RPC verification script `apps/suchmarket/scripts/verify-lssvm-deployments.ts`.
- [x] **Indexer** — Postgres schema + cron sync + CLI (`apps/suchmarket/indexer/`).
- [x] **Auctions** — marketplace listings API + `/auctions` UI (RPC fallback without DB).
- [x] **LSSVM spike (Base Sepolia)** — Foundry fork tests `packages/lssvm-contracts/test/SuchmarketBaseSepoliaFork.t.sol`; vitest quote decomposition aligned to fork fixtures.

## Spike results (summary)

| Check | Result |
| --- | --- |
| Factory + router bytecode on Base Sepolia | OK |
| Four curves + router whitelisted | OK |
| Config vs deployment docs (`84532`, `8453`) | OK |
| Fork E2E swaps (create pool → router buy → sell) | **4/4 Foundry tests pass** |
| App quote math vs contract quote fields | Vitest fixtures from fork |

See PR #4 description for the latest CI run.

## Ethereum mainnet LSSVM — decision & deploy plan (Max)

**Decision:** Deploy **our own** LSSVM stack on Ethereum mainnet (chain `1`) so we control the factory, router whitelist, and **protocol fees**. Do **not** point such.market at sudoswap's canonical factory/router.

**App wiring:** After deploy, set `NEXT_PUBLIC_FACTORY_ADDRESS_1`, `NEXT_PUBLIC_ROUTER_ADDRESS_1`, indexer start blocks, and RPC in Vercel / local env (`ENV_VARS.md`). `@mxjxn/lssvm-abis` does not ship Ethereum factory/router addresses until you add them post-deploy.

### Scripts to reuse (`packages/lssvm-contracts`)

| Path | When to use |
| --- | --- |
| [`script/DeployForBase.s.sol`](../../../packages/lssvm-contracts/script/DeployForBase.s.sol) | **Primary template** for Ethereum: deploys `RoyaltyEngine`, pair templates, `LSSVMPairFactory`, `VeryFastRouter`, then whitelists **stateless** bonding curves already on Ethereum and whitelists the router. Follow [`DEPLOY_BASE.md`](../../../packages/lssvm-contracts/DEPLOY_BASE.md) flow with **Ethereum RPC**, **Etherscan** verification, and **Ethereum curve addresses** (README [Deployments — Ethereum Mainnet](../../../README.md)): Linear `0xe5d78fec…`, Exponential `0xfa056C60…`, XYK `0xc7fB91B6…`, GDA `0x1fD5876d…`. Today the script hardcodes **Base** curve constants — Max should fork the script or swap constants before broadcast (no agent deploy). |
| [`script/DeployAll.s.sol`](../../../packages/lssvm-contracts/script/DeployAll.s.sol) | Full protocol deploy (own bonding curves, property checkers, settings). Heavier gas; use only if you need custom curves or settings factories on day one. |
| [`script/DeployForBaseTestnet.s.sol`](../../../packages/lssvm-contracts/script/DeployForBaseTestnet.s.sol) | Reference for testnet + test NFTs (already done for Base Sepolia). |
| [`script/DeployTestNFTs.s.sol`](../../../packages/lssvm-contracts/script/DeployTestNFTs.s.sol) | Optional test NFTs on a testnet; not required for Ethereum mainnet launch. |

### Factory fee settings (set at deploy + optional owner updates)

Configured in the `LSSVMPairFactory` constructor via deploy env (see `DeployForBase.s.sol`):

| Setting | Env var (Foundry, local only) | On-chain |
| --- | --- | --- |
| Protocol fee recipient | `PROTOCOL_FEE_RECIPIENT` | `protocolFeeRecipient` — treasury/multisig that receives protocol share of trades |
| Protocol fee rate | `PROTOCOL_FEE_MULTIPLIER` | `protocolFeeMultiplier` — **1e18 = 100%** of trade; max **`0.1e18` (10%)** per `MAX_PROTOCOL_FEE`. Example: `10000000000000000` = **1%** (same default as `DEPLOY_BASE.md`) |
| Factory admin | `FACTORY_OWNER` | `owner()` — can `changeProtocolFeeRecipient`, `changeProtocolFeeMultiplier`, whitelist curves/routers |
| Royalties | `ROYALTY_REGISTRY` | Passed into `RoyaltyEngine` — use Manifold universal registry where applicable (see `DEPLOY_BASE.md`) |

Post-deploy owner calls if needed: `changeProtocolFeeRecipient`, `changeProtocolFeeMultiplier`, `setBondingCurveAllowed`, `setRouterAllowed`.

Pool-level **LP fees** are per-pair `fee` at pool creation (trader/app), separate from protocol fee multiplier.

### Max local checklist (keys stay on Max's machine)

Agents do **not** run broadcast or touch `.env*` files.

1. **Prep**
   - [ ] Foundry installed; `cd packages/lssvm-contracts` && `forge build`
   - [ ] Ethereum mainnet RPC URL (Alchemy/Infura/etc.)
   - [ ] Deployer wallet funded with ETH for gas
   - [ ] Decide `PROTOCOL_FEE_RECIPIENT`, `PROTOCOL_FEE_MULTIPLIER`, `FACTORY_OWNER` (often multisig)
   - [ ] Create `packages/lssvm-contracts/.env.local` with `RPC_URL`, `PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `ROYALTY_REGISTRY`, `PROTOCOL_FEE_RECIPIENT`, `PROTOCOL_FEE_MULTIPLIER`, `FACTORY_OWNER` (per `DEPLOY_BASE.md`; never commit)

2. **Deploy**
   - [ ] Adapt `DeployForBase.s.sol` for Ethereum mainnet curve addresses (or equivalent script)
   - [ ] `forge script script/DeployForBase.s.sol:DeployForBase --rpc-url $RPC_URL --broadcast --verify` (or your Ethereum script name) **from Max's machine only**

3. **Verify on-chain**
   - [ ] `cast call $FACTORY "owner()"`, `"protocolFeeRecipient()"`, `"protocolFeeMultiplier()"`
   - [ ] All four curves `bondingCurveAllowed` == true
   - [ ] `routerStatus(yourRouter)` == allowed
   - [ ] Optional: run a small TRADE pool create + VeryFastRouter buy/sell on mainnet

4. **Publish addresses**
   - [ ] Add deployment summary markdown under `packages/lssvm-contracts/` (mirror `BASE_DEPLOYMENT_SUMMARY.md`)
   - [ ] Update `@mxjxn/lssvm-abis` with chain `1` factory/router (and curve addresses if you document them)
   - [ ] Vercel / such.market: `NEXT_PUBLIC_FACTORY_ADDRESS_1`, `NEXT_PUBLIC_ROUTER_ADDRESS_1`, `NEXT_PUBLIC_ETHEREUM_RPC_URL`, `INDEXER_FACTORY_START_BLOCK_1`, `INDEXER_MARKETPLACE_START_BLOCK_1`

5. **Do not**
   - [ ] Point production at sudoswap canonical factory `0xA020…` / router `0x090C…`
   - [ ] Commit private keys or `.env.local`

## Remaining — Sepolia beta

| Step | Owner |
| --- | --- |
| Hosted Postgres + `DATABASE_URL` on Vercel | **Max** |
| Vercel project for `apps/suchmarket`, preview URLs | **Max** |
| Cron secret / `CRON_SECRET` for indexer route | **Max** |
| Base Sepolia marketplace contract in env (if not using hardcoded dev defaults) | **Max** |
| SettingsFactory + property-checker pools in UI | Agent + **Max** (deploy checker addresses if needed) |
| Royalties UX for studio collections (2981 / engine hints) | Agent |
| Indexer hosting runbook (Neon/Railway/etc.) | **Max** |
| QA on live Sepolia pools + TestNFT contracts | Agent + Max |

## Barter offers (post-launch)

Peer **bundle-for-bundle** trading on **Seaport 1.6** (nav: **Barter**). Post–Sepolia/mainnet LSSVM + auction polish. Design: **[BARTER_OFFERS.md](./BARTER_OFFERS.md)** (gradual rollout; Phase 1 NFT/token bundles; compliance & anti-spam).

| Step | Owner |
| --- | --- |
| Review design + open questions | **Max** |
| Conduit + fee recipient per chain | **Max** |
| Implementation phases 1–4 | Agent (after launch) |

## Remaining — mainnet

| Step | Owner |
| --- | --- |
| **Ethereum LSSVM deploy** — checklist above | **Max** |
| Wire deployed addresses into Vercel + `lssvm-abis` | **Max** + Agent |
| `such.market` DNS → Vercel | **Max** |
| Production env vars (`NEXT_PUBLIC_*`, RPC URLs, optional `DATABASE_URL`) | **Max** |
| cryptoart.social embeds / deep links to pools & auctions | Agent |
| ERC-20 pool trading polish (day two) | Agent |
| Protocol fee / treasury monitoring | **Max** |

## Operator notes

- **Do not** use legacy miniapp `.env.local` Base mainnet factory/router values; TASKLIST documents wrong addresses. such.market hardcoded `8453` values are correct.
- Ethereum LSSVM: **env-only** until deploy — see `lib/chain-config.ts` and `ENV_VARS.md`.
- Never commit secrets; see `ENV_VARS.md`.

## References

- Base Sepolia: [BASE_TESTNET_DEPLOYMENT_SUMMARY.md](../../../packages/lssvm-contracts/BASE_TESTNET_DEPLOYMENT_SUMMARY.md)
- Base mainnet: [BASE_DEPLOYMENT_SUMMARY.md](../../../packages/lssvm-contracts/BASE_DEPLOYMENT_SUMMARY.md)
- Deploy guide (adapt for Ethereum): [DEPLOY_BASE.md](../../../packages/lssvm-contracts/DEPLOY_BASE.md)