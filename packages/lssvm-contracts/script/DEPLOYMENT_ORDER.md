# Deployment Order Quick Reference

This document provides a quick reference for the deployment order of sudoAMM v2 contracts.

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL DEPENDENCY                          │
│                   Manifold Royalty Registry (pre-existing)           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: RoyaltyEngine                                                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│ STEP 2a:                  │   │ STEP 2b:                  │
│ LSSVMPairERC721ETH        │   │ LSSVMPairERC1155ETH       │
│ LSSVMPairERC721ERC20      │   │ LSSVMPairERC1155ERC20     │
└───────────┬───────────────┘   └───────────┬───────────────┘
            │                               │
            └───────────────┬───────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: LSSVMPairFactory                                             │
└───────────────┬─────────────────────────────────────┬───────────────┘
                │                                     │
                ▼                                     ▼
┌───────────────────────────┐           ┌───────────────────────────┐
│ STEP 4: Bonding Curves    │           │ STEP 5: VeryFastRouter    │
│ (independent)             │           │                           │
│ - LinearCurve             │           └───────────────────────────┘
│ - ExponentialCurve        │
│ - XykCurve                │
│ - GDACurve                │
└───────────────────────────┘
                
┌───────────────────────────┐
│ STEP 6: Property Checkers │
│ (independent)             │
│ - MerklePropertyChecker   │
│ - RangePropertyChecker    │
│ - PropertyCheckerFactory  │
└───────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ STEP 7: Settings                                                  │
│ - Splitter (independent)                                          │
│ - StandardSettings (requires Splitter + Factory)                 │
│ - StandardSettingsFactory (requires StandardSettings)            │
└───────────────────────────────────────────────────────────────────┘
```

## Deployment Sequence

### Phase 1: Foundation (Required)
1. **RoyaltyEngine** ← Requires: Manifold Royalty Registry address

### Phase 2: Templates (Required)
2. **LSSVMPairERC721ETH** ← Requires: RoyaltyEngine
3. **LSSVMPairERC721ERC20** ← Requires: RoyaltyEngine
4. **LSSVMPairERC1155ETH** ← Requires: RoyaltyEngine
5. **LSSVMPairERC1155ERC20** ← Requires: RoyaltyEngine

### Phase 3: Factory (Required)
6. **LSSVMPairFactory** ← Requires: All 4 templates from Phase 2

### Phase 4: Extensions (Optional but Recommended)

#### 4a. Bonding Curves (Independent)
7. **LinearCurve**
8. **ExponentialCurve**
9. **XykCurve**
10. **GDACurve**

#### 4b. Router
11. **VeryFastRouter** ← Requires: LSSVMPairFactory

#### 4c. Property Checkers (Independent)
12. **MerklePropertyChecker** (implementation)
13. **RangePropertyChecker** (implementation)
14. **PropertyCheckerFactory** ← Requires: Property checker implementations

#### 4d. Settings
15. **Splitter** (implementation)
16. **StandardSettings** ← Requires: Splitter + LSSVMPairFactory
17. **StandardSettingsFactory** ← Requires: StandardSettings

## Post-Deployment Configuration

After all contracts are deployed, the factory owner must:

1. **Whitelist Bonding Curves** (for each curve):
   ```
   factory.setBondingCurveAllowed(curveAddress, true)
   ```

2. **Whitelist Router**:
   ```
   factory.setRouterAllowed(routerAddress, true)
   ```

## Scripts Reference

| Order | Script | Contracts Deployed |
|-------|--------|-------------------|
| 1 | `01_DeployCore.s.sol` | RoyaltyEngine, Templates, Factory |
| 2 | `02_DeployBondingCurves.s.sol` | All 4 bonding curves |
| 3 | `03_DeployRouter.s.sol` | VeryFastRouter |
| 4 | `04_DeployPropertyCheckers.s.sol` | Property checkers + factory |
| 5 | `05_DeploySettings.s.sol` | Settings system |
| - | `DeployAll.s.sol` | Everything in order |

## Minimal Deployment

For a minimal functional deployment, you only need:
- Phase 1: RoyaltyEngine
- Phase 2: All 4 templates
- Phase 3: LSSVMPairFactory
- Phase 4a: At least one bonding curve (e.g., LinearCurve)

This allows users to create pools, but they won't have access to:
- Router functionality (manual interactions only)
- Property checking
- Settings system

## Constructor Arguments Quick Reference

| Contract | Constructor Arguments |
|----------|----------------------|
| RoyaltyEngine | `address royaltyRegistry` |
| LSSVMPairERC721ETH | `IRoyaltyEngineV1 royaltyEngine` |
| LSSVMPairERC721ERC20 | `IRoyaltyEngineV1 royaltyEngine` |
| LSSVMPairERC1155ETH | `IRoyaltyEngineV1 royaltyEngine` |
| LSSVMPairERC1155ERC20 | `IRoyaltyEngineV1 royaltyEngine` |
| LSSVMPairFactory | All 4 templates, feeRecipient, feeMultiplier, owner |
| LinearCurve | None |
| ExponentialCurve | None |
| XykCurve | None |
| GDACurve | None |
| VeryFastRouter | `ILSSVMPairFactoryLike factory` |
| MerklePropertyChecker | None (implementation) |
| RangePropertyChecker | None (implementation) |
| PropertyCheckerFactory | Both checker implementations |
| Splitter | None (implementation) |
| StandardSettings | `Splitter impl`, `ILSSVMPairFactoryLike factory` |
| StandardSettingsFactory | `StandardSettings impl` |

## Common Pitfalls

1. **Deploying out of order**: Templates must be deployed before factory
2. **Forgetting to whitelist**: Curves and router won't work until whitelisted
3. **Wrong royalty registry**: Each network has a different address
4. **Fee too high**: protocolFeeMultiplier must be ≤ 0.1e18 (10%)
5. **Wrong factory owner**: Ensure FACTORY_OWNER is set correctly for post-deployment config
