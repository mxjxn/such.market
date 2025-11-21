# Security & Bug Audit Report - Such.Market

**Audit Date**: November 2024
**Focus Areas**: OpenSea Seaport Integration, Farcaster Mini-App Compatibility
**Auditor**: Claude (AI Assistant)

---

## Executive Summary

This audit focused on identifying bugs and security issues in the Seaport NFT trading integration and Farcaster mini-app implementation. The application is generally well-structured with proper SDK usage, but several critical issues were identified that could impact functionality and user experience.

**Severity Levels**:
- 🔴 **CRITICAL**: Breaks core functionality or security vulnerability
- 🟠 **HIGH**: Significant impact on user experience or data integrity
- 🟡 **MEDIUM**: Moderate impact, workarounds available
- 🟢 **LOW**: Minor issues, cosmetic or edge cases

---

## 🔴 Critical Issues

### 1. Incorrect OpenSea Conduit Address (CRITICAL)

**Location**: `src/lib/seaport/orders.ts:23`

**Issue**:
```typescript
conduitKeyToConduit: {
  [SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY]: '0x1E0049783F008A0085193E00003D3cdF8dFCb9c1', // OpenSea conduit
},
```

**Problem**:
The conduit address appears to be incorrect. Based on research:
- **Ethereum mainnet** OpenSea Conduit: `0x1E0049783F008A0085193E00003D00cd54003c71` (last chars: `cd54003c71`)
- **Your code has**: `0x1E0049783F008A0085193E00003D3cdF8dFCb9c1` (last chars: `dFCb9c1`)

The difference is in the last portion of the address. This could be:
1. A typo during implementation
2. A different conduit for Base mainnet
3. A non-existent contract address

**Impact**:
- All Seaport orders may fail to execute
- Users cannot make offers or list NFTs
- Fulfillment transactions will revert

**Recommended Fix**:
1. Verify the correct OpenSea Conduit address on Base mainnet via BaseScan
2. If using OpenSea's conduit, verify it's the same across all chains or chain-specific
3. Consider using the conduit-free option (zero address) if unsure:
   ```typescript
   conduitKey: '0x0000000000000000000000000000000000000000000000000000000000000000'
   ```

**Testing Steps**:
```bash
# Check if the address exists on Base
curl https://base.blockscout.com/api/v2/addresses/0x1E0049783F008A0085193E00003D3cdF8dFCb9c1

# Check the Ethereum mainnet OpenSea conduit
curl https://api.etherscan.io/api?module=contract&action=getabi&address=0x1E0049783F008A0085193E00003D00cd54003c71
```

---

## 🟠 High Priority Issues

### 2. FrameProvider Blocks All Rendering Until SDK Loads (HIGH)

**Location**: `src/components/providers/FrameProvider.tsx:149-151`

**Issue**:
```typescript
if (!frameContext.isSDKLoaded) {
  return <div>Loading...</div>;
}
```

**Problem**:
- The entire app shows only "Loading..." until the Farcaster SDK loads
- If the SDK fails to load (network issues, browser compatibility), the app never renders
- Users accessing the app outside of Farcaster context see a perpetual loading state
- No fallback or timeout mechanism

**Impact**:
- Poor user experience for non-Farcaster users
- App appears broken if SDK fails to initialize
- SEO impact (crawlers see "Loading..." text)
- No graceful degradation

**Recommended Fix**:
```typescript
// Option 1: Non-blocking loading with graceful degradation
export function FrameProvider({ children }: { children: React.ReactNode }) {
  const frameContext = useFrame();

  return (
    <FrameContext.Provider value={frameContext}>
      {children}
    </FrameContext.Provider>
  );
}

// Option 2: Add timeout with fallback
export function FrameProvider({ children }: { children: React.ReactNode }) {
  const frameContext = useFrame();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!frameContext.isSDKLoaded) {
        console.warn('Farcaster SDK failed to load, showing fallback');
        setShowFallback(true);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [frameContext.isSDKLoaded]);

  if (!frameContext.isSDKLoaded && !showFallback) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-400">Initializing Farcaster Frame...</p>
        </div>
      </div>
    );
  }

  return (
    <FrameContext.Provider value={frameContext}>
      {children}
    </FrameContext.Provider>
  );
}
```

---

### 3. Duplicate SDK Ready Call (HIGH)

**Location**:
- `src/components/providers/FrameProvider.tsx:114`
- `src/components/Main.tsx:83`

**Issue**:
```typescript
// FrameProvider.tsx:114
sdk.actions.ready({});

// Main.tsx:83
sdk.actions.ready();
```

**Problem**:
- `sdk.actions.ready()` is called twice - once in FrameProvider and once in Main
- According to Farcaster SDK docs, ready should only be called once
- Multiple calls may cause unexpected behavior or state conflicts

