# API Endpoints Documentation

This document provides detailed information about the API endpoints available in the cryptoart mini-app.

## 1. Admin Cache Clear

**Endpoint:** `POST /api/admin/cache/clear`

**Purpose:** Clears all Redis cache entries associated with the application.

**Description:** This administrative endpoint removes all cached data from Redis that matches the application's key pattern. It's useful for clearing stale cache data and forcing fresh data retrieval.

**Functionality:**
- Retrieves all Redis keys matching the app's pattern (`${APP_NAME}:*`)
- Deletes all matching keys in a single operation
- Returns the count of deleted keys
- Includes comprehensive error handling and logging

**Response:**
```json
{
  "success": true,
  "keysDeleted": 42,
  "message": "Successfully cleared 42 keys from Redis cache"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Failed to clear Redis cache",
  "details": "Error message"
}
```

---

## 2. Preload Collections

**Endpoint:** `GET /api/preload-collections`

**Purpose:** Preloads a predefined set of NFT collections into the system for better search functionality.

**Description:** This endpoint processes a list of preloaded collections from the configuration file, adding them to the KV store if they don't already exist. It also fetches metadata from Alchemy to store alternative collection names.

**Functionality:**
- Retrieves existing collections from KV store
- Processes each preloaded collection from configuration
- Adds new collections to KV store if not already present
- Fetches metadata from Alchemy API for each collection
- Stores alternative collection names from metadata
- Handles errors gracefully for individual collections
- Returns updated collection count

**Response:**
```json
{
  "success": true,
  "collections": {
    "Collection Name": "0x1234...",
    "Alternative Name": "0x1234..."
  }
}
```

**Error Response:**
```json
{
  "error": "Failed to preload collections"
}
```

---

## 3. Collection Exists Check

**Endpoint:** `POST /api/collection-exists`

**Purpose:** Checks if a given contract address exists in the stored collection database.

**Description:** This endpoint validates a contract address and checks whether it's already stored in the system's collection database. It's useful for preventing duplicate entries and validating user input.

**Request Body:**
```json
{
  "address": "0x1234567890123456789012345678901234567890"
}
```

**Functionality:**
- Validates the provided address format (must be valid Ethereum address)
- Retrieves all stored collections from KV store
- Checks if the address exists in the collection values
- Returns boolean result indicating existence

**Response:**
```json
{
  "exists": true
}
```

**Error Responses:**
```json
{
  "error": "Address is required"
}
```
```json
{
  "error": "Invalid address format"
}
```

---

## 4. Store Collection

**Endpoint:** `POST /api/store-collection`

**Purpose:** Stores a new collection name and address pair in the KV store.

**Description:** This endpoint allows adding new NFT collections to the system's database. It validates the address format and stores the collection information for future reference.

**Request Body:**
```json
{
  "name": "My NFT Collection",
  "address": "0x1234567890123456789012345678901234567890"
}
```

**Functionality:**
- Validates both name and address parameters
- Ensures address format is valid Ethereum address
- Converts address to lowercase for consistency
- Stores the collection in KV store
- Returns success confirmation

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
```json
{
  "error": "Name and address are required"
}
```
```json
{
  "error": "Invalid address format"
}
```

---

## 5. Autocomplete

**Endpoint:** `GET /api/autocomplete?prefix={search_term}`

**Purpose:** Provides autocomplete suggestions for collection names and addresses based on a search prefix.

**Description:** This endpoint offers intelligent search suggestions by matching the provided prefix against stored collection names and addresses. It implements a scoring system to prioritize exact matches, prefix matches, and partial matches.

**Query Parameters:**
- `prefix` (required): The search term to match against collections

**Functionality:**
- Retrieves all known collections from KV store
- Implements three-tier matching system:
  - Exact matches (score: 3)
  - Prefix matches (score: 2) 
  - Partial matches (score: 1)
- Sorts results by score, then alphabetically
- Limits results to top 5 suggestions
- Includes caching headers for performance
- Provides comprehensive logging for debugging

