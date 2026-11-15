'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Address, parseEther, isAddress } from 'viem'
import Link from 'next/link'
import { useAppChain } from '@/contexts/ChainContext'
import { PoolListCard, PoolListItem } from '@/components/PoolListCard'
import { WalletButton } from '@/components/WalletButton'
import { PAIR_MANAGE_ABI, FACTORY_DEPOSIT_ABI } from '@/lib/pairManage'
import { getFactoryAddress } from '@/lib/contracts'
import { getChainName } from '@/lib/chains'

async function fetchOwnerPools(chainId: number, owner: string) {
  const params = new URLSearchParams({
    chainId: String(chainId),
    owner,
    lookback: '500000',
  })
  const res = await fetch(`/api/pools?${params}`)
  if (!res.ok) throw new Error('Failed to load pools')
  return res.json() as Promise<{ pools: PoolListItem[] }>
}

export default function MyPoolsPage() {
  const { address, isConnected } = useAccount()
  const { chainId } = useAppChain()
  const [selected, setSelected] = useState<string | null>(null)
  const [spot, setSpot] = useState('')
  const [delta, setDelta] = useState('')
  const [fee, setFee] = useState('')
  const [depositIds, setDepositIds] = useState('')
  const [nftForDeposit, setNftForDeposit] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['myPools', chainId, address],
    queryFn: () => fetchOwnerPools(chainId, address!),
    enabled: !!address,
  })

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  if (!isConnected || !address) {
    return (
      <div className="sm-band-orange min-h-full">
      <div className="sm-container py-16 max-w-md text-center space-y-4">
        <h1 className="sm-heading text-3xl">My pools</h1>
        <p className="text-sm text-mute">Connect your wallet to manage pools you own.</p>
        <div className="flex justify-center">
          <WalletButton />
        </div>
      </div>
      </div>
    )
  }

  const manage = selected as Address | null

  return (
    <div className="sm-band-orange min-h-full">
    <div className="sm-container py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="sm-heading text-3xl">My pools</h1>
          <p className="mt-2 text-sm text-mute">
            Manage liquidity on {getChainName(chainId)} — change price, fees, deposit or withdraw.
          </p>
        </div>
        <button type="button" className="sm-btn-ghost text-xs" onClick={() => refetch()}>
          Refresh
        </button>
      </header>

      {isLoading ? (
        <p className="text-sm text-mute">Loading your pools…</p>
      ) : error ? (
        <p className="text-sm text-clay">{(error as Error).message}</p>
      ) : !data?.pools?.length ? (
        <div className="sm-card p-8 text-center">
          <p className="text-mute text-sm">No pools found for this wallet in the recent range.</p>
          <Link href="/create" className="sm-btn-primary inline-flex mt-4">
            Create a pool
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4">
            {data.pools.map((pool) => (
              <div key={pool.poolAddress} className="relative">
                <PoolListCard pool={pool} chainId={chainId} />
                <button
                  type="button"
                  className="absolute top-3 right-3 sm-chip bg-white hover:border-ink"
                  onClick={() => {
                    setSelected(pool.poolAddress)
                    setSpot('')
                    setDelta('')
                    setFee('')
                    setNftForDeposit(pool.nft)
                  }}
                >
                  Manage
                </button>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            <div className="sm-card p-5 space-y-4 sticky top-20">
              <h2 className="sm-heading text-xl">Manage</h2>
              {!manage ? (
                <p className="text-sm text-mute">Select a pool to change parameters or liquidity.</p>
              ) : (
                <>
                  <p className="font-mono text-[11px] text-soft break-all">{manage}</p>

                  <div>
                    <label className="sm-label">New spot price (ETH)</label>
                    <input className="sm-input" value={spot} onChange={(e) => setSpot(e.target.value)} />
                    <button
                      type="button"
                      className="sm-btn-secondary w-full mt-2"
                      disabled={!spot || isPending}
                      onClick={() =>
                        writeContract({
                          address: manage,
                          abi: PAIR_MANAGE_ABI,
                          functionName: 'changeSpotPrice',
                          args: [parseEther(spot)],
                        })
                      }
                    >
                      Update spot
                    </button>
                  </div>

                  <div>
                    <label className="sm-label">New delta (ETH)</label>
                    <input className="sm-input" value={delta} onChange={(e) => setDelta(e.target.value)} />
                    <button
                      type="button"
                      className="sm-btn-secondary w-full mt-2"
                      disabled={!delta || isPending}
                      onClick={() =>
                        writeContract({
                          address: manage,
                          abi: PAIR_MANAGE_ABI,
                          functionName: 'changeDelta',
                          args: [parseEther(delta)],
                        })
                      }
                    >
                      Update delta
                    </button>
                  </div>

                  <div>
                    <label className="sm-label">New fee (raw uint96)</label>
                    <input className="sm-input" value={fee} onChange={(e) => setFee(e.target.value)} />
                    <button
                      type="button"
                      className="sm-btn-secondary w-full mt-2"
                      disabled={!fee || isPending}
                      onClick={() =>
                        writeContract({
                          address: manage,
                          abi: PAIR_MANAGE_ABI,
                          functionName: 'changeFee',
                          args: [BigInt(fee)],
                        })
                      }
                    >
                      Update fee
                    </button>
                  </div>

                  <div className="border-t border-line pt-4 space-y-2">
                    <label className="sm-label">Deposit NFT IDs</label>
                    <input
                      className="sm-input font-mono text-xs"
                      placeholder="NFT contract"
                      value={nftForDeposit}
                      onChange={(e) => setNftForDeposit(e.target.value)}
                    />
                    <input
                      className="sm-input font-mono text-xs"
                      placeholder="1, 2, 3"
                      value={depositIds}
                      onChange={(e) => setDepositIds(e.target.value)}
                    />
                    <button
                      type="button"
                      className="sm-btn-primary w-full"
                      disabled={!depositIds || !isAddress(nftForDeposit) || isPending}
                      onClick={() => {
                        const ids = depositIds
                          .split(/[,\s]+/)
                          .filter(Boolean)
                          .map((x) => BigInt(x))
                        writeContract({
                          address: getFactoryAddress(chainId),
                          abi: FACTORY_DEPOSIT_ABI,
                          functionName: 'depositNFTs',
                          args: [nftForDeposit as Address, ids, manage],
                        })
                      }}
                    >
                      Deposit NFTs
                    </button>
                    <button
                      type="button"
                      className="sm-btn-ghost w-full text-xs"
                      disabled={isPending}
                      onClick={() =>
                        writeContract({
                          address: manage,
                          abi: PAIR_MANAGE_ABI,
                          functionName: 'withdrawETH',
                        })
                      }
                    >
                      Withdraw ETH
                    </button>
                  </div>

                  {writeError && <p className="text-xs text-clay">{writeError.message}</p>}
                  {hash && (
                    <p className="text-xs text-forest font-mono break-all">
                      Tx {hash.slice(0, 10)}… {isSuccess ? 'confirmed' : 'pending'}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
