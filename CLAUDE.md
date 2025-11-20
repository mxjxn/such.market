# CLAUDE.md - Developer Guide for AI Assistants

> This document is specifically designed for AI assistants (like Claude) working on Such.Market. It provides a comprehensive overview of the codebase, architecture, conventions, and critical knowledge needed to effectively contribute to the project.

## 🎯 Project Overview

**Such.Market** is a Farcaster Mini App for trading NFTs on Base blockchain. It's a production-ready, mobile-first NFT marketplace with advanced caching, optimized database architecture, and Seaport protocol integration for decentralized trading.

### Key Characteristics
- **Target Platform**: Farcaster social network (mobile-first)
- **Blockchain**: Base (Ethereum L2)
- **Architecture**: Next.js 15 full-stack app with serverless API routes
- **Database**: Supabase (PostgreSQL) with normalized schema
- **Caching**: Upstash Redis with 3-tier hierarchical strategy
- **Trading**: OpenSea Seaport protocol for decentralized NFT trades
- **Current Status**: Production-ready with active development

## 📁 Project Structure

```
such.market/
├── src/
│   ├── app/                      # Next.js 15 App Router
│   │   ├── api/                  # API Routes (20+ endpoints)
│   │   │   ├── admin/           # Admin tools (cache, health, errors)
│   │   │   ├── collection/      # Collection data & management
│   │   │   ├── seaport/         # Trading (offers, fulfillments)
│   │   │   ├── notifications/   # In-app notifications
│   │   │   └── profile/         # User profiles
│   │   ├── collection/[contractAddress]/ # Collection pages
│   │   ├── profile/             # User profile pages
│   │   └── page.tsx             # Homepage
│   ├── components/              # React components
│   │   ├── homepage/           # Homepage-specific components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── NFTGrid.tsx         # NFT display grid
│   │   └── OfferForm.tsx       # Trading interface
│   ├── lib/                     # Utilities & business logic
│   │   ├── cache/              # Cache analytics & events
│   │   ├── db/                 # Database utilities
│   │   ├── seaport/            # Seaport integration
│   │   ├── supabase.ts         # Database client
│   │   ├── redis.ts            # Cache management
│   │   └── alchemy.ts          # Blockchain data
│   └── auth.ts                  # Farcaster authentication
├── db/
│   ├── migrations/              # SQL migrations (9 files)
│   ├── seed/                    # Database seed scripts
│   └── types/                   # TypeScript DB types
├── docs/                        # Comprehensive documentation
│   ├── api-endpoints-cheatsheet.md
│   ├── database-optimization-analysis.md
│   ├── seaport-integration-plan.md
│   ├── testing-guide.md
│   └── ...
└── public/                      # Static assets

```

## 🏗️ Architecture Deep Dive

### 1. Three-Tier Caching Strategy

The app uses a sophisticated hierarchical caching system with Redis:

```typescript
// Cache Tiers (defined in src/lib/redis.ts)
- L1: Hot Data (5 min TTL)     → Collection metadata, user profiles
- L2: Warm Data (30 min TTL)   → Collection NFTs, traits, stats
- L3: Cold Data (24 hour TTL)  → User collections, wallet contracts
```

**Key Files**:
- `src/lib/redis.ts` - Redis client and cache utilities
- `src/lib/cache/analytics.ts` - Real-time cache performance tracking
- `src/lib/cache/events.ts` - Event-driven cache invalidation
- `src/lib/cache/performance.ts` - Performance testing framework

**Cache Key Pattern**: `such-market:{category}:{identifier}:{subcategory}`

Example: `such-market:collections:0x123...:metadata`

### 2. Normalized Database Schema

The database uses a normalized approach for optimal performance:

#### Core Tables
- `collections` - NFT collection metadata (featured flag, royalties)
- `nfts` - Individual NFT data with ownership
- `fc_users` - Farcaster user profiles
- `collection_traits` - Trait aggregations for filtering

#### Normalized Ownership System (replaces legacy JSONB approach)
- `nft_ownership` - Individual NFT ownership tracking
- `user_collections` - Auto-maintained user collection summaries
- `wallet_collection_mapping` - Wallet-to-collection relationships

#### Trading System (Seaport Integration)
- `seaport_orders` - Seaport order tracking (listings, offers, auctions)
- `seaport_order_items` - Normalized order items
- `seaport_fulfillments` - Trade fulfillment records
- `seaport_notifications` - In-app notifications