**Impact**:
- Potential SDK state issues
- Unexpected mini-app behavior
- May interfere with Farcaster client communication

**Recommended Fix**:
Remove the duplicate call from Main.tsx since FrameProvider already calls it:

```typescript
// In Main.tsx - REMOVE this useEffect
useEffect(() => {
  console.log('🔄 Main component mounted, checking frame context:', {
    isSDKLoaded: frameContext.isSDKLoaded,
    hasContext: !!frameContext.context,
    isConnected,
    chainId
  });
  // REMOVE THIS LINE:
  // if (frameContext.isSDKLoaded) {
  //   sdk.actions.ready();
  // }
}, [frameContext.isSDKLoaded, frameContext.context, isConnected, chainId]);
```

---

## 🟡 Medium Priority Issues

### 4. Provider Nesting Order May Cause Issues (MEDIUM)

**Location**: `src/app/providers.tsx:16-24`

**Issue**:
```typescript
<SessionProvider session={session}>
  <WagmiProvider>
    <FrameProvider>
      {children}
    </FrameProvider>
  </WagmiProvider>
</SessionProvider>
```

**Problem**:
FrameProvider is nested inside WagmiProvider, but FrameProvider loads the SDK and should ideally be available before Wagmi tries to use the farcasterFrame() connector.

**Impact**:
- Potential race condition where Wagmi initializes before Frame SDK is ready
- farcasterFrame() connector may not work properly on initial load

**Recommended Fix**:
Consider this order (FrameProvider wraps everything):
```typescript
<FrameProvider>
  <SessionProvider session={session}>
    <WagmiProvider>
      {children}
    </WagmiProvider>
  </SessionProvider>
</FrameProvider>
```

**Note**: This depends on whether SessionProvider needs server session data. Test both configurations.

---

### 5. Missing Error Handling in Seaport Order Creation (MEDIUM)

**Location**: `src/lib/seaport/orders.ts:68-153`

**Issue**:
```typescript
export async function createOfferOrder(
  offererAddress: string,
  nftContractAddress: string,
  tokenId: string,
  offerAmountEth: string,
  durationDays: number = SEAPORT_CONFIG.DEFAULT_ORDER_DURATION_DAYS
): Promise<OrderComponents> {
  const seaport = getSeaportInstance();

  // No try-catch wrapper
  const offerAmountWei = ethToWei(offerAmountEth); // Could throw
  const counter = await seaport.getCounter(offererAddress); // Could fail
  // ...
}
```

**Problem**:
- No try-catch blocks for network calls or parsing errors
- Errors bubble up without context
- Counter fetch failure could be due to network or invalid address

**Impact**:
- Users see cryptic error messages
- Hard to debug production issues
- No graceful error recovery

**Recommended Fix**:
```typescript
export async function createOfferOrder(
  offererAddress: string,
  nftContractAddress: string,
  tokenId: string,
  offerAmountEth: string,
  durationDays: number = SEAPORT_CONFIG.DEFAULT_ORDER_DURATION_DAYS
): Promise<OrderComponents> {
  try {
    const seaport = getSeaportInstance();

    // Validate inputs
    if (!offererAddress || !/^0x[a-fA-F0-9]{40}$/.test(offererAddress)) {
      throw new Error('Invalid offerer address');
    }

    if (!nftContractAddress || !/^0x[a-fA-F0-9]{40}$/.test(nftContractAddress)) {
      throw new Error('Invalid NFT contract address');
    }

    // Convert ETH to wei with error handling
    const offerAmountWei = ethToWei(offerAmountEth);

    // Get counter with retry logic
    let counter: bigint;
    try {
      counter = await seaport.getCounter(offererAddress);
    } catch (error) {
      throw new Error(`Failed to fetch counter for address ${offererAddress}: ${error.message}`);
    }

    // ... rest of the function

  } catch (error) {
    console.error('Error creating offer order:', error);
    throw new Error(`Failed to create offer order: ${error.message}`);
  }
}
```

---

### 6. No RPC URL Fallback for Seaport (MEDIUM)

**Location**: `src/lib/seaport/config.ts:22`

**Issue**:
```typescript
RPC_URL: process.env.BASE_MAINNET_RPC || process.env.NEXT_PUBLIC_BASE_MAINNET_RPC || 'https://mainnet.base.org',
```

**Problem**:
- While there's a fallback to public RPC, the public endpoint may be rate-limited
- No warning when falling back to public RPC
- Could cause silent failures in production

**Impact**:
- Seaport operations may fail under load
- Rate limiting issues
- Degraded performance

