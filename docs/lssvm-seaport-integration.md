# LSSVM + Seaport Integration - Smart Routing Implementation

**Status**: 🚧 In Progress
**Priority**: 🔴 Critical
**Approach**: Option B - Smart Routing
**Last Updated**: November 22, 2024

---

## 🎯 Project Goals

Integrate LSSVM liquidity pools with OpenSea Seaport orderbook to create a unified trading experience on Such.Market. Users should see the best available price automatically without needing to understand the underlying trading mechanisms.

### User-Facing Goals
- ✅ **One-click trading** - Show best price, execute best route automatically
- ✅ **No technical jargon** - Hide "Seaport", "LSSVM", "pools", "orders" from users
- ✅ **Simple terminology** - "Buy", "Sell", "List", "Make Offer"
- ✅ **Smart filtering** - Don't show spam NFTs from user wallets
- ✅ **Fast performance** - Leverage existing cache system

### Technical Goals
- ✅ Integrate LSSVM subgraph (deployed on Base)
- ✅ Keep existing Seaport implementation (offers working)
- ✅ Maintain 3-tier caching system
- ✅ Add intelligent spam filtering
- ✅ Support both instant (pool) and P2P (listing) trades

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SUCH.MARKET FRONTEND                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         UnifiedTradingView Component                │    │
│  │  (Smart Routing - Shows Best Price Automatically)   │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
└───────────────────┼──────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              UNIFIED TRADING API LAYER                       │
│                                                              │
│  GET /api/trading/price-check?nft=0x123...&tokenId=456     │
│  POST /api/trading/buy                                      │
│  POST /api/trading/sell                                     │
│  POST /api/trading/list                                     │
│                                                              │
│  [Aggregates LSSVM + Seaport, returns best price/route]    │
└─────────────┬─────────────────────┬─────────────────────────┘
              │                     │
              ▼                     ▼
┌─────────────────────────┐  ┌──────────────────────────────┐
│   LSSVM POOL LAYER      │  │   SEAPORT ORDER LAYER        │
│                         │  │                              │
│  • Subgraph queries     │  │  • Existing offer system     │
│  • Pool price calc      │  │  • Listing creation (new)    │
│  • Instant buy/sell     │  │  • P2P trading               │
│  • Liquidity checks     │  │  • NFT-for-NFT swaps         │
└───────────┬─────────────┘  └────────────┬─────────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  3-TIER REDIS CACHE                          │
│                                                              │
│  L1 (5min):  Pool prices, active listings                   │
│  L2 (30min): Collection liquidity, trait floors             │
│  L3 (24hr):  User collections (filtered for spam)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Sources

### LSSVM Subgraph (Base Mainnet)
**Purpose**: Query liquidity pools, get instant buy/sell prices

**Key Queries**:
```graphql
# Get all pools for a collection
query CollectionPools($collection: String!) {
  pools(where: { collection: $collection, active: true }) {
    id
    type          # LINEAR, EXPONENTIAL, XYK
    spotPrice
    delta
    fee
    nftBalance
    tokenBalance
    collection {
      id
      name
    }
  }
}

# Get best buy price for specific NFT
query BestBuyPrice($collection: String!, $tokenId: String!) {
  pools(
    where: {
      collection: $collection,
      active: true,
      nftBalance_gt: 0
    }
    orderBy: spotPrice
    orderDirection: asc
    first: 1
  ) {
    id
    spotPrice
    fee
    type
  }
}

# Get best sell price (pool willing to buy)
query BestSellPrice($collection: String!) {
  pools(
    where: {
      collection: $collection,
      active: true,
      tokenBalance_gt: 0,
      type_in: ["BUY", "TRADE"]
    }
    orderBy: spotPrice
    orderDirection: desc
    first: 1
  ) {
    id
    spotPrice
    fee
    type
  }
}
```

### Seaport Orders (Supabase)
**Purpose**: P2P listings and offers

**Existing Tables**:
- `seaport_orders` - Offers (already working)
- `seaport_order_items` - Order line items
- `seaport_fulfillments` - Trade history

