# API Endpoints Cheatsheet

## Overview

This cheatsheet provides a comprehensive guide to all API endpoints in the cryptoart-mini-app, organized by use case and functionality. Use this for testing, administration, and understanding the data flow.

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   External      │    │   Redis Cache   │    │   Supabase DB   │
│   APIs          │    │   (L1/L2/L3)    │    │   (Normalized)  │
│                 │    │                 │    │                 │
│ • Alchemy       │◄──►│ • Hot Data      │◄──►│ • nft_ownership │
│ • Neynar        │    │ • Warm Data     │    │ • user_collections│
│ • On-chain      │    │ • Cold Data     │    │ • wallet_mapping│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Monitoring & Administration

### Ownership Statistics
**Endpoint**: `GET /api/admin/ownership/stats`  
**Purpose**: Monitor the health of the normalized ownership system  
**When to use**: Daily monitoring, after migrations, troubleshooting  

```bash
# Basic stats
curl "https://your-domain.com/api/admin/ownership/stats"

# Sync existing data and get stats
curl "https://your-domain.com/api/admin/ownership/stats?sync=true"

# Manual sync via POST
curl -X POST "https://your-domain.com/api/admin/ownership/stats" \
  -H "Content-Type: application/json" \
  -d '{"action": "sync"}'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "totalOwnershipRecords": 15000,    // nft_ownership table
    "totalUserCollections": 5000,      // user_collections table
    "totalWalletMappings": 3000,       // wallet_collection_mapping table
    "uniqueOwners": 2000,              // Unique wallet addresses
    "uniqueCollections": 100           // Unique NFT collections
  }
}
```

**Use Cases**:
- ✅ **Daily health check**: Monitor system growth
- ✅ **Post-migration verification**: Confirm data was migrated correctly
- ✅ **Troubleshooting**: Identify data inconsistencies
- ✅ **Performance monitoring**: Track system usage

### Cache Management
**Endpoint**: `POST /api/admin/cache/clear`  
**Purpose**: Clear Redis cache for troubleshooting  
**When to use**: Cache issues, testing cache behavior  

```bash
curl -X POST "https://your-domain.com/api/admin/cache/clear" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "such-market:*"}'
```

### Cache Metrics & Analytics (Phase 3) ✅ NEW
**Endpoint**: `GET /api/admin/cache/metrics`  
**Purpose**: Get real-time cache performance metrics and health status  
**When to use**: Monitoring cache performance, troubleshooting, performance analysis  

```bash
# Get comprehensive cache metrics
curl "https://your-domain.com/api/admin/cache/metrics"

# Reset analytics data
curl -X POST "https://your-domain.com/api/admin/cache/metrics" \
  -H "Content-Type: application/json" \
  -d '{"action": "reset"}'

# Save analytics to persistent storage
curl -X POST "https://your-domain.com/api/admin/cache/metrics" \
  -H "Content-Type: application/json" \
  -d '{"action": "save"}'
```

**Expected Response**:
```json
{
  "success": true,
  "timestamp": 1703123456789,
  "analytics": {
    "overview": {
      "hitRate": 0.95,
      "missRate": 0.05,
      "avgResponseTime": 45,
      "totalRequests": 15000,
      "cacheSize": 2500,
      "lastUpdated": 1703123456789
    },
    "breakdown": {
      "byEndpoint": {
        "/api/collection": {
          "endpoint": "/api/collection",
          "requests": 5000,
          "hits": 4750,
          "misses": 250,
          "avgResponseTime": 35,
          "lastUsed": 1703123456789
        }
      },
      "byCacheType": {
        "collection_metadata": {
          "cacheType": "collection_metadata",
          "keys": 100,
          "memoryUsage": 1024000,
          "hitRate": 0.98,
          "lastAccessed": 1703123456789
        }
      }
    },
    "alerts": [
      {
        "id": "alert_123",
        "type": "low_hit_rate",
        "message": "Cache hit rate is low: 75.0%",
        "severity": "medium",
        "timestamp": 1703123456789,
        "resolved": false
      }
    ],
    "eventQueue": {
      "queueLength": 0,
      "isProcessing": false,
      "eventsProcessed": 150
    }
  },
  "health": {
    "status": "healthy",
    "issues": [],
    "recommendations": []
  },
  "summary": {
    "status": "healthy",
    "hitRate": "95.0%",
    "avgResponseTime": "45ms",
    "totalRequests": 15000,
    "cacheSize": 2500,
    "activeAlerts": 0
  }
}
```

