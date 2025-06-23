# Seaport Contract Cheatsheet for Such.Market 🛒

## 📋 Quick Reference

### Contract Addresses (Base Mainnet)
```solidity
// Seaport v1.6 (Latest)
SEAPORT_V1_6 = 0x0000000000000068F116a894984e2DB1123eB395

// Conduit Controller
CONDUIT_CONTROLLER = 0x00000000F9490004C11Cef243f5400493c00Ad63

// Default Zone (OpenSea's zone)
DEFAULT_ZONE = 0x004C00500000aD104D7DBd00e3ae0A5C00560C00

// Default Conduit Key
DEFAULT_CONDUIT_KEY = 0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000
```

### Core Structs

#### OrderComponents
```solidity
struct OrderComponents {
    address offerer;           // Who creates the order
    address zone;             // Zone contract (can restrict/cancel)
    OfferItem[] offer;        // What's being offered
    ConsiderationItem[] consideration; // What's being received
    OrderType orderType;      // Order type (FULL_OPEN, etc.)
    uint256 startTime;        // When order becomes valid
    uint256 endTime;          // When order expires
    bytes32 zoneHash;         // Hash for zone validation
    uint256 salt;             // Unique identifier
    bytes32 conduitKey;       // Conduit for transfers
    uint256 counter;          // Order counter (prevents replay)
}
```

#### OfferItem
```solidity
struct OfferItem {
    ItemType itemType;        // Type of item (ERC721, ERC20, etc.)
    address token;            // Token contract address
    uint256 identifierOrCriteria; // Token ID or criteria root
    uint256 startAmount;      // Amount at start time
    uint256 endAmount;        // Amount at end time
}
```

#### ConsiderationItem
```solidity
struct ConsiderationItem {
    ItemType itemType;        // Type of item
    address token;            // Token contract address
    uint256 identifierOrCriteria; // Token ID or criteria root
    uint256 startAmount;      // Amount at start time
    uint256 endAmount;        // Amount at end time
    address payable recipient; // Who receives this item
}
```

### Enums

#### ItemType
```solidity
enum ItemType {
    NATIVE,           // 0: ETH, MATIC, etc.
    ERC20,           // 1: ERC20 tokens
    ERC721,          // 2: ERC721 NFTs
    ERC1155,         // 3: ERC1155 tokens
    ERC721_WITH_CRITERIA,  // 4: ERC721 with merkle criteria
    ERC1155_WITH_CRITERIA  // 5: ERC1155 with merkle criteria
}
```

#### OrderType
```solidity
enum OrderType {
    FULL_OPEN,           // 0: No partial fills, anyone can execute
    PARTIAL_OPEN,        // 1: Partial fills, anyone can execute
    FULL_RESTRICTED,     // 2: No partial fills, restricted execution
    PARTIAL_RESTRICTED,  // 3: Partial fills, restricted execution
    CONTRACT            // 4: Contract order type
}
```

#### BasicOrderType
```solidity
enum BasicOrderType {
    ETH_TO_ERC721_FULL_OPEN,        // 0
    ETH_TO_ERC721_PARTIAL_OPEN,     // 1
    ETH_TO_ERC721_FULL_RESTRICTED,  // 2
    ETH_TO_ERC721_PARTIAL_RESTRICTED, // 3
    ETH_TO_ERC1155_FULL_OPEN,       // 4
    ETH_TO_ERC1155_PARTIAL_OPEN,    // 5
    ETH_TO_ERC1155_FULL_RESTRICTED, // 6
    ETH_TO_ERC1155_PARTIAL_RESTRICTED, // 7
    ERC20_TO_ERC721_FULL_OPEN,      // 8
    ERC20_TO_ERC721_PARTIAL_OPEN,   // 9
    ERC20_TO_ERC721_FULL_RESTRICTED, // 10
    ERC20_TO_ERC721_PARTIAL_RESTRICTED, // 11
    ERC20_TO_ERC1155_FULL_OPEN,     // 12
    ERC20_TO_ERC1155_PARTIAL_OPEN,  // 13
    ERC20_TO_ERC1155_FULL_RESTRICTED, // 14
    ERC20_TO_ERC1155_PARTIAL_RESTRICTED, // 15
    ERC721_TO_ERC20_FULL_OPEN,      // 16
    ERC721_TO_ERC20_PARTIAL_OPEN,   // 17
    ERC721_TO_ERC20_FULL_RESTRICTED, // 18
    ERC721_TO_ERC20_PARTIAL_RESTRICTED, // 19
    ERC1155_TO_ERC20_FULL_OPEN,     // 20
    ERC1155_TO_ERC20_PARTIAL_OPEN,  // 21
    ERC1155_TO_ERC20_FULL_RESTRICTED, // 22
    ERC1155_TO_ERC20_PARTIAL_RESTRICTED  // 23
}
```