**New Queries Needed**:
```sql
-- Get best listing price for NFT
SELECT so.*, soi.*
FROM seaport_orders so
JOIN seaport_order_items soi ON so.order_hash = soi.order_hash
WHERE soi.token_address = $1
  AND soi.token_id = $2
  AND so.order_type = 'LISTING'
  AND so.status = 'ACTIVE'
  AND so.expiration > NOW()
ORDER BY so.price ASC
LIMIT 1;

-- Get active listings for collection
SELECT so.*, soi.*
FROM seaport_orders so
JOIN seaport_order_items soi ON so.order_hash = soi.order_hash
WHERE soi.token_address = $1
  AND so.order_type = 'LISTING'
  AND so.status = 'ACTIVE'
  AND so.expiration > NOW()
ORDER BY so.created_at DESC;
```

---

## 🔌 API Design

### 1. Unified Price Check API

**Endpoint**: `GET /api/trading/price-check`

**Query Parameters**:
- `nft` (required): NFT contract address
- `tokenId` (optional): Specific token ID (omit for collection floor)
- `action` (required): `buy` or `sell`

**Response**:
```typescript
{
  success: true,
  data: {
    // Best available price
    bestPrice: {
      amount: "0.1",           // ETH amount
      amountWei: "100000000000000000",
      route: "pool" | "listing" | "offer",
      source: "lssvm" | "seaport",
      instant: true,           // Can execute immediately?
    },

    // Alternative options (if available)
    alternatives: [
      {
        amount: "0.105",
        route: "listing",
        source: "seaport",
        instant: false,        // Requires signature
        seller: "0x...",
        expiration: 1234567890
      }
    ],

    // Pool liquidity info (if applicable)
    pool: {
      id: "0x...",
      type: "LINEAR",
      spotPrice: "0.1",
      nftBalance: 42,
      tokenBalance: "5.2"
    },

    // Listing info (if applicable)
    listing: {
      orderHash: "0x...",
      seller: "0x...",
      price: "0.105",
      expiration: 1234567890
    }
  },
  cached: true,
  cacheAge: 45  // seconds
}
```

**Implementation**:
```typescript
// src/app/api/trading/price-check/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nft = searchParams.get('nft')?.toLowerCase();
  const tokenId = searchParams.get('tokenId');
  const action = searchParams.get('action'); // 'buy' or 'sell'

  // 1. Check cache (L1 - 5 min for price data)
  const cacheKey = `such-market:trading:price:${nft}:${tokenId || 'floor'}:${action}`;
  const cached = await getCache(cacheKey);
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true });

  // 2. Fetch from both sources in parallel
  const [poolPrice, seaportPrice] = await Promise.all([
    fetchLSSVMPrice(nft, tokenId, action),
    fetchSeaportPrice(nft, tokenId, action)
  ]);

  // 3. Compare and determine best route
  const result = determinebestRoute(poolPrice, seaportPrice, action);

  // 4. Cache result (L1 - hot data, 5 min)
  await setCache(cacheKey, result, 300);

  return NextResponse.json({ success: true, data: result });
}
```

### 2. Unified Buy API

**Endpoint**: `POST /api/trading/buy`

**Request Body**:
```typescript
{
  nft: "0x...",
  tokenId: "123",
  maxPrice: "0.15",        // Max willing to pay (slippage protection)
  preferredRoute?: "pool" | "listing" | "auto"  // Default: auto
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    route: "pool",
    txHash: "0x...",
    price: "0.1",
    instant: true
  }
}
```

**Implementation**:
```typescript
// src/app/api/trading/buy/route.ts
export async function POST(request: NextRequest) {
  const { nft, tokenId, maxPrice, preferredRoute = 'auto' } = await request.json();

  // 1. Get best price
  const priceCheck = await getPriceCheck(nft, tokenId, 'buy');

  // 2. Validate slippage
  if (parseFloat(priceCheck.bestPrice.amount) > parseFloat(maxPrice)) {
    return NextResponse.json({
      success: false,
      error: 'Price exceeded maximum'
    }, { status: 400 });
  }

  // 3. Execute via best route
  if (priceCheck.bestPrice.route === 'pool') {
    return await executeLSSVMBuy(priceCheck.pool, tokenId);
  } else {
    return await executeSeaportFulfillment(priceCheck.listing);
  }
}
```

