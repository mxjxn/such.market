# Seaport Integration Plan for Such.Market 🛒

## Overview

This document outlines the comprehensive integration of OpenSea's Seaport protocol into Such.Market, enabling NFT listings, offers, trades, and auctions. The plan follows a **phased approach** to ensure scalability and maintainability while leveraging your existing optimized database architecture.

## 🎯 Goals

- **Phase 1**: Basic listings and offers (ETH/ERC-20 for NFTs)
- **Phase 2**: Advanced trading (NFT for NFT, bundles, auctions)
- **Phase 3**: Social features and notifications
- **Phase 4**: Advanced creator tools

## 📊 Database Schema Design

### New Tables for Seaport Integration

#### 1. `seaport_orders` Table
```sql
CREATE TABLE seaport_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_hash TEXT UNIQUE NOT NULL,
  offerer_address TEXT NOT NULL,
  fulfiller_address TEXT,
  order_type TEXT NOT NULL, -- 'listing', 'offer', 'auction'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'fulfilled', 'cancelled', 'expired'
  
  -- Order metadata
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  salt TEXT NOT NULL,
  conduit_key TEXT,
  zone_hash TEXT,
  counter BIGINT NOT NULL,
  
  -- Order components (JSONB for flexibility)
  offer_items JSONB NOT NULL, -- Array of OfferItem structs
  consideration_items JSONB NOT NULL, -- Array of ConsiderationItem structs
  
  -- Farcaster integration
  fc_user_id BIGINT,
  frame_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes
  CONSTRAINT valid_order_type CHECK (order_type IN ('listing', 'offer', 'auction')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired'))
);

-- Indexes for performance
CREATE INDEX idx_seaport_orders_offerer ON seaport_orders(offerer_address);
CREATE INDEX idx_seaport_orders_status ON seaport_orders(status);
CREATE INDEX idx_seaport_orders_type ON seaport_orders(order_type);
CREATE INDEX idx_seaport_orders_time ON seaport_orders(start_time, end_time);
CREATE INDEX idx_seaport_orders_hash ON seaport_orders(order_hash);
CREATE INDEX idx_seaport_orders_fc_user ON seaport_orders(fc_user_id);
```

#### 2. `seaport_order_items` Table (Normalized for efficient querying)
```sql
CREATE TABLE seaport_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES seaport_orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'offer' or 'consideration'
  token_type INTEGER NOT NULL, -- 0=ETH, 1=ERC20, 2=ERC721, 3=ERC1155
  token_address TEXT,
  token_id TEXT,
  amount TEXT NOT NULL, -- BigNumber as string
  recipient_address TEXT,
  start_amount TEXT,
  end_amount TEXT,
  
  -- For NFT items, link to our existing tables
  collection_id UUID REFERENCES collections(id),
  nft_id UUID REFERENCES nfts(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT valid_item_type CHECK (item_type IN ('offer', 'consideration')),
  CONSTRAINT valid_token_type CHECK (token_type IN (0, 1, 2, 3))
);

-- Indexes for performance
CREATE INDEX idx_order_items_order ON seaport_order_items(order_id);
CREATE INDEX idx_order_items_type ON seaport_order_items(item_type);
CREATE INDEX idx_order_items_token ON seaport_order_items(token_address, token_id);
CREATE INDEX idx_order_items_collection ON seaport_order_items(collection_id);
CREATE INDEX idx_order_items_nft ON seaport_order_items(nft_id);
```

#### 3. `seaport_fulfillments` Table
```sql
CREATE TABLE seaport_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES seaport_orders(id) ON DELETE CASCADE,
  fulfiller_address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  gas_used BIGINT,
  gas_price TEXT,
  
  -- Fulfillment details
  offer_components JSONB NOT NULL,
  consideration_components JSONB NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fulfillments_order ON seaport_fulfillments(order_id);
CREATE INDEX idx_fulfillments_tx ON seaport_fulfillments(transaction_hash);
CREATE INDEX idx_fulfillments_fulfiller ON seaport_fulfillments(fulfiller_address);
```