## 🏗️ Core Contract Functions

### Seaport Interface
```solidity
interface SeaportInterface {
    // Basic order fulfillment
    function fulfillOrder(Order calldata order, bytes32 fulfillerConduitKey) 
        external 
        payable 
        returns (bool fulfilled);
    
    // Advanced order fulfillment
    function fulfillAdvancedOrder(
        AdvancedOrder calldata advancedOrder,
        CriteriaResolver[] calldata criteriaResolvers,
        bytes32 fulfillerConduitKey,
        address recipient
    ) external payable returns (bool fulfilled);
    
    // Basic order fulfillment (efficient)
    function fulfillBasicOrder(BasicOrderParameters calldata parameters) 
        external 
        payable 
        returns (bool fulfilled);
    
    // Cancel orders
    function cancel(OrderComponents[] calldata orders) external returns (bool cancelled);
    
    // Validate orders
    function validate(Order[] calldata orders) external returns (bool validated);
    
    // Get order hash
    function getOrderHash(OrderComponents calldata order) external view returns (bytes32 orderHash);
    
    // Get counter
    function getCounter(address offerer) external view returns (uint256 counter);
}
```

## 📝 Common Order Patterns

### 1. NFT Listing (ERC721 for ETH)
```solidity
// Create a listing where someone offers an NFT and receives ETH
OrderComponents memory orderComponents = OrderComponents({
    offerer: sellerAddress,
    zone: DEFAULT_ZONE,
    offer: new OfferItem[](1),
    consideration: new ConsiderationItem[](1),
    orderType: OrderType.FULL_OPEN,
    startTime: block.timestamp,
    endTime: block.timestamp + 7 days,
    zoneHash: bytes32(0),
    salt: generateSalt(),
    conduitKey: DEFAULT_CONDUIT_KEY,
    counter: getCounter(sellerAddress)
});

// Offer: NFT
orderComponents.offer[0] = OfferItem({
    itemType: ItemType.ERC721,
    token: nftContractAddress,
    identifierOrCriteria: tokenId,
    startAmount: 1,
    endAmount: 1
});

// Consideration: ETH
orderComponents.consideration[0] = ConsiderationItem({
    itemType: ItemType.NATIVE,
    token: address(0),
    identifierOrCriteria: 0,
    startAmount: priceInWei,
    endAmount: priceInWei,
    recipient: payable(sellerAddress)
});
```

### 2. NFT Offer (ETH for ERC721)
```solidity
// Create an offer where someone offers ETH and receives an NFT
OrderComponents memory orderComponents = OrderComponents({
    offerer: buyerAddress,
    zone: DEFAULT_ZONE,
    offer: new OfferItem[](1),
    consideration: new ConsiderationItem[](1),
    orderType: OrderType.FULL_OPEN,
    startTime: block.timestamp,
    endTime: block.timestamp + 7 days,
    zoneHash: bytes32(0),
    salt: generateSalt(),
    conduitKey: DEFAULT_CONDUIT_KEY,
    counter: getCounter(buyerAddress)
});

// Offer: ETH
orderComponents.offer[0] = OfferItem({
    itemType: ItemType.NATIVE,
    token: address(0),
    identifierOrCriteria: 0,
    startAmount: offerAmountInWei,
    endAmount: offerAmountInWei
});

// Consideration: NFT
orderComponents.consideration[0] = ConsiderationItem({
    itemType: ItemType.ERC721,
    token: nftContractAddress,
    identifierOrCriteria: tokenId,
    startAmount: 1,
    endAmount: 1,
    recipient: payable(buyerAddress)
});
```