### 3. Unified Sell/List API

**Endpoint**: `POST /api/trading/list`

**Request Body**:
```typescript
{
  nft: "0x...",
  tokenId: "123",
  price: "0.15",
  instant?: boolean,       // Default: false (create listing)
  duration?: number        // Listing duration in seconds (default: 30 days)
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    route: "pool" | "listing",
    listingHash?: "0x...",   // If created Seaport listing
    txHash?: "0x...",        // If sold to pool instantly
    price: "0.15"
  }
}
```

**Logic**:
- If `instant: true` → Sell to best pool immediately
- If `instant: false` → Create Seaport listing at specified price
- Smart routing: Compare pool offer vs listing potential

---

## 🗃️ LSSVM Integration

### Subgraph Client

**File**: `src/lib/lssvm/client.ts`

```typescript
import { GraphQLClient } from 'graphql-request';

const LSSVM_SUBGRAPH_URL = process.env.LSSVM_SUBGRAPH_URL!;

export const lssvmClient = new GraphQLClient(LSSVM_SUBGRAPH_URL, {
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function queryLSSVM<T>(query: string, variables?: any): Promise<T> {
  try {
    return await lssvmClient.request<T>(query, variables);
  } catch (error) {
    console.error('LSSVM Subgraph query failed:', error);
    throw new Error(`Failed to query LSSVM subgraph: ${error}`);
  }
}
```

### Pool Price Calculator

**File**: `src/lib/lssvm/pricing.ts`

```typescript
export interface PoolPricing {
  id: string;
  type: 'LINEAR' | 'EXPONENTIAL' | 'XYK';
  spotPrice: string;
  delta: string;
  fee: string;
  nftBalance: number;
  tokenBalance: string;
}

/**
 * Calculate buy price for N NFTs from a pool
 */
export function calculateBuyPrice(pool: PoolPricing, numNFTs: number = 1): bigint {
  const spotPrice = BigInt(pool.spotPrice);
  const delta = BigInt(pool.delta);
  const fee = BigInt(pool.fee);

  let totalPrice = 0n;

  for (let i = 0; i < numNFTs; i++) {
    let price: bigint;

    switch (pool.type) {
      case 'LINEAR':
        price = spotPrice + (delta * BigInt(i));
        break;
      case 'EXPONENTIAL':
        // price = spotPrice * (1 + delta)^i
        price = spotPrice * ((10000n + delta) ** BigInt(i)) / (10000n ** BigInt(i));
        break;
      case 'XYK':
        // Constant product formula
        const k = BigInt(pool.nftBalance) * BigInt(pool.tokenBalance);
        const newNFTBalance = BigInt(pool.nftBalance) - BigInt(i + 1);
        const newTokenBalance = k / newNFTBalance;
        price = newTokenBalance - BigInt(pool.tokenBalance);
        break;
      default:
        throw new Error(`Unknown pool type: ${pool.type}`);
    }

    // Add trading fee
    const feeAmount = (price * fee) / 10000n;
    totalPrice += price + feeAmount;
  }

  return totalPrice;
}

/**
 * Calculate sell price for N NFTs to a pool
 */
export function calculateSellPrice(pool: PoolPricing, numNFTs: number = 1): bigint {
  // Similar logic but inverse (selling reduces price)
  // Implementation details depend on pool curve
  // ...
}
```

### Pool Queries

**File**: `src/lib/lssvm/queries.ts`

```typescript
import { gql } from 'graphql-request';
import { queryLSSVM } from './client';
import { PoolPricing } from './pricing';

const GET_COLLECTION_POOLS = gql`
  query CollectionPools($collection: String!) {
    pools(where: { collection: $collection, active: true }) {
      id
      type
      spotPrice
      delta
      fee
      nftBalance
      tokenBalance
    }
  }
`;

const GET_BEST_BUY_POOL = gql`
  query BestBuyPool($collection: String!) {
    pools(
      where: {
        collection: $collection,
        active: true,
        nftBalance_gt: 0
      }
      orderBy: spotPrice
      orderDirection: asc
      first: 1
    ) {
      id
      type
      spotPrice
      delta
      fee
      nftBalance
      tokenBalance
    }
  }