#### 4. `seaport_notifications` Table
```sql
CREATE TABLE seaport_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fc_user_id BIGINT NOT NULL,
  order_id UUID REFERENCES seaport_orders(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'offer_received', 'listing_sold', 'offer_accepted', 'auction_ending'
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_notification_type CHECK (notification_type IN ('offer_received', 'listing_sold', 'offer_accepted', 'auction_ending'))
);

-- Indexes
CREATE INDEX idx_notifications_user ON seaport_notifications(fc_user_id);
CREATE INDEX idx_notifications_type ON seaport_notifications(notification_type);
CREATE INDEX idx_notifications_read ON seaport_notifications(is_read);
```

### Updated Existing Tables

#### 1. Add Seaport fields to `collections` table
```sql
ALTER TABLE collections ADD COLUMN IF NOT EXISTS seaport_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS royalty_percentage INTEGER DEFAULT 0; -- Basis points (0-10000)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS royalty_recipient TEXT;
```

#### 2. Add Seaport fields to `nfts` table
```sql
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS current_listing_id UUID REFERENCES seaport_orders(id);
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS last_offer_amount TEXT; -- Latest offer amount
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS last_offer_time TIMESTAMP WITH TIME ZONE;
```

## 🏗️ API Architecture

### New API Endpoints Structure

```
/api/seaport/
├── orders/
│   ├── [orderHash]/route.ts          # GET order details
│   ├── create/route.ts               # POST create new order
│   ├── cancel/route.ts               # POST cancel order
│   └── fulfill/route.ts              # POST fulfill order
├── listings/
│   ├── [contractAddress]/route.ts    # GET collection listings
│   ├── [contractAddress]/[tokenId]/route.ts # GET NFT listings
│   └── create/route.ts               # POST create listing
├── offers/
│   ├── [contractAddress]/[tokenId]/route.ts # GET NFT offers
│   ├── create/route.ts               # POST create offer
│   └── accept/route.ts               # POST accept offer
├── auctions/
│   ├── [contractAddress]/[tokenId]/route.ts # GET NFT auctions
│   ├── create/route.ts               # POST create auction
│   └── bid/route.ts                  # POST place bid
└── notifications/
    ├── route.ts                      # GET user notifications
    └── mark-read/route.ts            # POST mark as read
```

### Core API Functions

#### 1. Order Creation (`/api/seaport/orders/create`)
```typescript
interface CreateOrderRequest {
  orderType: 'listing' | 'offer' | 'auction';
  offerItems: OfferItem[];
  considerationItems: ConsiderationItem[];
  startTime: number;
  endTime: number;
  zone?: string;
  zoneHash?: string;
  conduitKey?: string;
  fcUserId?: number;
}

interface CreateOrderResponse {
  orderHash: string;
  orderComponents: OrderComponents;
  signature: string;
  frameUrl: string;
}
```

#### 2. Order Fulfillment (`/api/seaport/orders/fulfill`)
```typescript
interface FulfillOrderRequest {
  orderHash: string;
  fulfillerAddress: string;
  offerComponents: FulfillmentComponent[];
  considerationComponents: FulfillmentComponent[];
}

interface FulfillOrderResponse {
  transactionHash: string;
  gasUsed: number;
  status: 'success' | 'failed';
}
```

#### 3. Listings Feed (`/api/seaport/listings/[contractAddress]`)
```typescript
interface ListingsResponse {
  listings: {
    orderHash: string;
    tokenId: string;
    price: string;
    currency: string;
    seller: string;
    expiresAt: string;
    frameUrl: string;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
```

## 🔧 Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Basic listings and offers functionality

#### Tasks:
1. **Database Setup**
   - Create new Seaport tables
   - Add indexes and constraints
   - Migrate existing data

2. **Core Seaport Integration**
   - Install Seaport SDK and types
   - Set up Seaport contract addresses for Base
   - Create order creation utilities

3. **Basic API Endpoints**
   - Order creation endpoint
   - Order fulfillment endpoint
   - Basic listings feed

4. **Frontend Components**
   - Listing creation form
   - Basic listings display
   - Order fulfillment UI