**Use Cases**:
- ✅ **Real-time monitoring**: Track cache performance live
- ✅ **Performance analysis**: Analyze cache hit rates and response times
- ✅ **Troubleshooting**: Identify cache issues and bottlenecks
- ✅ **Capacity planning**: Monitor cache size and growth
- ✅ **Alert management**: Track and resolve performance alerts

### Cache Performance Testing (Phase 3) ✅ NEW
**Endpoint**: `GET /api/admin/cache/test/performance`  
**Purpose**: Get cache performance test results  
**When to use**: After running performance tests, reviewing system performance  

```bash
# Get performance test results
curl "https://your-domain.com/api/admin/cache/test/performance"
```

**Endpoint**: `POST /api/admin/cache/test/performance`  
**Purpose**: Run comprehensive cache performance tests  
**When to use**: Performance benchmarking, system validation, capacity testing  

```bash
# Run all performance tests
curl -X POST "https://your-domain.com/api/admin/cache/test/performance" \
  -H "Content-Type: application/json" \
  -d '{"action": "run"}'

# Reset performance test results
curl -X POST "https://your-domain.com/api/admin/cache/test/performance" \
  -H "Content-Type: application/json" \
  -d '{"action": "reset"}'
```

**Expected Response** (POST with "run" action):
```json
{
  "success": true,
  "message": "Performance tests completed successfully",
  "timestamp": 1703123456789,
  "results": {
    "cacheHealth": {
      "isConfigured": true,
      "connectionTime": 15,
      "pingTime": 5
    },
    "basicTests": [
      {
        "testName": "Basic Cache Operations",
        "duration": 2500,
        "operations": 100,
        "avgResponseTime": 25,
        "minResponseTime": 10,
        "maxResponseTime": 150,
        "successRate": 100,
        "errors": [],
        "timestamp": 1703123456789
      }
    ],
    "loadTests": [
      {
        "concurrentUsers": 10,
        "requestsPerSecond": 500,
        "avgResponseTime": 45,
        "p95ResponseTime": 120,
        "p99ResponseTime": 200,
        "errorRate": 0,
        "cacheHitRate": 95,
        "timestamp": 1703123456789
      }
    ],
    "stressTests": [
      {
        "maxConcurrentUsers": 50,
        "maxRequestsPerSecond": 2500,
        "breakingPoint": 100,
        "recoveryTime": 2000,
        "errors": [],
        "timestamp": 1703123456789
      }
    ],
    "recommendations": [
      "Cache performance is excellent",
      "Consider increasing concurrent user capacity",
      "Monitor cache size growth"
    ]
  }
}
```

**Test Categories**:
- ✅ **Health checks**: Redis connection and ping tests
- ✅ **Basic operations**: 100 cache get/set operations
- ✅ **Concurrent access**: Multiple users accessing cache simultaneously
- ✅ **Stress testing**: Find system breaking points
- ✅ **Recovery testing**: System recovery after stress

**Use Cases**:
- ✅ **Performance benchmarking**: Establish baseline performance
- ✅ **Capacity planning**: Determine system limits
- ✅ **Load testing**: Test under various load conditions
- ✅ **System validation**: Verify cache performance meets requirements
- ✅ **Troubleshooting**: Identify performance bottlenecks

## 🎯 User NFT Discovery

### Normalized NFT Contracts (Recommended)
**Endpoint**: `GET /api/nft-contracts/[fid]/normalized`  
**Purpose**: Get NFT contracts for a Farcaster user using the new normalized system  
**When to use**: Primary endpoint for user NFT discovery, testing normalized system  

```bash
curl "https://your-domain.com/api/nft-contracts/123/normalized"
```

**Data Flow**:
1. Get Farcaster user profile
2. Extract verified wallet addresses
3. Check normalized database → Redis cache → Alchemy API
4. Cache results in Redis (not Supabase)

**Expected Response**:
```json
{
  "user": {
    "fid": 123,
    "username": "user",
    "display_name": "User Name"
  },
  "wallets": [{
    "walletAddress": "0x1234...",
    "status": "found",
    "message": "Found 15 NFT collection(s) from normalized_db",
    "contracts": [...],
    "totalCollectionsFound": 15
  }],
  "system": "normalized"
}
```