`;

export async function getCollectionPools(collection: string): Promise<PoolPricing[]> {
  const result = await queryLSSVM<{ pools: PoolPricing[] }>(
    GET_COLLECTION_POOLS,
    { collection: collection.toLowerCase() }
  );
  return result.pools;
}

export async function getBestBuyPool(collection: string): Promise<PoolPricing | null> {
  const result = await queryLSSVM<{ pools: PoolPricing[] }>(
    GET_BEST_BUY_POOL,
    { collection: collection.toLowerCase() }
  );
  return result.pools[0] || null;
}

export async function getBestSellPool(collection: string): Promise<PoolPricing | null> {
  const GET_BEST_SELL_POOL = gql`
    query BestSellPool($collection: String!) {
      pools(
        where: {
          collection: $collection,
          active: true,
          tokenBalance_gt: 0,
          type_in: ["BUY", "TRADE"]
        }
        orderBy: spotPrice
        orderDirection: desc
        first: 1
      ) {
        id
        type
        spotPrice
        delta
        fee
        nftBalance
        tokenBalance
      }
    }
  `;

  const result = await queryLSSVM<{ pools: PoolPricing[] }>(
    GET_BEST_SELL_POOL,
    { collection: collection.toLowerCase() }
  );
  return result.pools[0] || null;
}
```

---

## 🚫 Spam NFT Filtering

### Problem
Users' wallets often contain hundreds of spam NFTs (airdrops, scams, etc.). We don't want to show these.

### Solution: Multi-Level Filtering

**File**: `src/lib/filters/spam.ts`

```typescript
export interface NFTSpamScore {
  contractAddress: string;
  score: number;  // 0-100 (higher = more likely spam)
  reasons: string[];
}

/**
 * Calculate spam score for an NFT collection
 */
export async function calculateSpamScore(contractAddress: string): Promise<NFTSpamScore> {
  const reasons: string[] = [];
  let score = 0;

  // 1. Check if collection has liquidity (LSSVM or Seaport)
  const hasLiquidity = await checkLiquidity(contractAddress);
  if (!hasLiquidity) {
    score += 30;
    reasons.push('No active liquidity');
  }

  // 2. Check trading volume (last 30 days)
  const volume = await getTradeVolume(contractAddress);
  if (volume === 0) {
    score += 25;
    reasons.push('No trading activity');
  }

  // 3. Check if collection is verified/featured
  const isVerified = await isCollectionVerified(contractAddress);
  if (!isVerified) {
    score += 15;
    reasons.push('Not verified');
  }

  // 4. Check holder count
  const holders = await getHolderCount(contractAddress);
  if (holders < 10) {
    score += 20;
    reasons.push('Very few holders');
  }

  // 5. Check if name contains spam keywords
  const metadata = await getCollectionMetadata(contractAddress);
  const spamKeywords = ['airdrop', 'claim', 'free', 'reward', 'bonus'];
  if (spamKeywords.some(kw => metadata.name.toLowerCase().includes(kw))) {
    score += 10;
    reasons.push('Spam keywords in name');
  }

  return { contractAddress, score, reasons };
}

/**
 * Filter NFT collections to remove spam
 */
export async function filterSpamCollections(
  collections: string[]
): Promise<string[]> {
  const scores = await Promise.all(
    collections.map(addr => calculateSpamScore(addr))
  );

  // Filter out collections with spam score > 50
  return scores
    .filter(s => s.score <= 50)
    .map(s => s.contractAddress);
}

/**
 * Check if collection has any liquidity (pools or listings)
 */
async function checkLiquidity(contractAddress: string): Promise<boolean> {
  // Check LSSVM pools
  const pools = await getCollectionPools(contractAddress);
  if (pools.length > 0) return true;

  // Check Seaport listings
  const listings = await getActiveListings(contractAddress);
  if (listings.length > 0) return true;

  return false;
}
```

### Caching Strategy for Spam Scores

