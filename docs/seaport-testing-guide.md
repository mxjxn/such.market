# Seaport Testing Guide for Base Mainnet

This guide will help you test the Seaport offer functionality on Base mainnet with your NFTs.

## Prerequisites

### 1. Wallet Setup
- **Wallet**: Coinbase Wallet, MetaMask, or another EIP-1193 compatible wallet
- **Network**: Base Mainnet (Chain ID: 8453)
- **ETH Balance**: Have some ETH in your wallet for:
  - Gas fees (typically 0.0001-0.001 ETH per transaction)
  - Offer amounts (start with small amounts like 0.001 ETH for testing)

### 2. Test Collection
- **Contract Address**: The address of your test collection on Base mainnet
- **Token IDs**: 
  - At least one NFT you DON'T own (for testing offers)
  - At least one NFT you DO own (for future listing tests)

### 3. Environment Variables
Ensure your `.env.local` has:
```env
BASE_MAINNET_RPC=your_base_rpc_url
# Or use Alchemy/Infura URL
```

## Step-by-Step Testing Process

### Step 1: Start the Development Server

```bash
pnpm dev
```

Navigate to `http://localhost:3000` (or your configured port).

### Step 2: Connect Your Wallet

1. Open the app in your browser
2. Click "Connect Wallet" or use the wallet connection UI
3. Select your wallet (Coinbase Wallet, MetaMask, etc.)
4. **Important**: Ensure you're connected to **Base Mainnet**
   - If not, switch networks in your wallet
   - The app will show a warning if you're on the wrong network

### Step 3: Navigate to an NFT Page

1. Go to a collection page: `/collection/[contractAddress]`
2. Click on an NFT you DON'T own
3. You should see the NFT details page with a "Make an Offer" section

### Step 4: Create an Offer

1. **Enter Offer Amount**:
   - Start with a small amount (e.g., `0.001 ETH`)
   - This is a real offer that will be signed and could be accepted
   - Make sure you have enough ETH in your wallet

2. **Click "Make Offer"**:
   - The app will:
     - Call `/api/seaport/offers/create` to create the order
     - Return order components ready for signing
     - Prompt you to sign with your wallet

3. **Sign the Order**:
   - Your wallet will show an EIP-712 signature request
   - Review the order details:
     - Offer amount
     - NFT contract address
     - Token ID
     - Expiration time (default: 7 days)
   - Approve the signature

4. **Verify Success**:
   - You should see a success message
   - The order hash will be displayed
   - Check the browser console for the full order details

### Step 5: Verify Order Details

Open your browser's developer console (F12) and look for:
```javascript
{
  orderHash: "0x...",
  orderComponents: { ... },
  signature: "0x..."
}
```

**Key things to verify**:
- ✅ Order hash is a valid hex string (66 characters)
- ✅ Offer amount matches what you entered
- ✅ NFT contract address is correct
- ✅ Token ID is correct
- ✅ Expiration time is in the future (7 days from now)
- ✅ Signature is present and valid format

### Step 6: Check Order on Base Explorer

1. Copy the order hash from the console
2. Go to [Basescan](https://basescan.org/)
3. Search for the Seaport contract: `0x0000000000000068F116a894984e2DB1123eB395`
4. You can verify the order structure matches what was created

## Troubleshooting

### Issue: "Please connect your wallet first"
**Solution**: 
- Make sure your wallet is connected to the app
- Check that the wallet extension is unlocked
- Try disconnecting and reconnecting

### Issue: "Please switch to Base mainnet"
**Solution**:
- Open your wallet
- Switch network to Base Mainnet (Chain ID: 8453)
- If Base isn't in your wallet, add it:
  - Network Name: Base
  - RPC URL: `https://mainnet.base.org`
  - Chain ID: 8453
  - Currency Symbol: ETH
  - Block Explorer: `https://basescan.org`

### Issue: "Failed to create offer order"
**Possible causes**:
1. **Invalid contract address**: Ensure the NFT contract exists on Base mainnet
2. **Invalid token ID**: The token ID might not exist in the collection
3. **RPC issues**: Check your `BASE_MAINNET_RPC` environment variable
4. **Counter fetch failed**: The Seaport contract might not be accessible

**Debug steps**:
- Check browser console for detailed error messages
- Verify the contract address is correct
- Test the RPC connection: `curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' $BASE_MAINNET_RPC`

### Issue: Signature fails or is rejected
**Possible causes**:
1. **Wrong network**: Ensure you're on Base mainnet
2. **EIP-712 structure mismatch**: The order structure might not match Seaport's expected format
3. **Wallet compatibility**: Some wallets have issues with complex EIP-712 structures

**Debug steps**:
- Check the wallet's error message
- Verify the order components in the console
- Try a different wallet if issues persist

### Issue: Order hash doesn't match expected format
**Solution**:
- The order hash should be 66 characters (0x + 64 hex chars)
- If it's different, there might be an issue with the order construction
- Check the `getOrderHash` function in `src/lib/seaport/orders.ts`

## Testing Checklist

Before testing, ensure:
- [ ] Wallet is connected
- [ ] On Base Mainnet (Chain ID: 8453)
- [ ] Have ETH for gas and offers
- [ ] Test collection address is correct
- [ ] Token ID exists in the collection
- [ ] You're NOT the owner of the NFT (for offer testing)

After creating an offer:
- [ ] Success message appears
- [ ] Order hash is displayed
- [ ] Order details in console are correct
- [ ] Signature is present
- [ ] No errors in console

## Next Steps

Once you've successfully created an offer:

1. **Store the Order**: In production, you'd store the signed order in a database or orderbook
2. **Display Offers**: Show incoming offers to NFT owners
3. **Accept Offers**: Implement the fulfillment flow (see `src/app/api/seaport/offers/fulfill/route.ts`)
4. **Test Fulfillment**: Create a test to accept an offer (requires the NFT owner to accept)

## Safety Reminders

⚠️ **This is Mainnet Testing**:
- Use small amounts (0.001 ETH or less)
- Double-check all addresses before signing
- Test with a wallet that has limited funds
- Keep your private keys secure

⚠️ **Order Expiration**:
- Orders expire after 7 days by default
- Expired orders cannot be fulfilled
- You can create new orders if needed

⚠️ **Gas Costs**:
- Creating and signing an order is free (off-chain)
- Fulfilling an order costs gas (on-chain transaction)
- Gas prices vary, check current rates on Basescan

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify all environment variables are set
3. Test the RPC connection
4. Review the Seaport contract documentation
5. Check Base network status

## Useful Links

- [Base Explorer](https://basescan.org/)
- [Seaport Contract on Base](https://basescan.org/address/0x0000000000000068F116a894984e2DB1123eB395)
- [Seaport Documentation](https://github.com/ProjectOpenSea/seaport)
- [Base Network Info](https://base.org/)