#### Engagement & Site Management
- `collection_engagement` - Collection-level engagement metrics
- `site_settings` - Admin-configurable site content

**Key Patterns**:
- PostgreSQL triggers maintain data consistency automatically
- Proper indexing for all common query patterns
- JSONB used sparingly and only where truly beneficial

**Migration Files**: Located in `db/migrations/`, numbered sequentially

### 3. API Architecture

All APIs follow RESTful conventions with these patterns:

#### API Response Format
```typescript
// Success
{ success: true, data: {...}, cached?: true }

// Error
{ success: false, error: string, details?: any }
```

#### Key API Endpoints

**Collection Management**:
- `GET /api/collection/[contractAddress]` - Collection metadata
- `GET /api/collection/[contractAddress]/nfts` - Paginated NFTs
- `POST /api/collection/[contractAddress]/refresh` - Trigger data refresh
- `POST /api/collection/[contractAddress]/populate` - Background population

**Trading (Seaport)**:
- `POST /api/seaport/offers/create` - Create offer order
- `POST /api/seaport/offers/fulfill` - Accept offer
- `GET /api/seaport/trades/recent` - Recent trades feed

**Notifications**:
- `GET /api/notifications` - User notifications
- `GET /api/notifications/unread-count` - Unread count
- `POST /api/notifications/[id]/read` - Mark as read

**Admin & Monitoring**:
- `GET /api/admin/cache/metrics` - Real-time cache performance
- `POST /api/admin/cache/test/performance` - Run performance tests
- `GET /api/admin/ownership/stats` - Ownership system statistics
- `GET /api/admin/collection-health` - Collection health monitoring

**User Profiles**:
- `GET /api/profile/[fid]/collections` - User's collections with smart prioritization

### 4. Seaport Integration Status

**✅ IMPLEMENTED**:
- Offer creation (`/api/seaport/offers/create`)
- Offer fulfillment (`/api/seaport/offers/fulfill`)
- Recent trades feed (`/api/seaport/trades/recent`)
- Database schema for orders, items, fulfillments, notifications
- Notification system for offers

**🔄 IN PROGRESS**:
- NFT listings (schema ready, implementation pending)

**⏳ PLANNED**:
- NFT-for-NFT trades
- Bundle trading
- Auctions
- Advanced order types

**Key Files**:
- `src/lib/seaport/orders.ts` - Seaport order utilities
- `src/lib/seaport/types.ts` - TypeScript types for Seaport
- `src/components/OfferForm.tsx` - Offer creation UI

## 🔑 Critical Knowledge

### 1. Environment Variables

Required environment variables (defined in `.env.local`):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Redis (CRITICAL - use these variable names)
KV_REST_API_URL=your_redis_url
KV_REST_API_TOKEN=your_redis_token

# Alchemy (Blockchain data)
ALCHEMY_API_KEY=your_alchemy_api_key

# Neynar (Farcaster integration)
NEXT_PUBLIC_NEYNAR_API_KEY=your_neynar_api_key
```

**IMPORTANT**: Redis variables MUST be `KV_REST_API_URL` and `KV_REST_API_TOKEN`. The codebase was unified to use these consistently.

### 2. Development Workflow

**Starting Development**:
```bash
pnpm dev              # Start development server
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed database with initial data
```

**Database Operations**:
```bash
# Run migrations (production)
SUPABASE_ENV=production pnpm db:migrate

# Seed database
pnpm db:seed
```

**Monitoring & Admin**:
```bash
# Check cache metrics
curl http://localhost:3000/api/admin/cache/metrics

# Run performance tests
curl -X POST http://localhost:3000/api/admin/cache/test/performance \
  -H "Content-Type: application/json" \
  -d '{"action": "run"}'

# Check ownership stats
curl http://localhost:3000/api/admin/ownership/stats
```

### 3. Common Patterns & Conventions

#### Database Queries
```typescript
// Always use Supabase client from lib
import { createSupabaseClient } from '~/lib/supabase'

const supabase = createSupabaseClient()
const { data, error } = await supabase
  .from('collections')
  .select('*')
  .eq('contract_address', address.toLowerCase()) // Always lowercase addresses
  .single()
