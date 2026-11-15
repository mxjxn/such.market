# Barter offers — design doc (post-launch)

**Status:** Design only. No implementation in this phase.  
**Product name:** **Barter** in nav; in copy use **barter offers** / **barter NFT platform** (not a general barter economy).

**Settlement:** [Seaport 1.6](https://github.com/ProjectOpenSea/seaport) canonical deployment on **Ethereum (1)**, **Base (8453)**, and **Base Sepolia (84532)**:

| Contract | Address (same on these chains) |
| --- | --- |
| Seaport 1.6 | `0x0000000000000068F116a894984e2DB1123eB395` |
| ConduitController | `0x00000000F9490004C11Cef243f5400493c00Ad63` |

Orders are **EIP-712 signed** and fulfilled on-chain via Seaport; such.market hosts the **off-chain order book**, matching UI, and indexer integration.

---

## Product decisions (Max)

| # | Decision |
| --- | --- |
| 1 | **Dedicated such.market conduit** on each supported chain (deploy via `ConduitController`; sole conduit promoted in UI). |
| 2 | **Fee:** **2% (200 bps)**. **Taker pays by default** (offerer-pays optional at build). Recipient is **owner-settable**, starts as **deployer wallet**; ownership **transferable** (`Ownable2Step`-style). Config via on-chain **`BarterFeeConfig`** (recommended) — see §8. |
| 3 | **ERC-20 currency legs:** **WETH**, **USDC**, plus **admin-managed token allowlist**. Unverified ERC-20s **cannot** be payment/consideration currency. |
| 4 | **Holdings index at launch:** **Connected wallets + offerers only** (no global watchlist crawl). |
| 5 | **Counters:** **Anyone** can post a counteroffer. |
| 6 | **ETH legs:** Use **WETH** (ERC-20), not native ETH, for all chains in v1. |
| 7 | **Trait wants:** **Later phase**; metadata from **our own indexed metadata** → token ID set → merkle (not third-party APIs). |
| 8 | **Zones:** **Launch with `zone = address(0)`**. Custom zones ship **later**, together with **barter metadata standards** for richer offer types. |
| 9 | **Compliance:** Required — see §Compliance. **Legal review before expanding** allowed barter types beyond Phase 1. |
| 10 | **Nav label:** **Barter** (not “Trade” / not “Barter offers” in the tab). |
| 11 | **NFT verification:** Studio mints auto-verified; others apply/admin-curate; unverified offers allowed with badge; default feeds hide unverified except profile/followers + toggle. **No refundable deposit.** |

---

## Gradual rollout

**Principle:** Introduce barter **types and metadata standards gradually** so users are not overwhelmed. Each phase adds UI labels, validation rules, and docs for how offers are described off-chain (`order_json` metadata schema version).

| Stage | User-facing scope |
| --- | --- |
| **Phase 1 (launch)** | **NFT-for-NFT / token bundles only** — specific ERC-721 / ERC-1155 IDs plus **allowlisted ERC-20** (WETH, USDC, + admin list). All-or-nothing fills. |
| **Later** | Collection-wide criteria, ID merkle sets, partial fills, trait wants (our indexer), custom zones, and additional asset/policy types **after** legal sign-off per stage. |

Downstream sections describe the **full target**; implementation tracks the table above unless a phase note says otherwise.

---

## 1. Product placement vs pools & auctions

| Surface | Mechanism | User intent |
| --- | --- | --- |
| **Pools** | LSSVM + VeryFastRouter | Buy/sell NFTs against pool liquidity (AMM pricing). |
| **Auctions** | cryptoart.studio marketplace contract | Timed listings, bids, settlement to seller. |
| **Barter** | Seaport 1.6 | Peer barter offers: “I give bundle A for bundle B”. |

**Nav:** `Explore` · `Pools` · `Auctions` · **Barter** · `Create` (thin; studio deep-links where needed).

**Flows:**

- **Make offer:** Connect wallet → build offer bundle + want bundle → sign Seaport order → POST to API → **My offers**.
- **Fill offer:** **All offers** or **Offers you can fill** → `fulfill` tx via such.market conduit approvals.
- **Counteroffer:** **Anyone** may **Counter** from offer detail → new signed order, `parent_offer_id` thread.
- **Cross-links:** Collection pages show open barter offers; auctions stay on marketplace contract only.

---

## 2. Offer types (target; rollout per §Gradual rollout)

### 2.1 Bundle-for-bundle

Seaport **offer** and **consideration** item arrays:

| Asset | Seaport item type | Notes |
| --- | --- | --- |
| **WETH** | `ERC20` | All ETH-notional legs use **WETH**. Wrap/unwrap in flow. |
| **USDC** | `ERC20` | Allowed payment/consideration currency (chain-native USDC address). |
| Other ERC-20 | `ERC20` | Only if on **`barter_token_allowlist`** (admin). **Unlisted tokens rejected** at API ingest for any fee or currency leg. |
| ERC-721 | `ERC721` | Specific `identifier` or criteria (post–Phase 1) |
| ERC-1155 | `ERC1155` | `identifier` + amounts |

**Phase 1:** Specific IDs + ERC-20/WETH only (no criteria, no partial).

### 2.2 Criteria-based “wants” (post–Phase 1)

| Want pattern | Seaport encoding | When |
| --- | --- | --- |
| Any token in collection | Criteria item, collection-wide | Phase 2+ |
| Set of token IDs | Merkle root + proof | Phase 2+ |
| **Traits** | Our **indexed metadata** → ID set → merkle root; refresh when index updates | **Later phase** (after metadata indexer) |

### 2.3 Partial fills (post–Phase 1)

`allowPartialFills` optional; `fulfillAdvanced`; track fill fraction in `barter_fills`. Not in Phase 1.

### 2.4 Counteroffers

- **On-chain:** New signed order (new salt); no Seaport parent link.
- **Off-chain:** `parent_offer_id`, `root_offer_id`, status thread.
- **Policy:** **Any connected user may counter** (not limited to wallets that can fill the want side).

---

## 3. Dashboard: “Offers you can fill”

### 3.1 Holdings index (extends RPC indexer)

**At launch:** Index balances only for (**a**) wallets that **created a barter offer** on such.market and (**b**) wallets **currently connected** (session-scoped registration in `wallet_watchlist`). **No** full-chain or arbitrary address crawl.

Tables: `wallet_balances_erc20`, `wallet_nfts_721`, `wallet_nfts_1155`, `wallet_watchlist`.

**Invalidation:** Transfer logs since cursor; cancel/expiry/fill; **re-validate** via RPC before fill CTA.

### 3.2–3.3 Want denormalization & match

`barter_offer_wants` for SQL prefilter; merkle/criteria verification at fill time when enabled. Match materialization for **connected** wallets after indexer sync.

**Unverified NFT collections** (§9): Offers that include unverified contracts are **allowed** but excluded from default **Offers you can fill** unless the viewer enables **“Show unverified”**. They remain visible on the **creator’s profile** and to **followers/collector graph** (see §9).

---

## 4a. Order book pruning & re-validation

Unfillable offers are **removed from the active book** (status `pruned` or `inactive`; retained for history). Seaport has **no protocol fee**; pruning is **off-chain UX + API** only (on-chain orders may still exist until cancelled).

**Prune job** (cron, e.g. every 5–15 min with indexer):

| Condition | Action |
| --- | --- |
| `end_time` passed | Mark expired; drop from list/match indexes |
| Cancel tx indexed or DB `cancelled` | Remove |
| Offerer **counter** on Seaport > order’s signed counter | Stale signature; remove |
| Offerer no longer **owns** offered NFTs (721 `ownerOf`, 1155 balance) | Remove |
| Insufficient **ERC-20 balance** on offer side | Remove |
| Missing **conduit approval** for offered NFTs (offerer) | Remove from `fulfillable` feed (optional soft-hide until re-approved) |

**Re-validation triggers** (synchronous before fill + incremental for match feed):

- User opens offer detail or clicks **Fill**
- User loads **Offers you can fill**
- Indexer processes **Transfer** / **ApprovalForAll** for wallets in `wallet_watchlist` or known offerers
- After **prune job** batch, refresh `fulfillable` flags

Failed re-validation does not delete historical row; it sets `listable = false` and `unfillable_reason`.

---

## 4. Off-chain order book

| Concern | Approach |
| --- | --- |
| **Storage** | Postgres: EIP-712 + signature + `order_hash`, status, `order_json`, metadata schema version. |
| **API routes (sketch)** | `POST/GET /api/barter/offers`, `match`, `cancel`, `counters`, `thread`. |
| **Validation** | Signer, counter, times; **ingest rejects unknown zones** until custom zones launch; contract blocklist (§Compliance). |
| **Fulfillability** | Conduit + approvals, allowlisted ERC-20 only, balances; prune job §4a. |
| **Cancellation / counter** | On-chain counter increment; DB status. |

---

## 5. Approval UX

| Goal | Design |
| --- | --- |
| **One approval per collection** | **such.market conduit only** (per chain, Max deploys). `setApprovalForAll(collection, suchMarketConduit)`. |
| **WETH / ERC-20** | `approve(Seaport, …)` or max; batch in readiness panel. |
| **Pain reduction** | Pre-flight readiness; multicall where possible. |

No third-party conduit keys in product UI.

---

## 6. Zones & future conditions

**Launch:** `zone = address(0)` for all barter orders.

**Later:** Custom **SuchMarket** zone(s) ship with **barter metadata standards** (expiry extensions, allowlisted takers, fee enforcement). Not coupled to Phase 1.

---

## 7. DB schema sketch

```sql
CREATE TABLE barter_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INT NOT NULL,
  order_hash TEXT NOT NULL UNIQUE,
  offerer TEXT NOT NULL,
  seaport_address TEXT NOT NULL,
  zone TEXT NOT NULL DEFAULT '0x0000000000000000000000000000000000000000',
  status TEXT NOT NULL,
  listable BOOLEAN NOT NULL DEFAULT true,
  unfillable_reason TEXT,
  fee_payer TEXT NOT NULL DEFAULT 'taker',
  fee_bps INT NOT NULL DEFAULT 200,
  has_unverified_nft BOOLEAN NOT NULL DEFAULT false,
  parent_offer_id UUID REFERENCES barter_offers(id),
  signature BYTEA NOT NULL,
  order_json JSONB NOT NULL,
  metadata_schema_version TEXT,
  hidden_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NFT contracts: verification for discovery/filtering (not a ban on offering)
CREATE TABLE barter_collection_verification (
  chain_id INT NOT NULL,
  contract_address TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL, -- 'studio_auto' | 'admin_curated' | 'application'
  verified_at TIMESTAMPTZ,
  notes TEXT,
  PRIMARY KEY (chain_id, contract_address)
);

-- ERC-20 allowed as currency / fee token (WETH, USDC seeded; admin extends)
CREATE TABLE barter_token_allowlist (
  chain_id INT NOT NULL,
  token_address TEXT NOT NULL,
  symbol TEXT,
  decimals INT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (chain_id, token_address)
);

-- Cache of on-chain BarterFeeConfig (refreshed on read or event)
CREATE TABLE barter_fee_config_cache (
  chain_id INT PRIMARY KEY,
  fee_config_address TEXT NOT NULL,
  fee_recipient TEXT NOT NULL,
  fee_bps INT NOT NULL,
  owner TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE barter_policy_blocklist (
  chain_id INT,
  contract_address TEXT,
  reason TEXT,
  PRIMARY KEY (chain_id, contract_address)
);

CREATE TABLE barter_reports (
  id BIGSERIAL PRIMARY KEY,
  offer_id UUID REFERENCES barter_offers(id),
  reporter TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE barter_wallet_mutes (
  muter TEXT NOT NULL,
  muted TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (muter, muted)
);
```

On-chain **`BarterFeeConfig`** (per chain) is source of truth for recipient/bps/owner; app may cache in `barter_fee_config_cache`.

---

## 8. Fees

Seaport has **no built-in protocol fee**; such.market fee is an extra **consideration item** (allowlisted ERC-20, usually WETH or USDC) in the signed order.

| Setting | Value |
| --- | --- |
| **Rate** | **200 bps (2%)** of agreed notional (computed at order build; on-chain leg is fixed amount) |
| **Payer** | **Taker (filler) by default**; offerer-pays variant encoded in consideration layout |
| **Recipient** | **`feeRecipient`** on config contract; initial value = **deployer wallet** |
| **Governance** | **`owner`** with **`Ownable2Step`** transfer to multisig/treasury later |

**Where config lives**

| Approach | Pros / cons |
| --- | --- |
| App-only env | Fast, opaque to users |
| **`BarterFeeConfig` contract (recommended)** | Transparent on explorers; same read pattern for such.market + indexers; owner can `setFeeRecipient`, `setFeeBps` (cap e.g. 10%); app + API read via RPC and cache in Postgres |

Order builder reads `feeBps` + `feeRecipient` when constructing consideration; ingest API rejects fee leg mismatch with on-chain config (within tolerance). LSSVM protocol fee is a **separate** on-chain setting on the pair factory; barter fee may **align politically** with LSSVM but is **independent** in Seaport orders.

**No refundable deposit** for offer creation.

---

## 9. Compliance, verification & disallowed items

Compliance is **in scope from day one**. Primary risk is **fake/impersonating collections and junk tokens**, not blocking unknown artists from offering their own work.

### Collection verification (NFT legs)

| Status | Rule |
| --- | --- |
| **Auto-verified** | Collections **minted via cryptoart.studio** → `barter_collection_verification.verified = true`, `source = studio_auto`. |
| **Admin-verified** | Other collections **apply**; admins add to curated list (`admin_curated`). |
| **Unverified** | All other NFT contracts — **offers allowed**. |

**Unverified offer UX**

- **Badge** “Unverified collection” + short warning on offer/detail.
- **Visible** on creator **profile** and to **followers/collector** audience (social graph / explicit follows).
- **Hidden** from other users’ default **Offers you can fill** and global **Barter** browse unless **“Show unverified”** is on (persisted toggle).
- Still subject to **blocklist** and **reports**; admins can hide/delist.

### Hard rules (unchanged / tightened)

| Control | Description |
| --- | --- |
| **ERC-20 currency** | Only **WETH, USDC, allowlist** — never arbitrary unverified ERC-20 as payment or consideration. |
| **Contract blocklist** | Banned addresses; reject ingest. |
| **Category policy** | Securities/sanctions/stolen — internal policy; **legal review** before expanding barter types. |
| **Report / admin** | `barter_reports`; `hidden_by_admin` on offers. |
| **Expansion gate** | Legal review before Phase 2+ feature flags. |

---

## 10. Anti-spam

| Measure | Notes |
| --- | --- |
| **Dust filter** | Minimum notional per offer (WETH/allowlisted ERC-20 floor and/or NFT count rules); reject below threshold at API. |
| **Rate limits** | Per-wallet cap on **new offers / hour** (and counters if abusive); HTTP 429 + soft warn in UI. |
| **Default dashboard filters** | Hide **unverified NFT** offers (§9) and **blocklisted** assets; toggle **“Show unverified”**. Separate filter for low-reputation wallets optional. |
| **Mute / block** | `barter_wallet_mutes`; muted offerers hidden from feed/match. |
| **Pruning** | Remove unfillable orders from active book (§4a) — no refundable deposit. |

---

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Stale match index | Re-validate before `fulfill`. |
| Merkle / criteria errors | Version roots; fail closed on bad proofs. |
| Conduit phishing | Single official conduit address per chain in UI. |
| Compliance gaps | Blocklist + legal gate on type expansion (§9). |
| Spam / noise | §10 filters + rate limits. |
| RPC load | Connected + offerers only at launch. |

---

## 12. Phased build plan

| Phase | Scope |
| --- | --- |
| **0** | This doc + ROADMAP |
| **1** | **Barter** nav; NFT↔NFT/token bundles; WETH/USDC/allowlist; **2% taker fee** + `BarterFeeConfig`; conduit; zone=0; order book + **prune job**; verification UX; compliance v1; anti-spam v1; holdings for connected + offerers |
| **2** | Criteria (collection + ID merkle), partial fills |
| **3** | “Offers you can fill” polish; counter threads |
| **4** | Trait wants (our metadata indexer); custom zones + metadata standards |

---

## 13. Open questions for Max

1. **`BarterFeeConfig` deploy:** Same owner multisig as LSSVM factory / conduit, or separate deployer-at-launch then transfer?
2. **Verification applications:** Self-serve form (contract + chain proof) vs manual ticket only?
3. **Followers/collector graph:** Source for “show unverified to my audience” (cryptoart.social API, on-chain holders, or follows table only)?
4. **Moderation:** SLA and roles for `barter_reports`; when to require on-chain cancel vs admin hide only.
5. **Legal review checklist:** Sign-off template before Phase 2+ features.

---

## References

- [ProjectOpenSea/seaport](https://github.com/ProjectOpenSea/seaport)
- `apps/suchmarket/indexer/schema/001_initial.sql`
- [ROADMAP.md](./ROADMAP.md)