# Testing Guide for Such.Market

This guide covers testing strategies, tools, and best practices for the Such.Market application.

## Overview

Such.Market is a complex application with multiple layers:
- Frontend (Next.js React components)
- API Routes (Next.js serverless functions)
- Database (Supabase PostgreSQL)
- Caching (Upstash Redis)
- Blockchain integration (Alchemy, Seaport)

Each layer requires different testing approaches.

## Testing Types

### 1. Unit Tests

Test individual functions and components in isolation.

**Frontend Components:**
```bash
# Example: Test a React component
npm test -- src/components/homepage/Hero.test.tsx
```

**Utility Functions:**
```bash
# Example: Test engagement score calculation
npm test -- src/lib/db/engagement.test.ts
```

**Key Areas to Test:**
- Engagement score calculations
- Cache key generation
- Address validation
- Data transformation utilities

### 2. Integration Tests

Test API endpoints and database interactions.

**API Endpoints:**
```bash
# Test featured collections endpoint
curl http://localhost:3000/api/collections/featured

# Test notifications endpoint (requires auth)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/notifications
```

**Database Queries:**
- Test collection engagement tracking
- Test notification creation
- Test order storage and retrieval

### 3. End-to-End Tests

Test complete user flows.

**Example Flows:**
1. User visits homepage → sees featured collections
2. User creates offer → notification sent to owner
3. User views collection → engagement tracked
4. User views profile → sees prioritized collections

### 4. Performance Tests

Test caching and response times.

**Cache Performance:**
```bash
# Check cache metrics
curl http://localhost:3000/api/admin/cache/metrics

# Run performance tests
curl -X POST http://localhost:3000/api/admin/cache/test/performance \
  -H "Content-Type: application/json" \
  -d '{"action": "run"}'
```

## Testing Tools

### Recommended Tools

1. **Jest** - Unit and integration testing
2. **React Testing Library** - Component testing
3. **Playwright** - End-to-end testing
4. **curl/Postman** - API testing
5. **Supabase Studio** - Database inspection

### Setup

```bash
# Install testing dependencies
pnpm add -D jest @testing-library/react @testing-library/jest-dom playwright

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests
pnpm test:e2e
```

## Testing Scenarios

### Homepage Components

**Test Hero Component:**
- Renders correct CTA for authenticated users
- Renders correct CTA for unauthenticated users
- Fetches admin-configurable messages
- Handles loading states
- Handles API errors gracefully

**Test FeaturedCollections:**
- Displays featured collections
- Falls back to algorithmic collections
- Handles empty state
- Links to correct collection pages

**Test LatestTrades:**
- Displays recent trades
- Shows correct trade information
- Handles empty state
- Links to correct NFT pages

### Notifications System

**Test Notification Creation:**
1. Create an offer via `/api/seaport/offers/create`
2. Verify order stored in `seaport_orders`
3. Verify order items stored in `seaport_order_items`
4. Verify notification created for NFT owner (if they have Farcaster account)

**Test Notification Display:**
1. Fetch notifications via `/api/notifications`
2. Verify unread count via `/api/notifications/unread-count`
3. Mark notification as read via `/api/notifications/[id]/read`
4. Verify unread count decreases

**Test Notification Dropdown:**
- Opens/closes correctly
- Displays notifications
- Handles loading states
- Marks notifications as read

### Engagement Tracking

**Test View Tracking:**
1. Visit collection page
2. Verify `POST /api/collection/[contractAddress]/view` is called
3. Verify Redis counters increment
4. Verify database engagement record updates

**Test Priority Scoring:**
1. Create test user with multiple collections
2. Set different engagement scores
3. Call `/api/profile/[fid]/collections`
4. Verify collections sorted by priority score

### Seaport Integration

See [Seaport Testing Guide](./seaport-testing-guide.md) for detailed Seaport-specific testing.

**Key Areas:**
- Order creation
- Order storage
- Order fulfillment
- Notification creation

## Database Testing

### Test Data Setup