**Recommended Fix**:
```typescript
export const SEAPORT_CONFIG = {
  // ...
  RPC_URL: (() => {
    const rpcUrl = process.env.BASE_MAINNET_RPC ||
                   process.env.NEXT_PUBLIC_BASE_MAINNET_RPC ||
                   'https://mainnet.base.org';

    if (rpcUrl === 'https://mainnet.base.org') {
      console.warn('⚠️  Using public Base RPC endpoint. Configure BASE_MAINNET_RPC for production use.');
    }

    return rpcUrl;
  })(),
  // ...
} as const;
```

---

## 🟢 Low Priority Issues

### 7. Inconsistent Conduit Key Usage (LOW)

**Location**: `src/lib/seaport/config.ts:18`

**Issue**:
The DEFAULT_CONDUIT_KEY is OpenSea's conduit key, but the code uses it universally without checking if users want to use their own conduit.

**Impact**:
- Limited to OpenSea's conduit
- Cannot use custom conduits for advanced use cases

**Recommended Fix**:
Add configuration option for custom conduit keys.

---

### 8. No Order Validation Before Signing (LOW)

**Location**: `src/components/OfferForm.tsx:166-172`

**Issue**:
```typescript
const signature = await signTypedDataAsync({
  domain,
  types: ORDER_TYPES as any,
  primaryType: 'OrderComponents',
  message: message as any,
});
```

**Problem**:
- No validation that orderComponents match expected values before signing
- User could be tricked into signing malicious orders (if API is compromised)

**Recommended Fix**:
Add client-side validation before signing:
```typescript
// Validate order before signing
if (message.offer[0].startAmount !== BigInt(parseEther(offerAmount).toString())) {
  throw new Error('Order amount mismatch detected!');
}

if (message.consideration[0].token.toLowerCase() !== contractAddress.toLowerCase()) {
  throw new Error('Contract address mismatch detected!');
}

// Then sign
const signature = await signTypedDataAsync({...});
```

---

## ✅ Good Practices Observed

1. **✅ Correct Farcaster SDK Usage**: Using `@farcaster/frame-sdk` v0.0.31+ (correct package)
2. **✅ Proper Wagmi Integration**: Using `farcasterFrame()` connector correctly
3. **✅ Address Validation**: Good validation in API endpoints
4. **✅ Lowercase Addresses**: Consistently lowercasing Ethereum addresses
5. **✅ EIP-712 Structure**: Correct EIP-712 domain and types for Seaport
6. **✅ Database Normalization**: Proper storage of orders and items
7. **✅ Notification System**: Good integration of offer notifications

---

## Recommendations Summary

### Immediate Actions (CRITICAL & HIGH)

1. **🔴 Fix Conduit Address** - Verify and correct the OpenSea conduit address
2. **🟠 Fix FrameProvider Blocking** - Implement non-blocking loading or timeout
3. **🟠 Remove Duplicate ready() Call** - Remove from Main.tsx

### Short-term (MEDIUM)

4. **🟡 Review Provider Nesting** - Test FrameProvider positioning
5. **🟡 Add Error Handling** - Wrap Seaport operations in try-catch
6. **🟡 Add RPC Fallback Warning** - Warn when using public RPC

### Long-term (LOW)

7. **🟢 Support Custom Conduits** - Add configuration for different conduits
8. **🟢 Add Order Validation** - Client-side validation before signing

---

## Testing Checklist

Before deploying fixes, test:

- [ ] Verify conduit address on BaseScan
- [ ] Test offer creation with corrected address
- [ ] Test app loading outside Farcaster context
- [ ] Test app loading with network offline (SDK failure scenario)
- [ ] Test offer signing with wallet
- [ ] Test fulfillment flow
- [ ] Test on multiple browsers (Chrome, Safari, Firefox)
- [ ] Test in Farcaster mobile app
- [ ] Test in Coinbase Wallet browser
- [ ] Monitor RPC rate limits

---

## Security Considerations

### Authentication
- ✅ Using Farcaster SIWE for authentication
- ✅ Session management via NextAuth
- ✅ FID-based user identification

### Signature Safety
- ⚠️ Consider adding order preview before signing
- ⚠️ Add anti-phishing warnings for large amounts
- ✅ Using EIP-712 for structured signatures

### RPC Security
- ⚠️ Consider using authenticated RPC endpoints
- ⚠️ Implement rate limiting on public endpoints
- ✅ Fallback RPC configured

---

## Conclusion

The Such.Market application demonstrates good architecture and proper use of Farcaster and Seaport SDKs. The critical issues identified are primarily configuration-related and can be fixed quickly. The high-priority issues affect user experience but don't compromise security.

**Priority**: Fix the conduit address ASAP as it likely breaks all trading functionality.

**Estimated Fix Time**:
- Critical issues: 1-2 hours
- High priority: 2-4 hours
- Medium priority: 4-8 hours
- Low priority: 8-16 hours (or future sprint)

---

**Document Version**: 1.0
**Last Updated**: November 2024
