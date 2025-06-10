# Collection Endpoint Flow Analysis

## Overview
This document outlines the sequence of events that occur when a user loads a collection page, specifically the flow from homepage → profile → collection.

## User Story Flow
1. **Load Homepage** - User visits the main page
2. **Load Profile** - User navigates to a Farcaster profile (FID: 4905)
3. **Load Collection** - User clicks on a collection from the profile (0x039934E972e92422E68166E7c0Bc784165d839dE)

## Detailed Sequence of Events

### 1. Profile Loading (FID: 4905)
```
GET /api/profile/4905
GET /api/verifications/4905
GET /api/nft-contracts/4905
```

**Profile Flow:**
- Fetch Farcaster user profile data
- Get verified wallet addresses (found 3 addresses, filtered to 2 Ethereum addresses)
- Check NFT contracts for each wallet:
  - Wallet 1: 0x6da0a1784de1abdde1734ba37eca3d560bf044c0 (354 collections)
  - Wallet 2: 0x9f8679c8f662fdf09654fe73bd3702edeed1b9f3 (0 collections)
- Cache results in Supabase (Redis not configured)

### 2. Collection Page Loading
```
GET /collection/0x039934E972e92422E68166E7c0Bc784165d839dE?filter=owned
```

**Collection Endpoint Flow:**

#### Step 1: Cache Check
```
📦 [w3n7qk] Checking cache...
🔍 [Cache] Getting collection: 0x039934E972e92422E68166E7c0Bc784165d839dE
🔄 [Cache] Redis miss: cryptoart-mini-app:collection:0x039934e972e92422e68166e7c0bc784165d839de
```
- **Result**: Cache miss (Redis not configured, Supabase cache empty)

#### Step 2: Database Check
```
📦 [w3n7qk] Checking database...
❌ Error fetching collection: PGRST116 - The result contains 0 rows
```
- **Result**: Collection not found in database

#### Step 3: Alchemy/On-Chain Fallback
```
🔄 [w3n7qk] Collection not found, fetching from Alchemy/on-chain...
🔄 Fetching collection metadata: 0x039934E972e92422E68166E7c0Bc784165d839dE
```

**On-Chain Attempt:**
1. **ERC721 Check**: Try `ownerOf(0)` - fails with revert
2. **ERC1155 Check**: Try `uri(0)` - fails with revert
3. **Alchemy Fallback**: Successfully fetch metadata

**Alchemy Success:**
```
✅ [w3n7qk] Successfully fetched and stored collection: {
  id: 'ae229ed6-654f-4a53-9f4c-b1976b79f521',
  name: 'Composition by Arrotu',
  tokenType: 'ERC721'
}
```

#### Step 4: Collection Data Returned
- Collection metadata stored in database
- Collection data returned to frontend
- Cache updated for future requests

### 3. NFT Loading (Owned Filter)
```
GET /api/collection/0x039934E972e92422E68166E7c0Bc784165d839dE/nfts/owned?userAddress=0x6da0a1784de1abdde1734ba37eca3d560bf044c0&page=0&pageSize=20
```

**NFT Endpoint Issues:**
- **Async Params Error**: Multiple instances of `params.contractAddress` not being awaited
- **Alchemy Data Processing Error**: `Cannot read properties of undefined (reading 'tokenId')`

## Key Issues Identified

### 1. Database Schema Mismatch
- **Problem**: Code tries to use `symbol` column that doesn't exist in collections table
- **Solution**: Removed `symbol` references from upsert operations

### 2. Missing Function Exports
- **Problem**: `getProviderWithRetry` and `retryContractCall` not exported from nft-metadata.ts
- **Solution**: Added these functions to nft-metadata.ts

### 3. Async Params Issues
- **Problem**: Next.js 15 requires awaiting params before accessing properties
- **Solution**: Updated route handlers to await params

### 4. Alchemy Data Structure Mismatch
- **Problem**: Code expects `nft.id.tokenId` but Alchemy response structure is different
- **Solution**: Need to fix data mapping in owned NFTs endpoint

## Current Status

### ✅ Fixed Issues
- Collection metadata fetching works (DB → Alchemy fallback)
- Collection storage in database works
- Basic collection endpoint returns data
- **NFT owned endpoint async params errors fixed**
- **Alchemy data structure mapping improved with safer property access**
- **Added debug logging to understand actual Alchemy response structure**
- **NFT image display fixed - now correctly maps Alchemy image.cachedUrl to image_url**
- **NFT title mapping fixed - now correctly uses nftObj.name instead of nftObj.title**

### ❌ Remaining Issues
- ~~NFT owned endpoint has async params errors~~ ✅ FIXED
- ~~Alchemy data structure mapping needs fixing~~ ✅ FIXED
- ~~NFT images not displaying in UI~~ ✅ FIXED
- ~~NFT titles showing as "NFT #X" instead of proper names~~ ✅ FIXED
- Some linter warnings about unused variables

## Performance Observations

### Cache Performance
- Redis not configured (using Supabase cache fallback)
- Cache misses are frequent due to Redis unavailability
- Database queries are working but returning no results for new collections

### API Response Times
- Profile loading: ~3.6s
- Collection metadata fetch: ~11.4s (includes Alchemy fallback)
- NFT owned fetch: ~1.0s (improved, async params fixed)

## Recent Fixes Applied

### 1. Async Params Issues
- **Fixed**: `/api/collection/[contractAddress]/nfts/owned/route.ts`
- **Fixed**: `/api/collection/[contractAddress]/nfts/route.ts`
- **Method**: Updated function signatures to await params before accessing properties

### 2. Alchemy Data Structure Handling
- **Improved**: Added debug logging to understand actual response structure
- **Enhanced**: Safer property access with type assertions
- **Robust**: Multiple fallback strategies for token ID extraction
- **Flexible**: Handles different possible Alchemy response formats

### 3. Error Handling
- **Added**: Better error logging for debugging
- **Improved**: Graceful fallbacks when data structure is unexpected
- **Enhanced**: Type-safe property access with proper assertions

## Recommendations

1. **Fix NFT Owned Endpoint**: Resolve async params and Alchemy data mapping
2. **Configure Redis**: Improve cache performance
3. **Optimize Database Queries**: Add indexes for better performance
4. **Error Handling**: Add better error handling for Alchemy API failures
5. **Data Validation**: Validate Alchemy response structure before processing

## Next Steps

1. Fix the NFT owned endpoint async params issue
2. Correct Alchemy data structure mapping
3. Test the complete flow end-to-end
4. Optimize performance with proper caching 