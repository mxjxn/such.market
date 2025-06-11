# Database Optimization Implementation Guide

## Overview

This document outlines the database optimization changes implemented in **Phase 2** of our optimization plan. We've replaced the inefficient `user_nft_cache` table with a normalized ownership tracking system.

## What Changed

### Before (Inefficient)
- `user_nft_cache` table with JSONB `contracts` field
- Redundant data storage
- No indexing on JSONB content
- Complex queries and updates

### After (Optimized)
- `nft_ownership` - Individual NFT ownership tracking
- `user_collections` - User collection summaries (auto-maintained)
- `wallet_collection_mapping` - Wallet-to-collection relationships
- Normalized data structure with proper indexing
- Automatic triggers for data consistency

## New Database Schema

### 1. nft_ownership Table
```sql
CREATE TABLE nft_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, token_id, owner_address)
);
```

**Purpose**: Tracks individual NFT ownership with verification timestamps.

### 2. user_collections Table
```sql
CREATE TABLE user_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  token_count INTEGER DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_address, collection_id)
);
```

**Purpose**: Auto-maintained summary of user's NFT holdings per collection.

### 3. wallet_collection_mapping Table
```sql
CREATE TABLE wallet_collection_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  collection_address TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  last_owned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wallet_address, collection_address)
);
```

**Purpose**: Maps wallets to collections they own (replaces `user_nft_cache.contracts`).

## Automatic Triggers

The system includes two PostgreSQL triggers that automatically maintain data consistency:

1. **update_user_collection_count()** - Updates `user_collections` when `nft_ownership` changes
2. **update_wallet_collection_mapping()** - Updates `wallet_collection_mapping` when `nft_ownership` changes

These triggers handle:
- Ownership transfers
- New NFT acquisitions
- NFT disposals
- Automatic cleanup of zero-count records

## Migration Steps

### Step 1: Create New Tables
Run migration `0003_create_normalized_ownership_tables.sql`:
```bash
# In Supabase SQL editor or via migration tool
\i db/migrations/0003_create_normalized_ownership_tables.sql
```

### Step 2: Migrate Existing Data
Run migration `0004_migrate_existing_ownership_data.sql`:
```bash
# This will populate the new tables with existing data
\i db/migrations/0004_migrate_existing_ownership_data.sql
```

### Step 3: Test the New System
Use the new API endpoints to verify functionality:

1. **Test ownership stats**:
   ```bash
   curl "https://your-domain.com/api/admin/ownership/stats?sync=true"
   ```

2. **Test normalized NFT contracts**:
   ```bash
   curl "https://your-domain.com/api/nft-contracts/123/normalized"
   ```

### Step 4: Remove Old Table (Optional)
After confirming everything works, run migration `0005_remove_user_nft_cache.sql`:
```bash
# WARNING: Only run after thorough testing
\i db/migrations/0005_remove_user_nft_cache.sql
```

## New API Endpoints

### 1. Ownership Statistics
- **GET** `/api/admin/ownership/stats`
- **POST** `/api/admin/ownership/stats` (with `{"action": "sync"}`)
- **Purpose**: Monitor ownership data and trigger syncs

### 2. Normalized NFT Contracts
- **GET** `/api/nft-contracts/[fid]/normalized`
- **Purpose**: Get NFT contracts using the new normalized system

## Database Utilities

### Ownership Management (`src/lib/db/ownership.ts`)

```typescript
// Get NFT ownership
const ownership = await getNFTOwnership(collectionId, tokenId);

// Set NFT ownership
await setNFTOwnership(collectionId, tokenId, ownerAddress);

// Get user's NFTs in a collection
const userNFTs = await getUserCollectionNFTs(userAddress, collectionId);

// Get wallet collections
const collections = await getWalletCollections(walletAddress);

// Sync ownership from existing data
await syncNFTsOwnership();

// Get ownership statistics
const stats = await getOwnershipStats();
```

## Performance Benefits

### Query Performance
- **Before**: JSONB queries with no indexing
- **After**: Direct table lookups with proper indexes

### Storage Efficiency
- **Before**: Redundant JSONB data storage
- **After**: Normalized data with referential integrity

### Data Consistency
- **Before**: Manual cache invalidation
- **After**: Automatic trigger-based updates

### Scalability
- **Before**: JSONB size limits and performance degradation
- **After**: Linear scaling with proper indexing

## Monitoring and Maintenance

### Ownership Statistics
Monitor the health of the ownership system:
```bash
curl "https://your-domain.com/api/admin/ownership/stats"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "totalOwnershipRecords": 15000,
    "totalUserCollections": 5000,
    "totalWalletMappings": 3000,
    "uniqueOwners": 2000,
    "uniqueCollections": 100
  }
}
```

### Cleanup Operations
The system includes automatic cleanup functions:
```typescript
// Clean up old ownership records (older than 30 days)
await cleanupOldOwnershipRecords(30);
```

## Rollback Plan

If issues arise, you can rollback by:

1. **Keep the old table**: Don't run migration `0005_remove_user_nft_cache.sql`
2. **Revert API endpoints**: Use the original `/api/nft-contracts/[fid]/route.ts`
3. **Restore old caching**: The original system will continue to work

## Testing Checklist

Before removing the old `user_nft_cache` table:

- [ ] New normalized tables have data
- [ ] API endpoints return correct results
- [ ] Ownership statistics are accurate
- [ ] Performance is improved
- [ ] No data loss during migration
- [ ] Triggers are working correctly

## Next Steps

After successful implementation:

1. **Monitor performance** for 1-2 weeks
2. **Remove old table** if everything is stable
3. **Update documentation** to reflect new system
4. **Consider Phase 3** optimizations (advanced caching, analytics)

## Support

If you encounter issues:

1. Check the migration logs in Supabase
2. Verify trigger functions are working
3. Test with the admin API endpoints
4. Review the ownership statistics for anomalies

The new normalized system provides better performance, data consistency, and scalability while maintaining backward compatibility during the transition period. 