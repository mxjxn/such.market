# Such.Market - Task List

**Last Updated**: November 2024

This document tracks ongoing development tasks, bug fixes, and feature implementations for Such.Market.

---

## 🔴 Critical Tasks (In Progress)

### Security & Bug Fixes from Audit
- [x] **Verify Base conduit address** - Confirmed: `0x1E0049783F008A0085193E00003D00cd54003c71`
- [ ] **Fix incorrect conduit address** - Update from `0x1E0049783F008A0085193E00003D3cdF8dFCb9c1` to correct address
- [ ] **Add graceful FrameProvider loading** - Non-blocking with timeout/fallback
- [ ] **Remove duplicate sdk.actions.ready() call** - Keep only in FrameProvider
- [ ] **Fix provider nesting order** - Avoid race conditions with Farcaster SDK

---

## 🟠 High Priority

### LSSVM + Seaport Integration
- [x] **Create LSSVM subgraph client** - GraphQL queries for pool data
- [x] **Implement pool pricing calculations** - LINEAR, EXPONENTIAL, XYK curves
- [x] **Build spam NFT filtering** - Multi-level scoring to hide spam
- [x] **Create unified price-check API** - Aggregate pools + listings
- [x] **Update .env.example** - Document LSSVM configuration
- [ ] **Build UnifiedTradingView component** - Smart routing UI
- [ ] **Create unified buy API** - Execute via best route (pool or listing)
- [ ] **Create unified sell/list API** - Instant sell or create listing
- [ ] **Add pool liquidity indicators** - Show pool depth and availability
- [ ] **Test smart routing end-to-end** - Verify best price execution

### Error Handling & UX
- [x] **Add comprehensive error handling to Seaport functions** - try-catch blocks with context
- [x] **Implement lazy loading UI** - Skeleton screens during data fetching
- [x] **Add RPC URL fallback warnings** - Warn when using public endpoints
- [x] **Create .env.example** - Document all required environment variables
- [ ] **Add order validation before signing** - Client-side safety checks

### Seaport Implementation
- [ ] **Complete NFT listings functionality** - Schema ready, need implementation
- [x] **Test offer creation with fixed conduit** - Verify end-to-end flow
- [ ] **Add offer cancellation** - Allow users to cancel active offers
- [ ] **Implement offer expiration handling** - Clean up expired orders

---

## 🟡 Medium Priority

### User Experience
- [ ] **Add loading states to all async operations** - Better feedback
- [ ] **Implement optimistic updates** - Faster perceived performance
- [ ] **Add transaction status tracking** - Real-time updates for pending transactions
- [ ] **Improve error messages** - User-friendly explanations

### Notifications
- [ ] **Test notification delivery** - Verify Farcaster notifications work
- [ ] **Add notification preferences** - Let users configure alerts
- [ ] **Implement notification history** - View past notifications

### Performance
- [ ] **Monitor cache hit rates** - Ensure 95%+ target met
- [ ] **Optimize image loading** - Lazy load NFT images
- [ ] **Add service worker** - Offline support
- [ ] **Implement request deduplication** - Prevent duplicate API calls

---

## 🟢 Low Priority

### Features
- [ ] **NFT-to-NFT trading** - Seaport supports, need UI
- [ ] **Bundle trading** - Multiple NFTs in one transaction
- [ ] **Auction system** - Time-based bidding
- [ ] **Collection offers** - Offer on any NFT in collection
- [ ] **Trait-based offers** - Offer based on specific traits

### Admin & Monitoring
- [ ] **Enhance admin dashboard** - More metrics and insights
- [ ] **Add alerting system** - Notify on critical errors
- [ ] **Implement A/B testing** - Test feature variants
- [ ] **Add analytics tracking** - User behavior insights

### Documentation
- [ ] **API documentation** - OpenAPI/Swagger spec
- [ ] **Component storybook** - UI component documentation
- [ ] **User guide** - Help documentation for users
- [ ] **Deployment guide** - Production deployment steps

---

## 📋 Backlog

### Infrastructure
- [ ] **Set up CI/CD pipeline** - Automated testing and deployment
- [ ] **Add E2E tests** - Playwright or Cypress
- [ ] **Implement rate limiting** - API protection
- [ ] **Add request logging** - Better debugging
- [ ] **Set up error tracking** - Sentry or similar

### Social Features
- [ ] **User profiles** - Enhanced profile pages
- [ ] **Follow system** - Follow collections/users
- [ ] **Activity feed** - Recent trades and offers
- [ ] **Collection stats** - Floor price, volume, etc.
- [ ] **Leaderboards** - Top traders/collections

### Advanced Trading
- [ ] **Custom conduit support** - Allow users to use own conduits
- [ ] **Bulk operations** - Batch list/offer multiple NFTs
- [ ] **Advanced order types** - Partial fills, criteria-based
- [ ] **Cross-chain trading** - Bridge support