**Cache Sources** (in order of preference):
- `normalized_db` - New normalized tables
- `redis` - Redis cache
- `alchemy` - Fresh API call

### Legacy NFT Contracts (Deprecated)
**Endpoint**: `GET /api/nft-contracts/[fid]`  
**Purpose**: Original endpoint using user_nft_cache table  
**When to use**: Only for backward compatibility during transition  

```bash
curl "https://your-domain.com/api/nft-contracts/123"
```

## 🖼️ Collection Management

### Collection Metadata
**Endpoint**: `GET /api/collection/[contractAddress]`  
**Purpose**: Get collection metadata and basic info  
**When to use**: Collection discovery, metadata lookup  

```bash
curl "https://your-domain.com/api/collection/0x1234..."
```

### Collection NFTs (Paginated)
**Endpoint**: `GET /api/collection/[contractAddress]/nfts`  
**Purpose**: Get paginated NFTs for a collection  
**When to use**: Browsing collections, displaying NFT lists  

```bash
curl "https://your-domain.com/api/collection/0x1234.../nfts?page=0&pageSize=20"
```

### Collection Refresh (Data Ingestion)
**Endpoint**: `POST /api/collection/[contractAddress]/refresh`  
**Purpose**: Fetch fresh collection data from Alchemy and store in database  
**When to use**: Initial data population, data updates, testing  

```bash
curl -X POST "https://your-domain.com/api/collection/0x1234.../refresh"
```

**What it does**:
- Fetches collection metadata from Alchemy
- Stores/updates in `collections` table
- Fetches NFT data and stores in `nfts` table
- Updates `nft_ownership` table with ownership info
- Invalidates related caches

### Collection Traits
**Endpoint**: `GET /api/collection/[contractAddress]/traits`  
**Purpose**: Get trait aggregations for filtering  
**When to use**: Building filters, trait analysis  

```bash
curl "https://your-domain.com/api/collection/0x1234.../traits"
```

## 👥 Farcaster-Specific Endpoints

### FC Collection System
**Endpoint**: `GET /api/collection/fc`  
**Purpose**: Get NFTs owned by Farcaster users for a specific collection  
**When to use**: Farcaster-focused applications, community analysis  

```bash
curl "https://your-domain.com/api/collection/fc?contractAddress=0x1234...&page=0&pageSize=20"
```

### FC Collection Fetch (Background)
**Endpoint**: `POST /api/collection/fc/fetch`  
**Purpose**: Trigger background fetch of Farcaster user NFTs  
**When to use**: Initial data population for FC collections  

```bash
curl -X POST "https://your-domain.com/api/collection/fc/fetch" \
  -H "Content-Type: application/json" \
  -d '{"contractAddress": "0x1234..."}'
```

### FC Collection Owners
**Endpoint**: `GET /api/collection/fc/owners`  
**Purpose**: Get all owners of a collection (via Alchemy)  
**When to use**: Owner analysis, community insights  

```bash
curl "https://your-domain.com/api/collection/fc/owners?contractAddress=0x1234..."
```

### FC Collection Users
**Endpoint**: `POST /api/collection/fc/users`  
**Purpose**: Get Farcaster user data for wallet addresses  
**When to use**: User identification, community mapping  

```bash
curl -X POST "https://your-domain.com/api/collection/fc/users" \
  -H "Content-Type: application/json" \
  -d '{"addresses": ["0x1234...", "0x5678..."]}'
```

### FC Collection NFTs
**Endpoint**: `POST /api/collection/fc/nfts`  
**Purpose**: Get NFTs for specific Farcaster users  
**When to use**: Detailed user NFT analysis  

```bash
curl -X POST "https://your-domain.com/api/collection/fc/nfts" \
  -H "Content-Type: application/json" \
  -d '{"contractAddress": "0x1234...", "collectionId": "uuid", "fcUsers": [...]}'
```

## 🔍 NFT Ownership

### NFT Owner Lookup
**Endpoint**: `GET /api/collection/[contractAddress]/nfts/[tokenId]/owner`  
**Purpose**: Get current owner of a specific NFT  
**When to use**: Ownership verification, transfer tracking  