```sql
-- Create test collection
INSERT INTO collections (contract_address, name, token_type, featured)
VALUES ('0x123...', 'Test Collection', 'ERC721', true);

-- Create test user
INSERT INTO fc_users (fid, username, display_name, pfp_url, custody_address, verified_addresses)
VALUES (12345, 'testuser', 'Test User', 'https://...', '0xabc...', '["0xabc..."]'::jsonb);

-- Create test engagement record
INSERT INTO collection_engagement (collection_id, view_count_24h, engagement_score)
VALUES ('collection-uuid', 100, 100.0);
```

### Test Queries

```sql
-- Verify engagement tracking
SELECT * FROM collection_engagement WHERE collection_id = '...';

-- Verify notifications
SELECT * FROM seaport_notifications WHERE fc_user_id = 12345;

-- Verify orders
SELECT * FROM seaport_orders WHERE order_type = 'offer';
```

## Caching Tests

### Test Cache Hit/Miss

```bash
# First request (cache miss)
curl http://localhost:3000/api/collections/featured
# Should see cache miss in logs

# Second request (cache hit)
curl http://localhost:3000/api/collections/featured
# Should see cache hit in logs
```

### Test Cache Invalidation

1. Update a collection's featured status
2. Verify cache is invalidated
3. Next request should fetch fresh data

### Test Redis Counters

```bash
# Track a collection view
curl -X POST http://localhost:3000/api/collection/0x123.../view

# Check Redis counter (if you have redis-cli access)
redis-cli GET "such-market:collections:collection-id:views:24h"
```

## API Testing Checklist

### Homepage Endpoints

- [ ] `GET /api/collections/featured` - Returns featured collections
- [ ] `GET /api/seaport/trades/recent` - Returns recent trades
- [ ] `GET /api/admin/site-settings` - Returns site settings

### Notification Endpoints

- [ ] `GET /api/notifications` - Returns user notifications (auth required)
- [ ] `GET /api/notifications/unread-count` - Returns unread count (auth required)
- [ ] `POST /api/notifications/[id]/read` - Marks notification as read (auth required)

### Profile Endpoints

- [ ] `GET /api/profile/[fid]/collections` - Returns prioritized collections

### Engagement Endpoints

- [ ] `POST /api/collection/[contractAddress]/view` - Tracks collection view

### Seaport Endpoints

- [ ] `POST /api/seaport/offers/create` - Creates offer order
- [ ] `POST /api/seaport/offers/fulfill` - Fulfills offer order

## Common Issues & Solutions

### Issue: Notifications not appearing

**Check:**
1. Is the NFT owner's wallet linked to a Farcaster account?
2. Is the order being stored correctly?
3. Is the notification being created in the database?
4. Is the user authenticated when fetching notifications?

### Issue: Engagement scores not updating

**Check:**
1. Is Redis configured correctly?
2. Are view tracking API calls succeeding?
3. Is the background sync job running?
4. Are the counters expiring too quickly?

### Issue: Featured collections not showing

**Check:**
1. Are collections marked as featured in the database?
2. Are there engagement scores for algorithmic fallback?
3. Is the API endpoint returning data?
4. Are there any errors in the browser console?

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm test
      - run: pnpm test:e2e
```

## Manual Testing Checklist

Before deploying, manually test:

- [ ] Homepage loads and displays all sections
- [ ] Featured collections display correctly
- [ ] Latest trades feed shows recent trades
- [ ] Creating an offer generates a notification
- [ ] Notifications appear in dropdown
- [ ] Marking notification as read works
- [ ] Profile shows prioritized collections
- [ ] Collection views are tracked
- [ ] Admin can update site settings
- [ ] Farcaster demo still works at /example

## Performance Benchmarks

Target metrics:
- API response time: < 200ms (with cache)
- Cache hit rate: > 95%
- Database query time: < 100ms
- Page load time: < 2s

Monitor these metrics in production and adjust caching strategies as needed.

## Resources

- [Seaport Testing Guide](./seaport-testing-guide.md) - Detailed Seaport testing
- [API Endpoints Cheatsheet](./api-endpoints-cheatsheet.md) - API reference
- [Database Optimization Analysis](./database-optimization-analysis.md) - Performance tuning