#### Deliverables:
- Users can list NFTs for ETH/ERC-20
- Users can make offers on NFTs
- Users can accept offers
- Basic listings feed

### Phase 2: Advanced Trading (Week 3-4)
**Goal**: NFT-for-NFT trades, bundles, and auctions

#### Tasks:
1. **Bundle Support**
   - Multiple NFT listings
   - Bundle offers
   - Partial fulfillment

2. **Auction System**
   - Time-based auctions
   - Minimum bid increments
   - Auction ending notifications

3. **Advanced Order Types**
   - Contract orders
   - Zone-based orders
   - Criteria-based orders

#### Deliverables:
- NFT-for-NFT trades
- Bundle listings and offers
- Time-based auctions
- Advanced order validation

### Phase 3: Social Features (Week 5-6)
**Goal**: Farcaster integration and notifications

#### Tasks:
1. **Farcaster Integration**
   - Frame-based order sharing
   - Social discovery
   - Community features

2. **Notification System**
   - Real-time notifications
   - Email/push notifications
   - Notification preferences

3. **Analytics Dashboard**
   - Trading volume metrics
   - User activity tracking
   - Market insights

#### Deliverables:
- Frame-compatible order sharing
- Real-time notifications
- Social trading features
- Analytics dashboard

### Phase 4: Advanced Features (Week 7-8)
**Goal**: Creator tools and advanced marketplace features

#### Tasks:
1. **Creator Tools**
   - Royalty management
   - Creator analytics
   - Collection management

2. **Advanced Marketplace**
   - Order book visualization
   - Price history charts
   - Market making tools

3. **Performance Optimization**
   - Advanced caching
   - Database optimization
   - CDN integration

#### Deliverables:
- Creator dashboard
- Advanced analytics
- Performance optimizations
- Production deployment

## 🛠️ Technical Implementation Details

### Seaport SDK Integration

#### 1. Install Dependencies
```bash
pnpm add @opensea/seaport-js @opensea/seaport-types
pnpm add -D @types/node
```

#### 2. Seaport Configuration
```typescript
// lib/seaport/config.ts
export const SEAPORT_CONFIG = {
  // Base Mainnet addresses
  SEAPORT_V1_6: '0x0000000000000068F116a894984e2DB1123eB395',
  CONDUIT_CONTROLLER: '0x00000000F9490004C11Cef243f5400493c00Ad63',
  
  // Chain configuration
  CHAIN_ID: 8453, // Base
  RPC_URL: process.env.BASE_MAINNET_RPC!,
  
  // Default order parameters
  DEFAULT_ZONE: '0x004C00500000aD104D7DBd00e3ae0A5C00560C00',
  DEFAULT_CONDUIT_KEY: '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000',
};
```

#### 3. Order Creation Utility
```typescript
// lib/seaport/orders.ts
import { Seaport } from '@opensea/seaport-js';
import { OrderComponents, OfferItem, ConsiderationItem } from '@opensea/seaport-types';

export class SeaportOrderManager {
  private seaport: Seaport;
  
  constructor() {
    this.seaport = new Seaport(SEAPORT_CONFIG);
  }
  
  async createListing(
    offerer: string,
    tokenAddress: string,
    tokenId: string,
    price: string,
    currency: string = '0x0000000000000000000000000000000000000000' // ETH
  ): Promise<{ orderHash: string; orderComponents: OrderComponents }> {
    const offer: OfferItem[] = [{
      itemType: 2, // ERC721
      token: tokenAddress,
      identifierOrCriteria: tokenId,
      startAmount: '1',
      endAmount: '1'
    }];
    
    const consideration: ConsiderationItem[] = [{
      itemType: currency === '0x0000000000000000000000000000000000000000' ? 0 : 1, // ETH or ERC20
      token: currency,
      identifierOrCriteria: '0',
      startAmount: price,
      endAmount: price,
      recipient: offerer
    }];
    
    const orderComponents: OrderComponents = {
      offerer,
      zone: SEAPORT_CONFIG.DEFAULT_ZONE,
      offer,
      consideration,
      orderType: 0, // FULL_OPEN
      startTime: Math.floor(Date.now() / 1000),
      endTime: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      salt: this.generateSalt(),
      conduitKey: SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY,
      counter: await this.getCounter(offerer)
    };
    
    const orderHash = this.seaport.getOrderHash(orderComponents);
    
    return { orderHash, orderComponents };
  }
  
  private generateSalt(): string {
    return '0x' + Math.random().toString(16).slice(2, 66).padEnd(64, '0');
  }
  
  private async getCounter(offerer: string): Promise<number> {
    // Implementation to get user's current counter
    return 0; // Placeholder
  }
}
```

