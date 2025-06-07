### Project Brief: Farcaster Seaport Marketplace

**Objective:** To build a functional NFT marketplace as a Farcaster Mini-App over a weekend. The marketplace will allow users to browse collections, view profiles, and execute trades for ERC721 and ERC1155 assets using ETH, ERC20s, or other NFTs via the Seaport protocol.

**Core Technologies:**
* **Smart Contracts:** OpenSea's Seaport Protocol
* **Blockchain Data:** Alchemy NFT API
* **Frontend/Platform:** Farcaster Mini-App SDK

---

### Phase 1: Build the Read-Only Viewer (The Foundation)

**Goal:** Create the core Browse experience. Users should be able to search for collections and view assets on collection and profile pages.

* **Task 1: Initialize Project.**
    * Use the Farcaster `create-mini-app` CLI to scaffold your project:
        ```bash
        npm create @farcaster/mini-app
        ```
    * This sets up the necessary framework and integrates the SDK.

* **Task 2: Implement the API Layer.**
    * Set up your Alchemy API key.
    * Create a service to fetch data. Your primary endpoints will be:
        * `getContractMetadata` and `getFloorPrice` for collection details.
        * `getNFTsForContract` to display all NFTs in a collection.
        * `getNFTsForOwner` for profile pages.

* **Task 3: Build UI Components.**
    * **`SearchBar.tsx`**: An input field that takes a contract address or ENS name and navigates to the corresponding collection page. Use Alchemy's `resolveName` for ENS.
    * **`/collection/[address]` Page**: Displays collection metadata and a grid of NFTs fetched from Alchemy.
    * **`/profile/[address]` Page**: Displays NFTs owned by a user. Use `sdk.context.user` to easily link to the current user's profile.

* **Task 4: Finalize Mini-App Experience.**
    * Call `sdk.actions.ready()` when your page UI is loaded to dismiss the Farcaster splash screen.
    * Add a `fc:frame` meta tag to your root layout to make your app's home page shareable in the feed.

---

### Phase 2: Create and Sign Seaport Orders (The "Sell/Offer" Side)

**Goal:** Allow users to create listings and offers by signing Seaport orders.

* **Task 1: Build Order Creation UI.**
    * Create a "List for Sale" modal/page that allows a user to specify a price (in ETH or an ERC20 token) for one of their NFTs.
    * Create an "Make Offer" button on NFT pages that allows a user to offer a specific amount of ETH/ERC20 for an NFT.
    * *(Advanced)* Create a "Propose Trade" interface where a user can select one of their NFTs to offer in exchange for a specific NFT from another user.

* **Task 2: Construct and Sign Seaport Orders.**
    * When a user submits a form from Task 1, you will construct a Seaport `OrderParameters` object.
        * **Listing:** The NFT is the `offer`; the payment token is the `consideration`.
        * **Offering:** The payment token is the `offer`; the NFT is the `consideration`.
        * **Trading:** The user's NFT is the `offer`; the target NFT is the `consideration`.
    * Reference the `createOrder` function in `test/utils/fixtures/marketplace.ts` to see how to structure these objects.
    * The user must sign this order. Use the EIP-712 `_signTypedData` method with the user's wallet provider. The `orderType` from `eip-712-types/order.js` defines the structure. The Farcaster client will handle the signing prompt.

* **Task 3: Manage Orders.**
    * For this MVP, once an order is signed, you can treat it as "active." A production app would post this signed order to a public or private orderbook. For now, you can simply use it for the next phase.

---

### Phase 3: Fulfill Seaport Orders (The "Buy/Accept" Side)

**Goal:** Enable users to execute trades by fulfilling existing orders.

* **Task 1: Build Fulfillment UI.**
    * On an NFT page with an active listing, display a "Buy Now" button.
    * On a profile page, show incoming offers on a user's NFTs with an "Accept Offer" button.

* **Task 2: Call Seaport Fulfillment Functions.**
    * This is where you will finally send a transaction to the Seaport contract.
    * **For "Buy Now" (ETH for an NFT):** Use `fulfillBasicOrder` for gas efficiency. You will pass the signed order of the seller to this function. See `test/basic.spec.ts` for examples.
    * **For accepting an offer:** The NFT owner will call `fulfillOrder` with the buyer's signed offer.
    * **For direct trades (721 <> 1155):** Use `matchOrders`, providing both signed orders. This executes the swap in a single transaction. See `test/advanced.spec.ts`.

* **Task 3: Farcaster Wallet Integration.**
    * Use the wallet provider from `sdk.wallet.getEthereumProvider()` to build and send the fulfillment transaction.
    * The Farcaster client will prompt the user to confirm the transaction, showing them the expected asset changes.

By following these three phases, you can build a robust and feature-complete NFT marketplace within a weekend, leveraging the power of Seaport and the streamlined user experience of a Farcaster Mini-App.