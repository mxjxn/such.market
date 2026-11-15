# Quick Start Guide

## No Backend Required! 🎉

This is a **Next.js app** that runs everything in one process:
- Frontend (React/Next.js)
- API routes (serverless functions in `app/api/`)
- All runs together with `npm run dev`

## Quick Setup (3 Steps)

### 1. Install Dependencies

```bash
cd apps/miniapp
npm install
```

### 2. (Optional) Create `.env.local` for Better Performance

Create a `.env.local` file to avoid RPC rate limits:

```bash
# Recommended: Use your own RPC endpoint to avoid rate limits
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Optional: Custom IPFS gateway (defaults to ipfs.io)
NEXT_PUBLIC_IPFS_URL=https://your-ipfs-gateway.com

# Optional: Override contract addresses (has defaults built-in)
NEXT_PUBLIC_ROUTER_ADDRESS_8453=0x...
NEXT_PUBLIC_FACTORY_ADDRESS_8453=0x...
NEXT_PUBLIC_ROUTER_ADDRESS_84532=0x...
NEXT_PUBLIC_FACTORY_ADDRESS_84532=0x...
```

**Note**: The app has **hardcoded fallback addresses** in `lib/config.ts`, so it will work even without `.env.local`!

### 3. Run the App

```bash
npm run dev
```

The app will start at `http://localhost:3000`

## What Runs Automatically

When you run `npm run dev`, Next.js automatically handles:

✅ **Frontend** - React components and pages  
✅ **API Routes** - Serverless functions:
   - `/api/pools/[contractAddress]` - Fetches pools from The Graph subgraph
   - `/api/check-approval` - Checks NFT approvals on-chain

✅ **Blockchain Connections** - Via RPC endpoints (public or your custom)  
✅ **Subgraph Queries** - Pre-configured endpoints in `lib/config.ts`

## Testing the App

1. **Open** http://localhost:3000
2. **Enter a pool address** or NFT contract address
3. **Browse pools** - The app will query The Graph subgraph automatically
4. **Buy/Sell NFTs** - Connect wallet and interact with pools

## How It Works

```
┌─────────────────────────────────────┐
│   Next.js Dev Server (npm run dev)  │
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │   Frontend  │  │  API Routes  │ │
│  │  (React)    │  │  (Serverless)│ │
│  └──────┬──────┘  └──────┬───────┘ │
│         │                 │         │
│         └────────┬────────┘         │
│                  │                  │
└──────────────────┼──────────────────┘
                   │
         ┌─────────┼─────────┐
         │         │         │
    ┌────▼───┐ ┌──▼────┐ ┌──▼────┐
    │  RPC   │ │ Graph │ │  IPFS │
    │ (Base) │ │Subgraph│ │Gateway│
    └────────┘ └───────┘ └───────┘
```

## Troubleshooting

### App won't start?
- Make sure you're in `apps/miniapp` directory
- Run `npm install` first
- Check Node.js version (should be 18+)

### Rate limit errors?
- Add your own RPC endpoint to `.env.local`
- Get free RPC from Alchemy, Infura, or QuickNode

### Can't find pools?
- Make sure The Graph subgraph is synced
- Check the subgraph endpoints in `lib/config.ts`
- Try a different NFT contract address

### API routes not working?
- API routes run automatically with Next.js
- Check browser console for errors
- Make sure you're accessing via `http://localhost:3000` (not file://)

## Default Configuration

The app works out of the box with these defaults:

- **Base Mainnet Router**: `0xa07ebd56b361fe79af706a2bf6d8097091225548`
- **Base Mainnet Factory**: `0x605145D263482684590f630E9e581B21E4938eb8`
- **Base Sepolia Router**: `0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3`
- **Base Sepolia Factory**: `0x372990Fd91CF61967325dD5270f50c4192bfb892`
- **RPC**: Public endpoints (may hit rate limits)
- **Subgraph**: Pre-configured endpoints

## Next Steps

- See [README.md](./README.md) for full documentation
- See [ENV_VARS.md](./ENV_VARS.md) for all environment variables
- See [FUTURE_INDEXING.md](./FUTURE_INDEXING.md) for indexing improvements