---

## ✅ Recently Completed

### November 2024
- [x] **Documentation audit** - Updated all outdated docs
- [x] **Created CLAUDE.md** - Comprehensive AI assistant guide
- [x] **Security audit** - Identified critical and high-priority issues
- [x] **Created SECURITY_AND_BUGS_AUDIT.md** - Detailed audit report
- [x] **Updated README.md** - Corrected Next.js version, Seaport status
- [x] **Updated seaport-integration-plan.md** - Current implementation status

### October 2024
- [x] **Seaport offer creation** - API and UI complete
- [x] **Seaport offer fulfillment** - Accept offers functionality
- [x] **Recent trades feed** - Display latest transactions
- [x] **Notification system** - In-app notifications for offers
- [x] **Homepage revamp** - Hero, featured collections, latest trades
- [x] **Smart profile prioritization** - Engagement-based ordering

### September 2024
- [x] **Phase 3 optimization** - Event-driven cache invalidation
- [x] **NFT metadata improvements** - 95%+ discovery rate
- [x] **Collection health monitoring** - Track completeness
- [x] **Background population** - Non-blocking NFT fetching
- [x] **Error tracking system** - Comprehensive error monitoring

---

## 🎯 Sprint Planning

### Current Sprint (Week of Nov 22, 2024)
**Focus**: LSSVM + Seaport Integration (Smart Routing)

**Goals**:
1. [x] Create LSSVM subgraph integration utilities
2. [x] Implement spam NFT filtering system
3. [x] Build unified price-check API (pools + listings)
4. [x] Update .env.example with LSSVM configuration
5. [ ] Build UnifiedTradingView component
6. [ ] Create buy/sell API endpoints
7. [ ] Test end-to-end trading flows

**Success Criteria**:
- [x] LSSVM subgraph queries working
- [x] Spam filtering reduces visible spam by >90%
- [x] Price-check API returns best prices from both sources
- [ ] Users can see instant pool prices vs. listing prices
- [ ] Smart routing automatically chooses best execution path
- [ ] All trading works seamlessly in Farcaster mini-app

### Previous Sprint (Week of Nov 21, 2024)
**Focus**: Critical bug fixes from security audit ✅ COMPLETED

**Goals**:
1. [x] Fix conduit address
2. [x] Implement graceful FrameProvider loading
3. [x] Add error handling to Seaport
4. [x] Create .env.example
5. [x] Remove duplicate ready() calls

**Success Criteria**:
- [x] All Seaport offers work end-to-end
- [x] App loads gracefully outside Farcaster
- [x] No console errors in production
- [x] All environment variables documented

---

## 📊 Progress Tracking

### By Category
- **Security & Bugs**: 1/5 complete (20%)
- **Seaport Integration**: 3/8 complete (37.5%)
- **User Experience**: 0/4 complete (0%)
- **Performance**: 4/4 complete (100%)
- **Documentation**: 5/7 complete (71%)

### Overall Project Status
- **Core Features**: 75% complete
- **Performance Optimizations**: 100% complete
- **Trading System**: 50% complete (offers ✅, listings ⏳)
- **Polish & UX**: 40% complete
- **Documentation**: 80% complete

---

## 🚀 Deployment Checklist

Before deploying to production:
- [ ] All critical bugs fixed
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] RPC endpoints set up (not public)
- [ ] Error tracking enabled
- [ ] Performance monitoring enabled
- [ ] Cache warming completed
- [ ] Database migrations applied
- [ ] Seaport contracts verified on Base
- [ ] Farcaster manifest validated

---

## 📝 Notes

### Environment Variables Required
See `.env.example` for complete list (to be created)

### Known Issues
1. Conduit address incorrect (fixing now)
2. FrameProvider blocks rendering
3. Duplicate SDK ready() calls
4. No error handling in Seaport functions

### Technical Debt
1. Need E2E tests
2. Need API documentation
3. Need component library documentation
4. Some TODO comments in code need addressing

---

## 💡 Ideas / Future Considerations

- **Artist Coins**: BYOC or deploy new (from roadmap)
- **Hypersubs Integration**: Subscription-based access
- **Collection Deployment**: Let artists deploy collections
- **Advanced Frames**: Interactive trading frames
- **Mobile App**: Native iOS/Android apps
- **API for Third Parties**: Public API access

---

**How to Use This Document**:
1. Move tasks from backlog to sprint planning as needed
2. Update progress percentages after completing tasks
3. Add new tasks as they're identified
4. Mark completed tasks with [x] and date
5. Review and update weekly during sprint planning

**Document maintained by**: Development Team
**Review frequency**: Weekly