```bash
curl "https://your-domain.com/api/collection/0x1234.../nfts/123/owner"
```

**Expected Response**:
```json
{
  "contractAddress": "0x1234...",
  "tokenId": "123",
  "owner": "0x5678...",
  "cached": true
}
```

### Owned NFTs by User
**Endpoint**: `GET /api/collection/[contractAddress]/nfts/owned`  
**Purpose**: Get NFTs owned by a specific wallet address  
**When to use**: User portfolio analysis, ownership verification  

```bash
curl "https://your-domain.com/api/collection/0x1234.../nfts/owned?userAddress=0x5678...&page=0&pageSize=20"
```

## 🧪 Testing Scenarios

### Scenario 1: Empty Database Testing
```bash
# 1. Check initial state
curl "https://your-domain.com/api/admin/ownership/stats"

# 2. Test normalized endpoint (should fetch from Alchemy)
curl "https://your-domain.com/api/nft-contracts/123/normalized"

# 3. Populate some data
curl -X POST "https://your-domain.com/api/collection/0x1234.../refresh"

# 4. Check normalized system
curl "https://your-domain.com/api/admin/ownership/stats?sync=true"
```

### Scenario 2: Performance Testing
```bash
# 1. Clear cache
curl -X POST "https://your-domain.com/api/admin/cache/clear"

# 2. Test cold start (should be slower)
curl "https://your-domain.com/api/nft-contracts/123/normalized"

# 3. Test warm cache (should be faster)
curl "https://your-domain.com/api/nft-contracts/123/normalized"
```

### Scenario 3: Data Migration Testing
```bash
# 1. Check legacy system
curl "https://your-domain.com/api/nft-contracts/123"

# 2. Check normalized system
curl "https://your-domain.com/api/nft-contracts/123/normalized"

# 3. Compare responses and performance
```

### Scenario 4: Farcaster Community Analysis
```bash
# 1. Get collection owners
curl "https://your-domain.com/api/collection/fc/owners?contractAddress=0x1234..."

# 2. Get FC user data
curl -X POST "https://your-domain.com/api/collection/fc/users" \
  -d '{"addresses": ["0x1234..."]}'

# 3. Get FC NFTs
curl -X POST "https://your-domain.com/api/collection/fc/nfts" \
  -d '{"contractAddress": "0x1234...", "fcUsers": [...]}'
```

### Scenario 5: Cache Performance Testing (Phase 3) ✅ NEW
```bash
# 1. Get current cache metrics
curl "https://your-domain.com/api/admin/cache/metrics"

# 2. Run performance tests
curl -X POST "https://your-domain.com/api/admin/cache/test/performance" \
  -H "Content-Type: application/json" \
  -d '{"action": "run"}'

# 3. Check test results
curl "https://your-domain.com/api/admin/cache/test/performance"

# 4. Monitor cache health
curl "https://your-domain.com/api/admin/cache/metrics"
```

### Scenario 6: Event-Driven Cache Testing (Phase 3) ✅ NEW
```bash
# 1. Check cache before refresh
curl "https://your-domain.com/api/admin/cache/metrics"

# 2. Refresh a collection (triggers cache events)
curl -X POST "https://your-domain.com/api/collection/0x1234.../refresh"

# 3. Check cache after refresh (should show invalidation)
curl "https://your-domain.com/api/admin/cache/metrics"

# 4. Verify event queue status
curl "https://your-domain.com/api/admin/cache/metrics" | jq '.analytics.eventQueue'
```

## 🚨 Troubleshooting Guide

### Common Issues & Solutions

#### Issue: Empty normalized tables
**Symptoms**: All counts are 0 in ownership stats  
**Solution**: 
```bash
# Run migration sync
curl "https://your-domain.com/api/admin/ownership/stats?sync=true"

# Or populate fresh data
curl -X POST "https://your-domain.com/api/collection/0x1234.../refresh"
```

#### Issue: Slow responses
**Symptoms**: API calls taking >5 seconds  
**Solution**:
```bash
# Check cache status
curl "https://your-domain.com/api/admin/ownership/stats"

# Clear cache if needed
curl -X POST "https://your-domain.com/api/admin/cache/clear"
```