```typescript
// Cache spam scores for 24 hours (L3 - cold data)
const cacheKey = `such-market:spam-score:${contractAddress}`;
const cached = await getCache<NFTSpamScore>(cacheKey);
if (cached) return cached;

const score = await calculateSpamScore(contractAddress);
await setCache(cacheKey, score, 86400); // 24 hours
return score;
```

---

## 🎨 UI Components

### UnifiedTradingView Component

**File**: `src/components/trading/UnifiedTradingView.tsx`

```typescript
"use client";

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface TradingViewProps {
  nft: string;
  tokenId?: string;
  action: 'buy' | 'sell';
}

export function UnifiedTradingView({ nft, tokenId, action }: TradingViewProps) {
  const { address } = useAccount();
  const [priceData, setPriceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPriceData();
  }, [nft, tokenId, action]);

  async function fetchPriceData() {
    const params = new URLSearchParams({
      nft,
      action,
      ...(tokenId && { tokenId })
    });

    const response = await fetch(`/api/trading/price-check?${params}`);
    const data = await response.json();
    setPriceData(data.data);
    setLoading(false);
  }

  async function executeTrade() {
    if (action === 'buy') {
      const response = await fetch('/api/trading/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nft,
          tokenId,
          maxPrice: priceData.bestPrice.amount
        })
      });

      const result = await response.json();
      if (result.success) {
        alert(`Purchase successful! ${result.data.instant ? 'Instant' : 'Pending signature'}`);
      }
    } else {
      // Handle sell/list
    }
  }

  if (loading) {
    return <div className="animate-pulse">Loading best price...</div>;
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 space-y-4">
      {/* Best Price Display */}
      <div className="text-center">
        <div className="text-sm text-gray-400 uppercase tracking-wide">
          {action === 'buy' ? 'Best Buy Price' : 'Best Sell Price'}
        </div>
        <div className="text-4xl font-bold text-white mt-2">
          {priceData.bestPrice.amount} ETH
        </div>
        {priceData.bestPrice.instant && (
          <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-sm">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Instant {action === 'buy' ? 'Buy' : 'Sell'}
          </div>
        )}
      </div>

      {/* Execute Button */}
      <button
        onClick={executeTrade}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
      >
        {action === 'buy' ? 'Buy Now' : 'Sell Now'} · {priceData.bestPrice.amount} ETH
      </button>

      {/* Alternative Options */}
      {priceData.alternatives && priceData.alternatives.length > 0 && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <div className="text-sm text-gray-400 mb-2">Other Options:</div>
          <div className="space-y-2">
            {priceData.alternatives.map((alt: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm bg-gray-800/50 rounded p-3">
                <div>
                  <div className="text-white font-medium">{alt.amount} ETH</div>
                  <div className="text-gray-500 text-xs">
                    {alt.instant ? 'Instant' : 'Requires signature'}
                  </div>
                </div>
                <button className="text-blue-400 hover:text-blue-300 text-xs">
                  Select
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pool Info (if applicable) */}
      {priceData.pool && (
        <div className="text-xs text-gray-500 text-center">
          Pool Liquidity: {priceData.pool.nftBalance} NFTs · {priceData.pool.tokenBalance} ETH
        </div>
      )}
    </div>
  );
}
```

### List vs. Create Pool UI

```typescript
// When user wants to sell, show two options:
// 1. "List" (Seaport listing) - Set your price, wait for buyer
// 2. "Sell Now" (LSSVM pool) - Instant sale at current pool price

export function SellOptions({ nft, tokenId }: { nft: string; tokenId: string }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">How do you want to sell?</h3>

      <button className="w-full bg-gray-800 hover:bg-gray-700 p-4 rounded-lg text-left">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-bold">List for Sale</div>
            <div className="text-sm text-gray-400">Set your price, wait for a buyer</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">You choose price</div>
          </div>
        </div>
      </button>

      <button className="w-full bg-green-900/30 hover:bg-green-900/40 p-4 rounded-lg text-left border border-green-700">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-bold flex items-center gap-2">
              Sell Now
              <span className="text-xs bg-green-700 px-2 py-0.5 rounded-full">Instant</span>
            </div>
            <div className="text-sm text-gray-400">Instant sale to liquidity pool</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-green-400">0.095 ETH</div>
            <div className="text-xs text-gray-400">Current pool offer</div>
          </div>
        </div>
      </button>
    </div>
  );
}
```