**Response:**
```json
{
  "suggestions": [
    {
      "name": "Bored Ape Yacht Club",
      "address": "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d"
    },
    {
      "name": "CryptoPunks",
      "address": "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb"
    }
  ]
}
```

**Error Responses:**
```json
{
  "error": "Prefix parameter is required"
}
```
```json
{
  "error": "Failed to fetch suggestions"
}
```

**Cache Headers:** Includes `Cache-Control: public, s-maxage=300, stale-while-revalidate` for 5-minute caching.

---

## 6. Search

**Endpoint:** `GET /api/search?q={query}`

**Purpose:** Resolves contract addresses from various input formats including direct addresses and ENS names.

**Description:** This endpoint handles search queries and resolves them to contract addresses. It supports direct contract addresses and ENS names, automatically fetching and storing collection metadata when found.

**Query Parameters:**
- `q` (required): The search query (contract address or ENS name)

**Functionality:**
- Validates input format (contract address or ENS name)
- For contract addresses: validates format and fetches metadata
- For ENS names: resolves to contract address using Alchemy
- Automatically stores collection names in KV store
- Returns resolved address with collection name

**Response for Contract Address:**
```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "type": "address",
  "name": "My NFT Collection"
}
```

**Response for ENS Name:**
```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "type": "ens",
  "name": "My NFT Collection"
}
```

**Error Responses:**
```json
{
  "error": "Query parameter is required"
}
```
```json
{
  "error": "ENS name not found"
}
```
```json
{
  "error": "Invalid input. Please provide a contract address or ENS name"
}
```

---

## 7. Authentication (NextAuth)

**Endpoint:** `GET/POST /api/auth/[...nextauth]`

**Purpose:** Handles authentication using NextAuth.js for the application.

**Description:** This endpoint manages all authentication-related requests including login, logout, session management, and OAuth callbacks. It uses the configured auth options from the application.

**Functionality:**
- Handles OAuth authentication flows
- Manages user sessions
- Processes login/logout requests
- Handles authentication callbacks
- Integrates with configured auth providers

**Note:** This is a NextAuth.js catch-all route that handles various authentication endpoints automatically.

---

## 8. OpenGraph Image

**Endpoint:** `GET /api/opengraph-image?fid={fid}`

**Purpose:** Generates dynamic OpenGraph images for social media sharing with user profile information.

**Description:** This endpoint creates custom OpenGraph images that include user profile pictures and names from Farcaster. It's designed for social media sharing and uses Next.js ImageResponse API.

**Query Parameters:**
- `fid` (optional): Farcaster ID to fetch user profile information

**Functionality:**
- Fetches user profile data from Neynar API using FID
- Generates dynamic image with user's profile picture
- Creates personalized greeting message
- Returns image in OpenGraph format (1200x800)
- Falls back to generic greeting if no user data

**Response:** Returns a dynamic image (PNG format) suitable for OpenGraph tags.

**Image Features:**
- Purple background with white text
- User's profile picture (if available)
- Personalized greeting message
- "Powered by Neynar 🪐" branding

---

## 9. Send Notification

**Endpoint:** `POST /api/send-notification`

**Purpose:** Sends frame notifications to users via Farcaster's notification system.

**Description:** This endpoint handles sending notifications to Farcaster users. It supports both traditional frame notifications and Neynar's notification system, automatically choosing the appropriate method based on configuration.

**Request Body:**
```json
{
  "fid": 12345,
  "notificationDetails": {
    "interests": ["nfts", "art"],
    "frequency": "daily"
  }
}
```

**Functionality:**
- Validates request body using Zod schema
- Checks if Neynar is enabled for notifications
- Stores notification details in KV store (if not using Neynar)
- Sends test notification with timestamp
- Handles rate limiting and errors
- Supports both traditional and Neynar notification systems

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
```json
{
  "success": false,
  "errors": ["Validation errors"]
}
```
```json
{
  "success": false,
  "error": "Rate limited"
}
```

---

## 10. Webhook Handler

**Endpoint:** `POST /api/webhook`

**Purpose:** Handles Farcaster webhook events for frame interactions and notification management.

