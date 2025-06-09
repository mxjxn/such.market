# Farcaster Collection System

This document describes the new Farcaster-focused collection loading system that focuses on NFTs owned by Farcaster users.

## Overview

The FC collection system provides a more targeted approach to loading NFTs by:
1. Only loading NFTs owned by Farcaster users
2. Caching data for 24 hours to reduce API calls
3. Providing real-time updates when data becomes stale

## API Endpoints

### 1. Main Entry Point: `/api/collection/fc`
- **Method**: GET
- **Parameters**: 
  - `contractAddress`: The NFT contract address
  - `page`: Page number (default: 0)
  - `pageSize`: Number of items per page (default: 20)
- **Response**: Returns cached NFTs if available, or triggers background fetch

### 2. Background Fetch: `/api/collection/fc/fetch`
- **Method**: POST
- **Body**: `{ contractAddress: string }`
- **Purpose**: Coordinates the sequence of API calls to fetch fresh data

### 3. Get Owners: `/api/collection/fc/owners`
- **Method**: GET
- **Parameters**: `contractAddress`
- **Purpose**: Calls Alchemy's `getOwnersForContract` API

### 4. Get Farcaster Users: `/api/collection/fc/users`
- **Method**: POST
- **Body**: `{ addresses: string[] }`
- **Purpose**: Calls Neynar's bulk API to get Farcaster users

### 5. Get NFTs: `/api/collection/fc/nfts`
- **Method**: POST
- **Body**: `{ contractAddress, collectionId, fcUsers }`
- **Purpose**: Calls Alchemy's `getNFTsForOwner` API for each user

## Database Schema

### fc_users Table
```sql
CREATE TABLE fc_users (
  id UUID PRIMARY KEY,
  fid BIGINT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  pfp_url TEXT,
  custody_address TEXT NOT NULL,
  verified_addresses JSONB NOT NULL,
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  power_badge BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  profile JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Frontend Components

### FCNFTGrid
A React component that displays NFTs owned by Farcaster users with:
- Pagination support
- Real-time polling for fresh data
- Loading states
- Error handling

## Usage

### In Collection Page
The collection page now includes a toggle between "All NFTs" and "Farcaster Users" views:

```tsx
const [viewMode, setViewMode] = useState<'all' | 'fc'>('all');

// In the render:
{viewMode === 'all' ? (
  <NFTGrid contractAddress={contractAddress} />
) : (
  <FCNFTGrid contractAddress={contractAddress} />
)}
```

## API Flow

1. **Initial Request**: User visits collection page with FC view
2. **Cache Check**: System checks for recent data (last 24 hours)
3. **Fresh Data**: If available, returns immediately
4. **Background Fetch**: If stale, triggers background process:
   - Get all owners from Alchemy
   - Get Farcaster users from Neynar
   - Get NFTs for each Farcaster user
   - Store in database
5. **Real-time Updates**: Frontend polls for fresh data

## Environment Variables

Required environment variables:
- `ALCHEMY_API_KEY`: For NFT data
- `NEYNAR_API_KEY`: For Farcaster user data

## Benefits

1. **Performance**: Only loads relevant NFTs (Farcaster users)
2. **Caching**: Reduces API calls with 24-hour cache
3. **Real-time**: Automatically refreshes stale data
4. **Scalable**: Background processing doesn't block UI
5. **User-focused**: Shows NFTs from the Farcaster community

## Error Handling

- API failures are logged and don't break the entire flow
- Individual user failures don't affect other users
- Graceful fallbacks for missing data
- Clear error messages for users

## Future Enhancements

- Add filters by Farcaster user metrics (follower count, score)
- Show user profiles alongside NFTs
- Add social features (following, likes)
- Implement more sophisticated caching strategies 