---

## 📝 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create LSSVM subgraph client utilities
- [ ] Implement pool price calculators
- [ ] Create spam filtering system
- [ ] Update database schema for LSSVM integration
- [ ] Set up environment variables for subgraph URL

**Deliverables**:
- `src/lib/lssvm/` directory with client, queries, pricing
- `src/lib/filters/spam.ts` with spam detection logic
- Environment variable: `LSSVM_SUBGRAPH_URL`

### Phase 2: API Layer (Week 2)
- [ ] Build unified price-check API
- [ ] Build unified buy API
- [ ] Build unified list/sell API
- [ ] Integrate with existing cache system
- [ ] Add comprehensive error handling

**Deliverables**:
- `src/app/api/trading/` directory with all endpoints
- Cache keys following existing pattern
- API response format matching existing conventions

### Phase 3: UI Components (Week 3)
- [ ] Build UnifiedTradingView component
- [ ] Build SellOptions component (List vs. Sell Now)
- [ ] Update existing NFT card components
- [ ] Add loading states and error handling
- [ ] Mobile-first responsive design

**Deliverables**:
- `src/components/trading/` directory
- Updated NFTGrid.tsx to use unified trading view
- Mobile-optimized Farcaster frame UI

### Phase 4: Integration & Testing (Week 4)
- [ ] End-to-end testing of buy flow
- [ ] End-to-end testing of sell/list flow
- [ ] Performance testing with cache metrics
- [ ] Spam filtering validation
- [ ] User acceptance testing

**Deliverables**:
- Test suite for trading flows
- Performance benchmarks
- Spam filter accuracy report

### Phase 5: Polish & Launch (Week 5)
- [ ] Update TASKS.md with completion status
- [ ] Update CLAUDE.md with new architecture
- [ ] Create user-facing documentation
- [ ] Deploy to production
- [ ] Monitor error rates and performance

---

## 🔧 Configuration

### Environment Variables

Add to `.env.local` and `.env.example`:

```bash
# LSSVM Subgraph (Base Mainnet)
LSSVM_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/your-org/such-lssvm-base

# LSSVM Contract Addresses (Base)
LSSVM_FACTORY_ADDRESS=0x... # Your factory address
LSSVM_ROUTER_ADDRESS=0x...  # Your router address
```

### Cache Strategy

```typescript
// L1 (5 min) - Hot data
- Pool prices: `such-market:lssvm:pool:${poolId}:price`
- Active listings: `such-market:trading:listings:${collection}:active`
- Best prices: `such-market:trading:price:${nft}:${tokenId}:${action}`

// L2 (30 min) - Warm data
- Collection pools: `such-market:lssvm:collection:${address}:pools`
- Collection liquidity: `such-market:trading:liquidity:${collection}`

// L3 (24 hour) - Cold data
- Spam scores: `such-market:spam-score:${contractAddress}`
- User collections (filtered): `such-market:user:${fid}:collections:filtered`
```

---

## 🎯 Success Metrics

### Performance Targets
- [ ] Price check API: <100ms (cached), <500ms (uncached)
- [ ] Buy transaction: <2s total
- [ ] Spam filtering: >95% accuracy
- [ ] Cache hit rate: >90% for price checks

### User Experience Targets
- [ ] <2s to see best price
- [ ] 0 spam NFTs shown in user profiles
- [ ] Clear indication of instant vs. pending trades
- [ ] Mobile-first design works on all Farcaster clients

---

## 📚 Additional Resources

### LSSVM Documentation
- Protocol: https://docs.sudoswap.xyz/
- Subgraph: (Link to your subgraph docs)
- Contracts on Base: (Basescan links)

### Existing Documentation
- Seaport Integration: `docs/seaport-integration-plan.md`
- API Reference: `docs/api-endpoints-cheatsheet.md`
- Database Schema: `db/README.md`
- Testing Guide: `docs/testing-guide.md`

---

**Document Status**: Living document - update as implementation progresses
**Owner**: Development Team
**Review Frequency**: Weekly during implementation