### 3. Bundle Listing (Multiple NFTs for ETH)
```solidity
// Create a bundle listing with multiple NFTs
OrderComponents memory orderComponents = OrderComponents({
    offerer: sellerAddress,
    zone: DEFAULT_ZONE,
    offer: new OfferItem[](2), // 2 NFTs
    consideration: new ConsiderationItem[](1),
    orderType: OrderType.FULL_OPEN,
    startTime: block.timestamp,
    endTime: block.timestamp + 7 days,
    zoneHash: bytes32(0),
    salt: generateSalt(),
    conduitKey: DEFAULT_CONDUIT_KEY,
    counter: getCounter(sellerAddress)
});

// Offer: NFT 1
orderComponents.offer[0] = OfferItem({
    itemType: ItemType.ERC721,
    token: nftContract1,
    identifierOrCriteria: tokenId1,
    startAmount: 1,
    endAmount: 1
});

// Offer: NFT 2
orderComponents.offer[1] = OfferItem({
    itemType: ItemType.ERC721,
    token: nftContract2,
    identifierOrCriteria: tokenId2,
    startAmount: 1,
    endAmount: 1
});

// Consideration: ETH
orderComponents.consideration[0] = ConsiderationItem({
    itemType: ItemType.NATIVE,
    token: address(0),
    identifierOrCriteria: 0,
    startAmount: bundlePriceInWei,
    endAmount: bundlePriceInWei,
    recipient: payable(sellerAddress)
});
```

### 4. NFT-for-NFT Trade
```solidity
// Create a trade where both parties exchange NFTs
OrderComponents memory orderComponents = OrderComponents({
    offerer: trader1Address,
    zone: DEFAULT_ZONE,
    offer: new OfferItem[](1),
    consideration: new ConsiderationItem[](1),
    orderType: OrderType.FULL_OPEN,
    startTime: block.timestamp,
    endTime: block.timestamp + 7 days,
    zoneHash: bytes32(0),
    salt: generateSalt(),
    conduitKey: DEFAULT_CONDUIT_KEY,
    counter: getCounter(trader1Address)
});

// Offer: NFT from trader 1
orderComponents.offer[0] = OfferItem({
    itemType: ItemType.ERC721,
    token: nftContract1,
    identifierOrCriteria: tokenId1,
    startAmount: 1,
    endAmount: 1
});

// Consideration: NFT from trader 2
orderComponents.consideration[0] = ConsiderationItem({
    itemType: ItemType.ERC721,
    token: nftContract2,
    identifierOrCriteria: tokenId2,
    startAmount: 1,
    endAmount: 1,
    recipient: payable(trader1Address)
});
```

## 🔧 Utility Functions

### Generate Salt
```solidity
function generateSalt() internal view returns (uint256) {
    return uint256(keccak256(abi.encodePacked(
        block.timestamp,
        msg.sender,
        block.difficulty
    )));
}
```

### Get Order Hash
```solidity
function getOrderHash(OrderComponents memory orderComponents) 
    internal 
    view 
    returns (bytes32) 
{
    return seaport.getOrderHash(orderComponents);
}
```

### Get Counter
```solidity
function getCounter(address offerer) internal view returns (uint256) {
    return seaport.getCounter(offerer);
}
```

### Validate Order
```solidity
function validateOrder(Order memory order) internal view returns (bool) {
    try seaport.validate(Order[](order)) returns (bool validated) {
        return validated;
    } catch {
        return false;
    }
}
```

## 🎯 Fulfillment Patterns

### Basic Order Fulfillment
```solidity
function fulfillBasicOrder(
    address seaport,
    BasicOrderParameters memory parameters
) external payable returns (bool) {
    return SeaportInterface(seaport).fulfillBasicOrder{value: msg.value}(parameters);
}
```

### Advanced Order Fulfillment
```solidity
function fulfillAdvancedOrder(
    address seaport,
    AdvancedOrder memory advancedOrder,
    CriteriaResolver[] memory criteriaResolvers,
    bytes32 fulfillerConduitKey,
    address recipient
) external payable returns (bool) {
    return SeaportInterface(seaport).fulfillAdvancedOrder{value: msg.value}(
        advancedOrder,
        criteriaResolvers,
        fulfillerConduitKey,
        recipient
    );
}
```

### Cancel Orders
```solidity
function cancelOrders(OrderComponents[] memory orders) external returns (bool) {
    return seaport.cancel(orders);
}
```

## 📊 Order Validation

### Check Order Validity
```solidity
function isOrderValid(Order memory order) internal view returns (bool) {
    // Check if order is not expired
    if (order.parameters.endTime <= block.timestamp) {
        return false;
    }
    
    // Check if order has started
    if (order.parameters.startTime > block.timestamp) {
        return false;
    }
    
    // Validate order on Seaport
    return validateOrder(order);
}
```