### Database Integration

#### 1. Order Storage
```typescript
// lib/db/seaport.ts
export async function storeOrder(
  orderHash: string,
  orderComponents: OrderComponents,
  orderType: 'listing' | 'offer' | 'auction',
  fcUserId?: number
): Promise<void> {
  const { data, error } = await supabase
    .from('seaport_orders')
    .insert({
      order_hash: orderHash,
      offerer_address: orderComponents.offerer.toLowerCase(),
      order_type: orderType,
      start_time: new Date(orderComponents.startTime * 1000).toISOString(),
      end_time: new Date(orderComponents.endTime * 1000).toISOString(),
      salt: orderComponents.salt,
      conduit_key: orderComponents.conduitKey,
      zone_hash: orderComponents.zoneHash,
      counter: orderComponents.counter,
      offer_items: orderComponents.offer,
      consideration_items: orderComponents.consideration,
      fc_user_id: fcUserId
    });
    
  if (error) throw error;
}
```

#### 2. Order Retrieval with Caching
```typescript
// lib/db/seaport.ts
export async function getActiveListings(
  contractAddress: string,
  page: number = 0,
  limit: number = 20
): Promise<{ listings: any[]; total: number }> {
  const cacheKey = `listings:${contractAddress}:${page}:${limit}`;
  
  // Check cache first
  const cached = await getCache(cacheKey);
  if (cached) return cached;
  
  const { data: listings, error, count } = await supabase
    .from('seaport_orders')
    .select(`
      *,
      seaport_order_items!inner(*)
    `, { count: 'exact' })
    .eq('order_type', 'listing')
    .eq('status', 'active')
    .gte('end_time', new Date().toISOString())
    .range(page * limit, (page + 1) * limit - 1)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  const result = { listings: listings || [], total: count || 0 };
  
  // Cache for 30 seconds
  await setCache(cacheKey, result, 30);
  
  return result;
}
```

### Frontend Components

#### 1. Listing Creation Component
```typescript
// components/Seaport/CreateListing.tsx
export function CreateListing({ nft, onSuccess }: { nft: NFT; onSuccess: () => void }) {
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('ETH');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/seaport/listings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: nft.collection.contract_address,
          tokenId: nft.token_id,
          price,
          currency
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        onSuccess();
        // Show success message
      }
    } catch (error) {
      console.error('Error creating listing:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Price
        </label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          placeholder="0.1"
          step="0.01"
          required
        />
      </div>
      
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Listing'}
      </button>
    </form>
  );
}
```

#### 2. Listings Feed Component
```typescript
// components/Seaport/ListingsFeed.tsx
export function ListingsFeed({ contractAddress }: { contractAddress: string }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  
  useEffect(() => {
    fetchListings();
  }, [contractAddress, page]);
  
  const fetchListings = async () => {
    try {
      const response = await fetch(
        `/api/seaport/listings/${contractAddress}?page=${page}&limit=20`
      );
      const data = await response.json();
      setListings(data.listings);
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div>Loading listings...</div>;
  
  return (
    <div className="space-y-4">
      {listings.map((listing) => (
        <ListingCard key={listing.orderHash} listing={listing} />
      ))}
    </div>
  );
}
```

## 🔄 Event-Driven Architecture

### Order Lifecycle Events