#### Issue: Cache misses
**Symptoms**: Always seeing "from alchemy" in responses  
**Solution**:
```bash
# Verify Redis configuration
# Check environment variables: KV_REST_API_URL, KV_REST_API_TOKEN
```

#### Issue: Data inconsistencies
**Symptoms**: Different counts between endpoints  
**Solution**:
```bash
# Force sync
curl -X POST "https://your-domain.com/api/admin/ownership/stats" \
  -d '{"action": "sync"}'

# Check database directly
SELECT COUNT(*) FROM nft_ownership;
SELECT COUNT(*) FROM wallet_collection_mapping;
```

#### Issue: Low cache hit rate (Phase 3) ✅ NEW
**Symptoms**: Cache hit rate < 80% in metrics  
**Solution**:
```bash
# Check cache metrics
curl "https://your-domain.com/api/admin/cache/metrics"

# Run performance tests to identify bottlenecks
curl -X POST "https://your-domain.com/api/admin/cache/test/performance" \
  -H "Content-Type: application/json" \
  -d '{"action": "run"}'

# Check for cache invalidation events
curl "https://your-domain.com/api/admin/cache/metrics" | jq '.analytics.eventQueue'
```

#### Issue: High response times (Phase 3) ✅ NEW
**Symptoms**: Average response time > 100ms  
**Solution**:
```bash
# Check cache health
curl "https://your-domain.com/api/admin/cache/metrics" | jq '.health'

# Run performance tests
curl -X POST "https://your-domain.com/api/admin/cache/test/performance" \
  -H "Content-Type: application/json" \
  -d '{"action": "run"}'

# Check Redis connection
curl "https://your-domain.com/api/admin/cache/test/performance" | jq '.results.cacheHealth'
```

#### Issue: Cache events not processing (Phase 3) ✅ NEW
**Symptoms**: Event queue stuck or not processing  
**Solution**:
```bash
# Check event queue status
curl "https://your-domain.com/api/admin/cache/metrics" | jq '.analytics.eventQueue'

# Trigger a cache event manually
curl -X POST "https://your-domain.com/api/collection/0x1234.../refresh"

# Check if events are being processed
curl "https://your-domain.com/api/admin/cache/metrics" | jq '.analytics.eventQueue'
```

## 📈 Performance Benchmarks

### Expected Response Times
- **Redis cache hit**: <100ms
- **Normalized database**: <200ms  
- **Alchemy API fallback**: 1-3 seconds
- **Collection refresh**: 5-15 seconds

### Cache Hit Rate Targets
- **Hot data (L1)**: 90%+ hit rate
- **Warm data (L2)**: 80%+ hit rate
- **Cold data (L3)**: 70%+ hit rate

### Phase 3 Performance Targets ✅ NEW
- **Overall cache hit rate**: 95%+ (with event-driven invalidation)
- **Average response time**: <100ms for cached data
- **Concurrent users**: 50+ users without performance degradation
- **Cache event processing**: <50ms per event
- **Performance test success rate**: 100% for basic operations
- **Stress test breaking point**: 100+ concurrent users

## 🔄 Data Flow Summary

```
User Request → Check Normalized DB → Check Redis Cache → Fetch from Alchemy → Cache Results
     ↓              ↓                    ↓                    ↓                ↓
  Return Data   Return Data         Return Data         Return Data     Store in Redis
```

## 📝 Quick Reference

| Use Case | Primary Endpoint | Fallback Endpoint |
|----------|------------------|-------------------|
| User NFT Discovery | `/api/nft-contracts/[fid]/normalized` | `/api/nft-contracts/[fid]` |
| Collection Browsing | `/api/collection/[addr]/nfts` | `/api/collection/[addr]` |
| Data Population | `/api/collection/[addr]/refresh` | `/api/collection/fc/fetch` |
| FC Community | `/api/collection/fc` | `/api/collection/fc/owners` |
| Ownership Lookup | `/api/collection/[addr]/nfts/[id]/owner` | On-chain call |
| System Monitoring | `/api/admin/ownership/stats` | Database queries |
| Cache Monitoring | `/api/admin/cache/metrics` | Redis CLI |
| Performance Testing | `/api/admin/cache/test/performance` | Manual testing |

This cheatsheet should help you navigate the API endpoints efficiently for testing, administration, and development purposes. 