```

#### Caching Pattern
```typescript
import { getCache, setCache, invalidateCache } from '~/lib/redis'

// Always check cache first
const cacheKey = `such-market:collections:${address}:metadata`
const cached = await getCache<CollectionData>(cacheKey)
if (cached) return cached

// Fetch from DB or API
const data = await fetchFromSource()

// Cache with appropriate TTL
await setCache(cacheKey, data, 300) // 5 minutes for hot data

return data
```

#### API Route Pattern
```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // 1. Extract parameters
    const { searchParams } = new URL(request.url)
    const param = searchParams.get('param')

    // 2. Validate inputs
    if (!param) {
      return NextResponse.json(
        { success: false, error: 'Missing parameter' },
        { status: 400 }
      )
    }

    // 3. Check cache
    const cached = await getCache(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true
      })
    }

    // 4. Fetch data
    const data = await fetchData(param)

    // 5. Cache result
    await setCache(cacheKey, data, ttl)

    // 6. Return response
    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### 4. Performance Targets

The app has been optimized to meet these targets:

- **Cache Hit Rate**: 95%+ (with event-driven invalidation)
- **API Response Time**: <100ms for cached data
- **Database Query Time**: <100ms for indexed queries
- **Page Load Time**: <2s on mobile
- **NFT Discovery Rate**: 95%+ for standard collections
- **Metadata Fetch Success**: 90%+ with fallback sources

### 5. Testing Strategy

See `docs/testing-guide.md` for comprehensive testing documentation.

**Quick Testing Commands**:
```bash
# Cache performance
curl http://localhost:3000/api/admin/cache/metrics

# Run performance tests
curl -X POST http://localhost:3000/api/admin/cache/test/performance \
  -d '{"action": "run"}'

# Check collection health
curl http://localhost:3000/api/admin/collection-health
```

## 🚨 Common Pitfalls & Gotchas

### 1. Address Normalization
**ALWAYS** lowercase Ethereum addresses:
```typescript
// ✅ CORRECT
const address = contractAddress.toLowerCase()

// ❌ WRONG
const address = contractAddress // May have mixed case
```

### 2. Redis Environment Variables
**MUST** use `KV_REST_API_URL` and `KV_REST_API_TOKEN`, not alternatives:
```typescript
// ✅ CORRECT - from src/lib/redis.ts
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// ❌ WRONG - old variable names
url: process.env.UPSTASH_REDIS_REST_URL
```

### 3. Database Migrations
Always create migrations sequentially:
```bash
# Next migration should be:
0010_your_migration_name.sql  # NOT 010 or 10
```

### 4. Cache Invalidation
Use the event system for automatic invalidation:
```typescript
import { emitCacheEvent } from '~/lib/cache/events'

// After updating collection data
await emitCacheEvent({
  type: 'collection_updated',
  resourceId: collectionId,
  metadata: { contractAddress }
})
// Cache will be automatically invalidated
```

### 5. Seaport Order Creation
Always use the proper Base mainnet addresses:
```typescript
// From src/lib/seaport/orders.ts
export const SEAPORT_CONFIG = {
  SEAPORT_V1_6: '0x0000000000000068F116a894984e2DB1123eB395',
  CONDUIT_CONTROLLER: '0x00000000F9490004C11Cef243f5400493c00Ad63',
  CHAIN_ID: 8453, // Base mainnet
  // ...
}
```

## 📚 Documentation Reference

### Essential Reading
1. **`README.md`** - Project overview, getting started, features
2. **`docs/api-endpoints-cheatsheet.md`** - Complete API reference
3. **`docs/database-optimization-analysis.md`** - Database architecture (all 3 phases complete)
4. **`docs/testing-guide.md`** - Testing strategies and tools
5. **`docs/seaport-integration-plan.md`** - Trading implementation status

### Database Documentation
- **`db/README.md`** - Database setup and schema overview
- **`db/OPTIMIZATION_README.md`** - Optimization implementation details
- **`docs/database-optimization-analysis.md`** - Complete optimization analysis (Phases 1-3)

### Feature-Specific Docs
- **`docs/fc-collection-system.md`** - Farcaster collection loading
- **`docs/seaport-contract-cheatsheet.md`** - Seaport contract reference
- **`docs/nft-trading-implementation.md`** - Trading UX implementation
- **`docs/nft-metadata-fetching-improvement-plan.md`** - NFT discovery improvements

