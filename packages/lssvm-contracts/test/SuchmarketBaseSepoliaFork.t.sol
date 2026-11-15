// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC20} from "solmate/tokens/ERC20.sol";

import {LSSVMPair} from "../src/LSSVMPair.sol";
import {LSSVMPairFactory} from "../src/LSSVMPairFactory.sol";
import {LSSVMRouter} from "../src/LSSVMRouter.sol";
import {VeryFastRouter} from "../src/VeryFastRouter.sol";
import {CurveErrorCodes} from "../src/bonding-curves/CurveErrorCodes.sol";
import {ICurve} from "../src/bonding-curves/ICurve.sol";
import {LSSVMPairERC721ETH} from "../src/erc721/LSSVMPairERC721ETH.sol";
import {LSSVMPairERC1155ETH} from "../src/erc1155/LSSVMPairERC1155ETH.sol";

/// @notice End-to-end spike against live Base Sepolia deployment (no broadcast, fork-only).
contract SuchmarketBaseSepoliaForkTest is Test {
  address constant FACTORY = 0x372990Fd91CF61967325dD5270f50c4192bfb892;
  address constant ROUTER = 0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3;
  address constant LINEAR = 0x3F1E31d662eD24b6B69d73B07C98076d3814F8C0;
  address constant EXPONENTIAL = 0x4637d06530d5D375B1D5dE1117C98b0c6EA7eDd1;
  address constant NFT721 = 0xF130207fbE0913b5470732D25699E41F5Ea4da7f;
  address constant NFT1155 = 0x68f397655a5a1478e24Bdb52D0Df33e50AB6Ce28;
  address constant DEPLOYER = 0x6dA173B1d50F7Bc5c686f8880C20378965408344;

  uint256 constant SLIPPAGE = 1e8; // 1e10% scaled as in VFR tests (small epsilon)
  uint128 constant SPOT = 0.002 ether;
  uint128 constant LINEAR_DELTA = 0.0001 ether;
  uint128 constant EXP_DELTA = 1_050_000_000_000_000_000; // > 1e18 for exponential curve
  uint96 constant FEE = 0.01 ether; // 1%

  LSSVMPairFactory factory;
  VeryFastRouter router;
  function setUp() public {
    vm.createSelectFork("base_sepolia");
    factory = LSSVMPairFactory(payable(FACTORY));
    router = VeryFastRouter(payable(ROUTER));

    assertTrue(address(factory).code.length > 0, "factory bytecode");
    assertTrue(factory.bondingCurveAllowed(ICurve(LINEAR)), "linear whitelisted");
    assertTrue(factory.bondingCurveAllowed(ICurve(EXPONENTIAL)), "exp whitelisted");
    assertTrue(factory.bondingCurveAllowed(ICurve(0xC4DfB54Ca18c9e5EC2a23e8DE09588982A6b2242)), "xyk");
    assertTrue(factory.bondingCurveAllowed(ICurve(0x60bAB2734eb85F07Ca93E3B7Fb1015fcc5e9CbA7)), "gda");
    (bool routerOk,) = factory.routerStatus(LSSVMRouter(payable(address(router))));
    assertTrue(routerOk, "router whitelisted");
  }

  function _approve721(uint256[] memory ids) internal {
    vm.startPrank(DEPLOYER);
    IERC721(NFT721).setApprovalForAll(FACTORY, true);
    vm.stopPrank();
  }

  function _create721Pool(
    address curve,
    uint256[] memory depositIds,
    uint128 delta
  ) internal returns (LSSVMPair pair) {
    _approve721(depositIds);
    vm.startPrank(DEPLOYER);
    LSSVMPairERC721ETH created = factory.createPairERC721ETH(
      IERC721(NFT721),
      ICurve(curve),
      payable(address(0)),
      LSSVMPair.PoolType.TRADE,
      delta,
      FEE,
      SPOT,
      address(0),
      depositIds
    );
    pair = LSSVMPair(payable(address(created)));
    vm.stopPrank();
  }

  function _routerBuy721(LSSVMPair pair, uint256[] memory nftIds, address buyer) internal {
    (,,, uint256 inputAmount,,) = pair.getBuyNFTQuote(0, nftIds.length);
    uint256[] memory maxCosts =
      router.getNFTQuoteForBuyOrderWithPartialFill(pair, nftIds.length, SLIPPAGE, 0);

    VeryFastRouter.BuyOrderWithPartialFill[] memory buys = new VeryFastRouter.BuyOrderWithPartialFill[](1);
    buys[0] = VeryFastRouter.BuyOrderWithPartialFill({
      pair: pair,
      isERC721: true,
      nftIds: nftIds,
      maxInputAmount: inputAmount,
      ethAmount: inputAmount,
      expectedSpotPrice: pair.spotPrice(),
      maxCostPerNumNFTs: maxCosts
    });

    VeryFastRouter.Order memory order = VeryFastRouter.Order({
      buyOrders: buys,
      sellOrders: new VeryFastRouter.SellOrderWithPartialFill[](0),
      tokenRecipient: payable(buyer),
      nftRecipient: buyer,
      recycleETH: false
    });

    vm.deal(buyer, 10 ether);
    vm.prank(buyer);
    router.swap{value: inputAmount}(order);
  }

  function test_linear_pool_buySpecificAndAnyStyle_viaRouter() public {
    uint256[] memory deposit = new uint256[](3);
    deposit[0] = 90;
    deposit[1] = 91;
    deposit[2] = 92;

    LSSVMPair pair = _create721Pool(LINEAR, deposit, LINEAR_DELTA);
    assertEq(IERC721(NFT721).ownerOf(90), address(pair));

    address buyer = makeAddr("buyer");
    uint256[] memory oneId = new uint256[](1);
    oneId[0] = 90;
    _routerBuy721(pair, oneId, buyer);
    assertEq(IERC721(NFT721).ownerOf(90), buyer);

    // "Any one" via router: pass remaining inventory ids (buyer already holds 90).
    uint256[] memory remaining = new uint256[](2);
    remaining[0] = 91;
    remaining[1] = 92;
    _routerBuy721(pair, remaining, buyer);
    assertTrue(IERC721(NFT721).ownerOf(91) == buyer || IERC721(NFT721).ownerOf(92) == buyer);
  }

  function test_exponential_pool_sellBack_viaRouter() public {
    uint256[] memory deposit = new uint256[](2);
    deposit[0] = 93;
    deposit[1] = 94;
    LSSVMPair pair = _create721Pool(EXPONENTIAL, deposit, EXP_DELTA);

    address buyer = makeAddr("buyer2");
    uint256[] memory oneId = new uint256[](1);
    oneId[0] = 93;
    _routerBuy721(pair, oneId, buyer);

    (CurveErrorCodes.Error err,,, uint256 outputAmount, uint256 protocolFee, uint256 royaltyAmount) =
      pair.getSellNFTQuote(0, 1);

    assertEq(uint256(err), uint256(CurveErrorCodes.Error.OK));
    assertGt(outputAmount, 0);

    vm.startPrank(buyer);
    IERC721(NFT721).setApprovalForAll(address(router), true);

    uint256[] memory sellIds = new uint256[](1);
    sellIds[0] = 93;

    VeryFastRouter.SellOrderWithPartialFill[] memory sells = new VeryFastRouter.SellOrderWithPartialFill[](1);
    sells[0] = VeryFastRouter.SellOrderWithPartialFill({
      pair: pair,
      isETHSell: true,
      isERC721: true,
      nftIds: sellIds,
      doPropertyCheck: false,
      propertyCheckParams: "",
      expectedSpotPrice: pair.spotPrice(),
      minExpectedOutput: outputAmount,
      minExpectedOutputPerNumNFTs: new uint256[](0)
    });

    VeryFastRouter.Order memory order = VeryFastRouter.Order({
      buyOrders: new VeryFastRouter.BuyOrderWithPartialFill[](0),
      sellOrders: sells,
      tokenRecipient: payable(buyer),
      nftRecipient: buyer,
      recycleETH: false
    });

    uint256 balBefore = buyer.balance;
    router.swap(order);
    vm.stopPrank();

    assertGt(buyer.balance, balBefore);
    assertEq(IERC721(NFT721).ownerOf(93), address(pair));
    emit log_named_uint("sell_output", buyer.balance - balBefore);
    emit log_named_uint("quote_output", outputAmount);
    emit log_named_uint("protocolFee_from_quote", protocolFee);
    emit log_named_uint("royalty_from_quote", royaltyAmount);
  }

  function test_erc1155_eth_pool_buyOne() public {
    vm.startPrank(DEPLOYER);
    IERC1155(NFT1155).setApprovalForAll(FACTORY, true);
    LSSVMPairERC1155ETH created1155 = factory.createPairERC1155ETH(
      IERC1155(NFT1155),
      ICurve(LINEAR),
      payable(address(0)),
      LSSVMPair.PoolType.TRADE,
      LINEAR_DELTA,
      FEE,
      SPOT,
      0,
      5
    );
    LSSVMPair pair = LSSVMPair(payable(address(created1155)));
    vm.stopPrank();

    address buyer = makeAddr("buyer1155");
    uint256[] memory amt = new uint256[](1);
    amt[0] = 1;
    _routerBuy721(pair, amt, buyer);
    assertEq(IERC1155(NFT1155).balanceOf(buyer, 0), 1);
  }

  function test_erc721_erc20_pool_quoteAndFees() public {
    MintableERC20 token = new MintableERC20();
    token.mint(DEPLOYER, 100 ether);

    uint256[] memory deposit = new uint256[](1);
    deposit[0] = 95;

    vm.startPrank(DEPLOYER);
    IERC721(NFT721).setApprovalForAll(FACTORY, true);
    token.approve(FACTORY, type(uint256).max);

    LSSVMPair pair = LSSVMPair(
      payable(
        address(
          factory.createPairERC721ERC20(
            LSSVMPairFactory.CreateERC721ERC20PairParams({
              token: ERC20(address(token)),
              nft: IERC721(NFT721),
              bondingCurve: ICurve(LINEAR),
              assetRecipient: payable(address(0)),
              poolType: LSSVMPair.PoolType.TRADE,
              delta: LINEAR_DELTA,
              fee: FEE,
              spotPrice: SPOT,
              propertyChecker: address(0),
              initialNFTIDs: deposit,
              initialTokenBalance: 1 ether
            })
          )
        )
      )
    );
    vm.stopPrank();

    (CurveErrorCodes.Error err,,, uint256 inputAmount, uint256 protocolFee, uint256 royaltyAmount) =
      pair.getBuyNFTQuote(0, 1);
    assertEq(uint256(err), uint256(CurveErrorCodes.Error.OK));
    assertGt(inputAmount, 0);
    emit log_named_uint("erc20_buy_input", inputAmount);
    emit log_named_uint("erc20_protocol_fee", protocolFee);
    emit log_named_uint("erc20_royalty", royaltyAmount);
  }
}

contract MintableERC20 is ERC20 {
  constructor() ERC20("Spike20", "SPK", 18) {}
  function mint(address to, uint256 amount) external { _mint(to, amount); }
}
