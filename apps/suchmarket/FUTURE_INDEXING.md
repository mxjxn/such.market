# Future Indexing Project

This document outlines plans for implementing a proper indexing system to replace hardcoded pool data.

## Current State

Currently, pool data is hardcoded in the browse page (`app/browse/[poolContractAddress]/page.tsx`). This is a temporary solution that should be replaced with a proper indexing system.

## Goals

1. **Deploy Own Contracts**: Deploy and maintain our own LSSVM pair factory and router contracts
2. **Index Pool Creation Events**: Track all pools created through the factory contract
3. **Query Factory Events**: Query `NewERC721Pair` and `NewERC1155Pair` events to discover pools
4. **Subgraph/Indexer Integration**: Use The Graph or similar indexing service for efficient queries

## Implementation Approaches

### Option 1: The Graph Subgraph

Create a subgraph that indexes:

- `NewERC721Pair` events from the factory
- `NewERC1155Pair` events from the factory
- Pool state changes (spot price, delta, etc.)
- NFT balances in pools

**Pros:**

- Decentralized indexing
- GraphQL API for easy querying
- Automatic indexing of new events
- Good performance

**Cons:**

- Requires subgraph deployment and maintenance
- May have indexing delays

### Option 2: Custom Indexer Service

Build a custom indexing service that:

- Listens to factory events via RPC
- Stores pool data in a database
- Provides REST/GraphQL API for queries

**Pros:**

- Full control over indexing logic
- Can customize data structure
- No dependency on external services

**Cons:**

- Requires infrastructure setup
- More maintenance overhead
- Need to handle reorgs and missed events

### Option 3: Event Log Queries

Query factory events directly via RPC:

- Use `getLogs` to fetch historical events
- Cache results client-side or server-side
- Poll for new events periodically

**Pros:**

- No additional infrastructure
- Simple to implement
- Works with any RPC provider

**Cons:**

- Slower than indexed solutions
- May hit RPC rate limits
- Requires handling pagination

## Recommended Approach

Start with **Option 3** (Event Log Queries) for MVP, then migrate to **Option 1** (The Graph Subgraph) for production.

### Phase 1: Event Log Queries (MVP)

1. Create API route `/api/pools/[contractAddress]` that:

   - Queries factory contract for `NewERC721Pair` and `NewERC1155Pair` events
   - Filters by NFT contract address
   - Returns pool addresses and basic info
   - Caches results for a short period (5-10 minutes)

2. Update browse page to call this API instead of using hardcoded data

3. Add server-side caching to reduce RPC calls

### Phase 2: The Graph Subgraph (Production)

1. Create subgraph schema:

```graphql
type Pool @entity {
  id: ID!
  address: Bytes!
  nftContract: Bytes!
  tokenContract: Bytes!
  poolType: Int!
  spotPrice: BigInt!
  delta: BigInt!
  fee: BigInt!
  createdAt: BigInt!
}
```

2. Deploy subgraph to The Graph Network or hosted service

3. Update browse page to query subgraph via GraphQL

4. Add real-time updates for pool state changes

## Contract Deployment

When deploying own contracts:

1. **Factory Contract**: Deploy LSSVMPairFactory
2. **Router Contract**: Deploy LSSVMRouter
3. **Templates**: Deploy pair templates (ERC721/ETH, ERC721/ERC20, ERC1155/ETH, ERC1155/ERC20)
4. **Bonding Curves**: Deploy or whitelist bonding curve contracts

## Event Signatures

Key events to index:

```solidity
event NewERC721Pair(address indexed pair, uint256 initialNFTBalance);
event NewERC1155Pair(address indexed pair, uint256 initialNFTBalance);
```

## Query Examples

### The Graph Query

```graphql
{
  pools(where: { nftContract: "0x..." }) {
    id
    address
    spotPrice
    poolType
  }
}
```

### Direct RPC Query

```typescript
const filter = {
  address: factoryAddress,
  topics: [
    ethers.utils.id("NewERC721Pair(address,uint256)"),
    null, // pair address
  ],
  fromBlock: 0,
  toBlock: 'latest'
}
const logs = await provider.getLogs(filter)
```

## Next Steps

1. ✅ Document indexing approach (this file)
2. ✅ Implement event log query API route (`/api/pools/[contractAddress]`)
3. ✅ Update browse page to use API
4. ⏳ Deploy contracts (if needed)
5. ⏳ Create and deploy subgraph
6. ⏳ Migrate to subgraph queries

## References

- [The Graph Documentation](https://thegraph.com/docs/)
- [LSSVM Factory Contract](../src/LSSVMPairFactory.sol)
- [Event Indexing Best Practices](https://ethereum.org/en/developers/tutorials/logging-events-smart-contracts/)