### Check Order Availability
```solidity
function isOrderAvailable(Order memory order) internal view returns (bool) {
    // Check if order is valid
    if (!isOrderValid(order)) {
        return false;
    }
    
    // Check if offerer has sufficient balance
    for (uint256 i = 0; i < order.parameters.offer.length; i++) {
        OfferItem memory offerItem = order.parameters.offer[i];
        
        if (offerItem.itemType == ItemType.ERC721) {
            // Check if offerer owns the NFT
            try IERC721(offerItem.token).ownerOf(offerItem.identifierOrCriteria) returns (address owner) {
                if (owner != order.parameters.offerer) {
                    return false;
                }
            } catch {
                return false;
            }
        } else if (offerItem.itemType == ItemType.ERC20) {
            // Check if offerer has sufficient ERC20 balance
            uint256 balance = IERC20(offerItem.token).balanceOf(order.parameters.offerer);
            if (balance < offerItem.startAmount) {
                return false;
            }
        }
    }
    
    return true;
}
```

## 🔐 Security Considerations

### Replay Protection
```solidity
// Always use unique salts and check counters
function createOrderWithReplayProtection(
    address offerer,
    uint256 salt
) internal view returns (OrderComponents memory) {
    uint256 counter = seaport.getCounter(offerer);
    
    return OrderComponents({
        offerer: offerer,
        zone: DEFAULT_ZONE,
        offer: new OfferItem[](0),
        consideration: new ConsiderationItem[](0),
        orderType: OrderType.FULL_OPEN,
        startTime: block.timestamp,
        endTime: block.timestamp + 7 days,
        zoneHash: bytes32(0),
        salt: salt,
        conduitKey: DEFAULT_CONDUIT_KEY,
        counter: counter
    });
}
```

### Signature Verification
```solidity
function verifyOrderSignature(
    OrderComponents memory orderComponents,
    bytes memory signature
) internal view returns (bool) {
    bytes32 orderHash = seaport.getOrderHash(orderComponents);
    bytes32 digest = keccak256(abi.encodePacked(
        "\x19\x01",
        seaport.getDomainSeparator(),
        orderHash
    ));
    
    address signer = ecrecover(digest, 
        uint8(signature[0]), 
        bytes32(signature[1:33]), 
        bytes32(signature[33:65])
    );
    
    return signer == orderComponents.offerer;
}
```

## 🎨 Such.Market Specific Patterns

### Create Listing with Royalties
```solidity
function createListingWithRoyalties(
    address nftContract,
    uint256 tokenId,
    uint256 price,
    address creator,
    uint256 royaltyBps // Basis points (e.g., 250 = 2.5%)
) internal view returns (OrderComponents memory) {
    uint256 royaltyAmount = (price * royaltyBps) / 10000;
    uint256 sellerAmount = price - royaltyAmount;
    
    OrderComponents memory orderComponents = OrderComponents({
        offerer: msg.sender,
        zone: DEFAULT_ZONE,
        offer: new OfferItem[](1),
        consideration: new ConsiderationItem[](2), // Seller + Creator
        orderType: OrderType.FULL_OPEN,
        startTime: block.timestamp,
        endTime: block.timestamp + 7 days,
        zoneHash: bytes32(0),
        salt: generateSalt(),
        conduitKey: DEFAULT_CONDUIT_KEY,
        counter: getCounter(msg.sender)
    });
    
    // Offer: NFT
    orderComponents.offer[0] = OfferItem({
        itemType: ItemType.ERC721,
        token: nftContract,
        identifierOrCriteria: tokenId,
        startAmount: 1,
        endAmount: 1
    });
    
    // Consideration: Seller receives most of the ETH
    orderComponents.consideration[0] = ConsiderationItem({
        itemType: ItemType.NATIVE,
        token: address(0),
        identifierOrCriteria: 0,
        startAmount: sellerAmount,
        endAmount: sellerAmount,
        recipient: payable(msg.sender)
    });
    
    // Consideration: Creator receives royalties
    orderComponents.consideration[1] = ConsiderationItem({
        itemType: ItemType.NATIVE,
        token: address(0),
        identifierOrCriteria: 0,
        startAmount: royaltyAmount,
        endAmount: royaltyAmount,
        recipient: payable(creator)
    });
    
    return orderComponents;
}
```