**Description:** This endpoint processes webhook events from Farcaster, including frame additions/removals and notification preference changes. It manages user notification settings and sends welcome notifications.

**Functionality:**
- Verifies webhook signatures using Farcaster SDK
- Handles multiple event types:
  - `frame_added`: Stores notification details and sends welcome message
  - `frame_removed`: Deletes notification details
  - `notifications_enabled`: Stores preferences and sends confirmation
  - `notifications_disabled`: Deletes notification details
- Skips processing if Neynar is enabled (handled by Neynar webhook)
- Includes comprehensive error handling for signature verification

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
```json
{
  "success": false,
  "error": "Invalid signature"
}
```
```json
{
  "success": false,
  "error": "Invalid app key"
}
```

---

## 11. Collection Details

**Endpoint:** `GET /api/collection/{contractAddress}`

**Purpose:** Retrieves detailed information about a specific NFT collection.

**Description:** This endpoint fetches collection metadata from the database using the contract address. It validates the address format and returns comprehensive collection information.

**Path Parameters:**
- `contractAddress`: The contract address of the collection

**Functionality:**
- Validates contract address format
- Retrieves collection from database
- Returns complete collection metadata
- Handles missing collections with 404 response

**Response:**
```json
{
  "id": "uuid",
  "name": "My NFT Collection",
  "contract_address": "0x1234...",
  "token_type": "ERC721",
  "total_supply": 10000,
  "created_at": "2024-01-01T00:00:00Z",
  "last_refresh_at": "2024-01-01T12:00:00Z"
}
```

**Error Responses:**
```json
{
  "error": "Invalid contract address"
}
```
```json
{
  "error": "Collection not found"
}
```

---

## 12. Collection Metadata

**Endpoint:** `GET /api/collection/{contractAddress}/metadata`

**Purpose:** Fetches contract metadata including name, symbol, and token type from blockchain.

**Description:** This endpoint retrieves metadata directly from the blockchain contract. It first attempts to use Alchemy API, then falls back to on-chain calls if Alchemy fails.

**Path Parameters:**
- `contractAddress`: The contract address of the collection

**Functionality:**
- Attempts to fetch metadata from Alchemy API first
- Falls back to on-chain contract calls if Alchemy fails
- Supports both ERC721 and ERC1155 contracts
- Determines contract type automatically
- Handles missing or invalid metadata gracefully

**Response:**
```json
{
  "name": "My NFT Collection",
  "symbol": "MNFT",
  "totalSupply": 10000,
  "contractType": "ERC721"
}
```

**Error Response:**
```json
{
  "error": "Failed to fetch contract metadata"
}
```

---

## 13. Collection Refresh

**Endpoint:** `POST /api/collection/{contractAddress}/refresh`

**Purpose:** Manually refreshes collection data and fetches new NFTs from the blockchain.

**Description:** This endpoint forces a refresh of collection data, clearing cache and fetching updated information. It includes rate limiting to prevent abuse and handles both existing and new collections.

**Path Parameters:**
- `contractAddress`: The contract address of the collection

**Functionality:**
- Implements rate limiting (30-minute cooldown)
- Clears all cached data for the collection
- Fetches collection metadata if not in database
- Retrieves first page of NFTs from Alchemy
- Stores NFTs in database with comprehensive metadata
- Updates collection refresh timestamps
- Provides detailed progress logging

**Response:**
```json
{
  "success": true,
  "message": "Collection refresh completed",
  "nextRefreshTime": "2024-01-01T12:30:00Z",
  "collection": {
    "id": "uuid",
    "name": "My NFT Collection",
    "tokenType": "ERC721",
    "contractAddress": "0x1234...",
    "totalSupply": 10000,
    "lastRefresh": "2024-01-01T12:00:00Z"
  }
}
```

**Error Responses:**
```json
{
  "error": "Refresh is rate limited",
  "message": "Please wait 25 minutes before refreshing again",
  "nextRefreshTime": "2024-01-01T12:30:00Z"
}
```
```json
{
  "error": "Failed to fetch collection metadata"
}
```

**GET Method:** Also supports GET requests to check refresh status and cooldown information. 