#### 1. Order Created Event
```typescript
// lib/events/seaport.ts
export async function handleOrderCreated(orderData: any) {
  // Update database
  await storeOrder(orderData);
  
  // Send notifications
  if (orderData.fcUserId) {
    await sendNotification({
      fcUserId: orderData.fcUserId,
      type: 'listing_created',
      message: `Your listing for ${orderData.tokenId} has been created!`
    });
  }
  
  // Update cache
  await invalidateCache(`listings:${orderData.contractAddress}`);
}
```

#### 2. Order Fulfilled Event
```typescript
export async function handleOrderFulfilled(fulfillmentData: any) {
  // Update order status
  await updateOrderStatus(fulfillmentData.orderHash, 'fulfilled');
  
  // Update NFT ownership
  await updateNFTOwnership(fulfillmentData);
  
  // Send notifications
  await sendFulfillmentNotifications(fulfillmentData);
  
  // Update cache
  await invalidateCache(`listings:${fulfillmentData.contractAddress}`);
}
```

### Cache Invalidation Strategy

```typescript
// lib/cache/seaport.ts
export async function invalidateSeaportCache(contractAddress: string) {
  const patterns = [
    `listings:${contractAddress}:*`,
    `offers:${contractAddress}:*`,
    `auctions:${contractAddress}:*`,
    `user:${contractAddress}:*`
  ];
  
  for (const pattern of patterns) {
    await deleteCachePattern(pattern);
  }
}
```

## 📊 Performance Considerations

### 1. Database Optimization
- **Indexing**: Comprehensive indexes on frequently queried fields
- **Partitioning**: Consider partitioning large tables by date
- **Materialized Views**: For complex aggregations

### 2. Caching Strategy
- **Redis**: Hot data (active listings, recent offers)
- **CDN**: Static assets and images
- **Browser Cache**: API responses with appropriate headers

### 3. API Optimization
- **Pagination**: Efficient pagination for large datasets
- **Filtering**: Server-side filtering and sorting
- **Rate Limiting**: Protect against abuse

## 🔒 Security Considerations

### 1. Order Validation
- **Signature Verification**: Verify all order signatures
- **Replay Protection**: Check order counters and salts
- **Expiration Checks**: Validate order timestamps

### 2. Access Control
- **Authentication**: Require Farcaster authentication for actions
- **Authorization**: Verify user owns NFTs before listing
- **Rate Limiting**: Prevent spam and abuse

### 3. Smart Contract Security
- **Address Validation**: Verify contract addresses
- **Gas Estimation**: Provide accurate gas estimates
- **Error Handling**: Graceful handling of failed transactions

## 🧪 Testing Strategy

### 1. Unit Tests
- Order creation and validation
- Database operations
- Cache operations

### 2. Integration Tests
- API endpoint testing
- Seaport contract integration
- Database migration testing

### 3. End-to-End Tests
- Complete user flows
- Transaction testing on testnet
- Performance testing

## 📈 Monitoring and Analytics

### 1. Key Metrics
- **Trading Volume**: Daily/weekly/monthly
- **User Activity**: Active users, transactions per user
- **Performance**: API response times, cache hit rates
- **Errors**: Failed transactions, API errors

### 2. Alerts
- **High Error Rates**: API failures, transaction failures
- **Performance Degradation**: Slow response times
- **Security Events**: Unusual activity patterns

## 🚀 Deployment Strategy

### 1. Staging Environment
- Testnet deployment
- Full integration testing
- Performance testing

### 2. Production Deployment
- Gradual rollout
- Feature flags for new functionality
- Rollback procedures

### 3. Post-Deployment
- Monitoring and alerting
- User feedback collection
- Performance optimization

## 📝 Next Steps

1. **Review and Approve**: Review this plan with the team
2. **Database Setup**: Create migration files for new tables
3. **Seaport SDK Integration**: Set up basic Seaport integration
4. **API Development**: Start with Phase 1 API endpoints
5. **Frontend Development**: Create basic UI components
6. **Testing**: Implement comprehensive test suite
7. **Deployment**: Deploy to staging environment

This plan provides a comprehensive roadmap for integrating Seaport into Such.Market while maintaining the existing performance optimizations and user experience standards. 