## 🔄 Recent Changes & Migration Notes

### November 2024 Updates
1. **Next.js 15.0.3** - Upgraded from Next.js 14
2. **Seaport Offers** - Implemented offer creation and fulfillment
3. **Notifications System** - In-app notifications for trades
4. **Homepage Revamp** - New hero section, featured collections, latest trades
5. **Smart Profile Prioritization** - Engagement-based collection ordering

### Completed Optimization Phases
- ✅ **Phase 1**: Redis configuration unified, hierarchical caching
- ✅ **Phase 2**: Normalized ownership tables, automatic triggers
- ✅ **Phase 3**: Event-driven cache invalidation, analytics, performance testing

### Database Schema Version
Current migration: `0009_create_collection_engagement.sql`

## 🛠️ Development Tools & Scripts

### Package Scripts
```json
{
  "dev": "Development server with hot reload",
  "build": "Production build",
  "start": "Start production server",
  "db:migrate": "Run database migrations",
  "db:seed": "Seed database with test data",
  "cleanup": "Kill dev server on port 3001",
  "inspect-redis": "Redis inspection utility",
  "add-collection": "Add collection to Redis"
}
```

### Admin Endpoints for Development
- `/api/admin/cache/metrics` - Cache performance dashboard
- `/api/admin/cache/clear` - Clear Redis cache
- `/api/admin/ownership/stats` - Ownership system stats
- `/api/admin/collection-health` - Collection health scores
- `/api/admin/errors` - Error tracking

## 🎯 Future Roadmap

### Short-term (Next Sprint)
- [ ] Complete NFT listings implementation
- [ ] Enhance Farcaster Frame integration
- [ ] Add more collection discovery features

### Medium-term (Next Month)
- [ ] NFT-for-NFT trades
- [ ] Bundle trading
- [ ] Auction system
- [ ] Artist coins integration

### Long-term (Next Quarter)
- [ ] Advanced creator tools
- [ ] Hypersubs integration
- [ ] Deploy new collections feature
- [ ] Advanced analytics

## 💡 Tips for AI Assistants

### When Adding New Features
1. **Check cache strategy** - Determine appropriate TTL (hot/warm/cold)
2. **Use existing patterns** - Follow established API and DB patterns
3. **Update documentation** - Keep docs in sync with implementation
4. **Add monitoring** - Integrate with analytics and error tracking
5. **Test performance** - Use admin endpoints to verify cache behavior

### When Debugging
1. **Check browser console** - Frontend errors and API responses
2. **Check server logs** - Next.js dev server output
3. **Check Redis cache** - Use `/api/admin/cache/metrics`
4. **Check database** - Use Supabase Studio or direct SQL queries
5. **Check environment vars** - Verify all required vars are set

### When Reviewing Code
1. **Address normalization** - Always lowercase
2. **Cache invalidation** - Use event system
3. **Error handling** - Proper try-catch with user-friendly messages
4. **Type safety** - Leverage TypeScript strictly
5. **Performance** - Consider cache implications

## 📞 Getting Help

### Documentation Hierarchy
1. This file (CLAUDE.md) - Overview and critical knowledge
2. README.md - User-facing documentation
3. docs/*.md - Feature-specific deep dives
4. Code comments - Implementation details

### Key Contact Points
- Main README: Project overview and getting started
- API Cheatsheet: Complete API reference
- Database Docs: Schema and optimization details
- Testing Guide: Testing strategies and commands

---

**Last Updated**: November 2024
**Document Version**: 1.0
**Maintained By**: Development Team

---

## Quick Reference Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Build for production
pnpm db:migrate             # Run migrations
pnpm db:seed                # Seed database

# Monitoring
curl localhost:3000/api/admin/cache/metrics          # Cache metrics
curl localhost:3000/api/admin/ownership/stats        # Ownership stats
curl localhost:3000/api/admin/collection-health      # Collection health

# Testing
curl -X POST localhost:3000/api/admin/cache/test/performance -d '{"action":"run"}'
```

---

This document should be updated whenever:
- Major architectural changes are made
- New systems are added (new tables, new APIs, etc.)
- Development patterns change
- Performance targets are updated
- Critical bugs or gotchas are discovered

Keep this document as the single source of truth for AI assistants working on Such.Market.
