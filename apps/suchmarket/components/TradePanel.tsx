'use client'

import { useMemo, useState } from 'react'
import { Address, parseEther } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useBuyQuote } from '@/hooks/useBuyQuote'
import { useSellQuote } from '@/hooks/useSellQuote'
import { usePoolData } from '@/hooks/usePoolData'
import {
  buildBuyBreakdown,
  buildSellBreakdown,
  formatEth,
} from '@/lib/quotes'
import { LSSVM_ROUTER_ABI, getRouterAddress, CurveError } from '@/lib/contracts'
import { TransactionStatus } from '@/components/TransactionStatus'
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/trader-defaults'

interface TradePanelProps {
  chainId: number
  poolAddress: Address
  isERC1155?: boolean
  poolNftId?: bigint | null
}

export function TradePanel({ chainId, poolAddress, isERC1155, poolNftId }: TradePanelProps) {
  const { address } = useAccount()
  const { data: pool } = usePoolData(poolAddress, chainId)
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')
  const [qty, setQty] = useState(1)
  const [tokenIds, setTokenIds] = useState('')
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS)
  const [buyMode, setBuyMode] = useState<'specific' | 'any'>('any')

  const assetId = isERC1155 ? poolNftId ?? 0n : 0n
  const numItems = mode === 'buy' ? qty : tokenIds.split(/[,\s]+/).filter(Boolean).length || qty

  const { data: buyQuote } = useBuyQuote(
    mode === 'buy' ? poolAddress : undefined,
    assetId,
    Math.max(1, qty),
    chainId
  )
  const { data: sellQuote } = useSellQuote(
    mode === 'sell' ? poolAddress : undefined,
    assetId,
    Math.max(1, numItems),
    chainId
  )

  const quote = mode === 'buy' ? buyQuote : sellQuote
  const breakdown = useMemo(() => {
    if (mode === 'buy') {
      if (!buyQuote || buyQuote.error !== CurveError.OK) return null
      return buildBuyBreakdown(
        buyQuote.inputAmount,
        buyQuote.protocolFee,
        buyQuote.royaltyAmount,
        slippageBps
      )
    }
    if (!sellQuote || sellQuote.error !== CurveError.OK) return null
    return buildSellBreakdown(
      sellQuote.outputAmount,
      sellQuote.protocolFee,
      sellQuote.royaltyAmount,
      slippageBps
    )
  }, [buyQuote, sellQuote, mode, slippageBps])

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const canTradeBuy = pool && (pool.poolType === 1 || pool.poolType === 2)
  const canTradeSell = pool && (pool.poolType === 0 || pool.poolType === 2)

  const onSubmit = async () => {
    if (!address || !quote || quote.error !== CurveError.OK || !breakdown) return
    const router = getRouterAddress(chainId)

    if (mode === 'buy') {
      // Use pair swap for specific NFTs when IDs provided; else router partial fill path is complex —
      // for MVP call pair via router swapETHForSpecificNFTs when IDs given.
      const ids = tokenIds
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((id) => BigInt(id))

      if (isERC1155) {
        writeContract({
          address: poolAddress,
          abi: [
            {
              inputs: [
                { name: 'numNFTs', type: 'uint256' },
                { name: 'maxExpectedTokenInput', type: 'uint256' },
                { name: 'nftRecipient', type: 'address' },
                { name: 'isRouter', type: 'bool' },
                { name: 'routerCaller', type: 'address' },
              ],
              name: 'swapTokenForAnyNFTs',
              outputs: [{ type: 'uint256' }],
              stateMutability: 'payable',
              type: 'function',
            },
          ],
          functionName: 'swapTokenForAnyNFTs',
          args: [BigInt(qty), breakdown.withSlippage, address, false, address],
          value: breakdown.withSlippage,
        })
        return
      }

      const pairBuyAbi = [
        {
          inputs: [
            { name: 'nftIds', type: 'uint256[]' },
            { name: 'maxExpectedTokenInput', type: 'uint256' },
            { name: 'nftRecipient', type: 'address' },
            { name: 'isRouter', type: 'bool' },
            { name: 'routerCaller', type: 'address' },
          ],
          name: 'swapTokenForSpecificNFTs',
          outputs: [{ type: 'uint256' }],
          stateMutability: 'payable',
          type: 'function',
        },
        {
          inputs: [
            { name: 'numNFTs', type: 'uint256' },
            { name: 'maxExpectedTokenInput', type: 'uint256' },
            { name: 'nftRecipient', type: 'address' },
            { name: 'isRouter', type: 'bool' },
            { name: 'routerCaller', type: 'address' },
          ],
          name: 'swapTokenForAnyNFTs',
          outputs: [{ type: 'uint256' }],
          stateMutability: 'payable',
          type: 'function',
        },
      ] as const

      if (buyMode === 'any' || ids.length === 0) {
        writeContract({
          address: poolAddress,
          abi: pairBuyAbi,
          functionName: 'swapTokenForAnyNFTs',
          args: [BigInt(qty), breakdown.withSlippage, address, false, address],
          value: breakdown.withSlippage,
        })
        return
      }

      writeContract({
        address: poolAddress,
        abi: pairBuyAbi,
        functionName: 'swapTokenForSpecificNFTs',
        args: [ids, breakdown.withSlippage, address, false, address],
        value: breakdown.withSlippage,
      })
      return
    }

    // Sell path — requires prior setApprovalForAll to pool/router
    const ids = tokenIds
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((id) => BigInt(id))
    if (ids.length === 0 && !isERC1155) {
      alert('Enter NFT token IDs to sell')
      return
    }

    writeContract({
      address: poolAddress,
      abi: [
        {
          inputs: [
            { name: 'nftIds', type: 'uint256[]' },
            { name: 'minExpectedTokenOutput', type: 'uint256' },
            { name: 'tokenRecipient', type: 'address' },
            { name: 'isRouter', type: 'bool' },
            { name: 'routerCaller', type: 'address' },
          ],
          name: 'swapNFTsForToken',
          outputs: [{ type: 'uint256' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'swapNFTsForToken',
      args: [
        isERC1155 ? [] : ids,
        breakdown.withSlippage,
        address,
        false,
        address,
      ],
    })

    void router
    void parseEther
    void LSSVM_ROUTER_ABI
  }

  return (
    <div className="sm-card p-5 space-y-5 shadow-play">
      <div className="flex rounded-xl border-2 border-line p-0.5 bg-mist/50">
        <button
          type="button"
          disabled={!canTradeBuy}
          onClick={() => setMode('buy')}
          className={`flex-1 rounded-xl py-2 text-sm ${
            mode === 'buy' ? 'bg-white shadow-sm text-orange-deep font-medium' : 'text-mute'
          } disabled:opacity-30`}
        >
          Buy
        </button>
        <button
          type="button"
          disabled={!canTradeSell}
          onClick={() => setMode('sell')}
          className={`flex-1 rounded-xl py-2 text-sm ${
            mode === 'sell' ? 'bg-white shadow-sm text-sky-deep font-medium' : 'text-mute'
          } disabled:opacity-30`}
        >
          Sell
        </button>
      </div>

      <div>
        <label className="sm-label">Quantity</label>
        <input
          type="number"
          min={1}
          className="sm-input"
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
        />
      </div>

      {!isERC1155 && mode === 'buy' && (
        <div>
          <label className="sm-label">Buy mode (ERC-721)</label>
          <div className="flex rounded-xl border-2 border-line p-0.5 bg-mist/50 mb-3">
            <button
              type="button"
              onClick={() => setBuyMode('any')}
              className={`flex-1 rounded-lg py-1.5 text-xs ${
                buyMode === 'any' ? 'bg-white shadow-sm font-medium' : 'text-mute'
              }`}
            >
              Any {qty} NFT{qty > 1 ? 's' : ''}
            </button>
            <button
              type="button"
              onClick={() => setBuyMode('specific')}
              className={`flex-1 rounded-lg py-1.5 text-xs ${
                buyMode === 'specific' ? 'bg-white shadow-sm font-medium' : 'text-mute'
              }`}
            >
              Specific IDs
            </button>
          </div>
        </div>
      )}

      {!isERC1155 && (mode === 'sell' || buyMode === 'specific') && (
        <div>
          <label className="sm-label">Token IDs (comma-separated)</label>
          <input
            className="sm-input font-mono text-xs"
            placeholder="1, 2, 3"
            value={tokenIds}
            onChange={(e) => setTokenIds(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="sm-label">Slippage (bps)</label>
        <input
          type="number"
          className="sm-input"
          value={slippageBps}
          onChange={(e) => setSlippageBps(parseInt(e.target.value || '100', 10))}
        />
      </div>

      {quote && quote.error !== CurveError.OK && (
        <p className="text-sm text-clay">Quote unavailable (curve error {quote.error}).</p>
      )}

      {breakdown && (
        <div className="rounded-lg bg-mist/80 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-mute">{mode === 'buy' ? 'You pay' : 'You receive'}</span>
            <span className="font-mono">{formatEth(breakdown.total)} ETH</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-soft">Protocol fee</span>
            <span className="font-mono">{formatEth(breakdown.protocolFee)} ETH</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-soft">Royalty</span>
            <span className="font-mono">{formatEth(breakdown.royaltyAmount)} ETH</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2">
            <span className="text-mute">
              With {slippageBps / 100}% slippage
            </span>
            <span className="font-mono font-medium">{formatEth(breakdown.withSlippage)} ETH</span>
          </div>
        </div>
      )}

      <button
        type="button"
        className="sm-btn-primary w-full"
        disabled={!address || !breakdown || isPending || confirming}
        onClick={onSubmit}
      >
        {!address
          ? 'Connect wallet to trade'
          : isPending || confirming
            ? 'Confirm in wallet…'
            : mode === 'buy'
              ? 'Buy on curve'
              : 'Sell to pool'}
      </button>

      {error && <p className="text-xs text-clay">{error.message}</p>}
      {hash && (
        <TransactionStatus
          status={
            isPending || confirming ? 'pending' : isSuccess ? 'success' : error ? 'error' : 'pending'
          }
          hash={hash}
          error={error ?? undefined}
        />
      )}

      <p className="text-[11px] text-soft leading-relaxed">
        ERC-721 buys support &ldquo;any N&rdquo; (pool picks inventory) or specific token IDs. Selling
        requires approving the pool for your NFTs first.
      </p>
    </div>
  )
}