### Create Offer with Platform Fee
```solidity
function createOfferWithPlatformFee(
    address nftContract,
    uint256 tokenId,
    uint256 offerAmount,
    uint256 platformFeeBps // Basis points
) internal view returns (OrderComponents memory) {
    uint256 platformFee = (offerAmount * platformFeeBps) / 10000;
    uint256 netAmount = offerAmount - platformFee;
    
    OrderComponents memory orderComponents = OrderComponents({
        offerer: msg.sender,
        zone: DEFAULT_ZONE,
        offer: new OfferItem[](1),
        consideration: new ConsiderationItem[](2), // NFT owner + Platform
        orderType: OrderType.FULL_OPEN,
        startTime: block.timestamp,
        endTime: block.timestamp + 7 days,
        zoneHash: bytes32(0),
        salt: generateSalt(),
        conduitKey: DEFAULT_CONDUIT_KEY,
        counter: getCounter(msg.sender)
    });
    
    // Offer: ETH
    orderComponents.offer[0] = OfferItem({
        itemType: ItemType.NATIVE,
        token: address(0),
        identifierOrCriteria: 0,
        startAmount: offerAmount,
        endAmount: offerAmount
    });
    
    // Consideration: NFT owner receives net amount
    orderComponents.consideration[0] = ConsiderationItem({
        itemType: ItemType.ERC721,
        token: nftContract,
        identifierOrCriteria: tokenId,
        startAmount: 1,
        endAmount: 1,
        recipient: payable(msg.sender)
    });
    
    // Consideration: Platform receives fee
    orderComponents.consideration[1] = ConsiderationItem({
        itemType: ItemType.NATIVE,
        token: address(0),
        identifierOrCriteria: 0,
        startAmount: platformFee,
        endAmount: platformFee,
        recipient: payable(platformTreasury)
    });
    
    return orderComponents;
}
```

## 🚀 Gas Optimization Tips

### Use Basic Order Types When Possible
```solidity
// Use BasicOrderParameters for simple ETH <-> NFT trades
// This is more gas efficient than AdvancedOrder
BasicOrderParameters memory basicOrder = BasicOrderParameters({
    considerationToken: address(0), // ETH
    considerationIdentifier: 0,
    considerationAmount: price,
    offerer: sellerAddress,
    zone: DEFAULT_ZONE,
    offerToken: nftContract,
    offerIdentifier: tokenId,
    offerAmount: 1,
    basicOrderType: BasicOrderType.ETH_TO_ERC721_FULL_OPEN,
    startTime: block.timestamp,
    endTime: block.timestamp + 7 days,
    zoneHash: bytes32(0),
    salt: generateSalt(),
    offererConduitKey: DEFAULT_CONDUIT_KEY,
    fulfillerConduitKey: DEFAULT_CONDUIT_KEY,
    totalOriginalAdditionalRecipients: 0,
    additionalRecipients: new AdditionalRecipient[](0),
    signature: ""
});
```

### Batch Operations
```solidity
// Use fulfillAvailableOrders for multiple orders
function fulfillMultipleOrders(
    Order[] memory orders,
    FulfillmentComponent[][] memory offerFulfillments,
    FulfillmentComponent[][] memory considerationFulfillments,
    bytes32 fulfillerConduitKey,
    uint256 maximumFulfilled
) external payable returns (bool[] memory availableOrders, Execution[] memory executions) {
    return seaport.fulfillAvailableOrders{value: msg.value}(
        orders,
        offerFulfillments,
        considerationFulfillments,
        fulfillerConduitKey,
        maximumFulfilled
    );
}
```

## 📚 Additional Resources

### Useful Libraries
- `OrderComponentsLib`: Helper library for creating OrderComponents
- `OfferItemLib`: Helper library for creating OfferItems
- `ConsiderationItemLib`: Helper library for creating ConsiderationItems
- `SeaportArrays`: Helper library for creating arrays of Seaport structs

### Testing Utilities
```solidity
// Test helper for creating orders
function createTestOrder(
    address offerer,
    address token,
    uint256 tokenId,
    uint256 price
) internal view returns (Order memory) {
    OrderComponents memory components = createListingWithRoyalties(
        token, tokenId, price, offerer, 0
    );
    
    return Order({
        parameters: components,
        signature: ""
    });
}
```

### Error Handling
```solidity
// Common Seaport errors to handle
error OrderNotAvailable();
error OrderExpired();
error OrderNotValid();
error InsufficientBalance();
error InvalidSignature();
error ReentrancyGuard();
```

This cheatsheet provides all the essential information needed to work directly with Seaport contracts for your Such.Market integration. Use these patterns as building blocks for your marketplace functionality! 