'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Address, isAddress } from 'viem'
import { useAccount, useChainId, useReadContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { useAppChain } from '@/contexts/ChainContext'
import { isAuctionHouseEnabled } from '@/lib/chain-config'
import { getChainName, isSupportedChainId, type SupportedChainId } from '@/lib/chains'
import { getMarketplaceChainConfigs } from '@/lib/chain-config'
import { ERC721_ABI, ERC1155_ABI } from '@/lib/contracts'
import { getMarketplaceAddress } from '@/lib/marketplace'
import { detectNftStandard, verifyTokenOwnership } from '@/lib/nft-detect'
import { validateSellListingForm, type SellListingForm, type SellListingKind } from '@/lib/sell-listing'
import { getTxExplorerUrl } from '@/lib/explorer'
import { useCreateMarketplaceListing } from '@/hooks/useCreateMarketplaceListing'
import { UnverifiedCollectionWarning } from './UnverifiedCollectionWarning'
import { WalletButton } from '@/components/WalletButton'

type PickerNft = {
  tokenId: string
  name: string | null
  image: string | null
  balance?: string
}

type Step = 'type' | 'asset' | 'params' | 'review' | 'done'

const DURATION_PRESETS = [
  { label: '24 hours', seconds: 86_400 },
  { label: '3 days', seconds: 259_200 },
  { label: '7 days', seconds: 604_800 },
  { label: '14 days', seconds: 1_209_600 },
]

function listingDetailHref(chainId: number, listingId: string, kind: SellListingKind) {
  if (kind === 'auction') return `/auctions/${chainId}/${listingId}`
  return `/auctions/${chainId}/${listingId}?fixed=1`
}

export function SellFlow() {
  const searchParams = useSearchParams()
  const { chainId, setChainId } = useAppChain()
  const walletChainId = useChainId()
  const { address, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()

  const initialKind: SellListingKind | null =
    searchParams.get('type') === 'fixed' || searchParams.get('type') === 'fixed-price'
      ? 'fixed_price'
      : searchParams.get('type') === 'auction'
        ? 'auction'
        : null

  const [step, setStep] = useState<Step>(initialKind ? 'asset' : 'type')
  const [kind, setKind] = useState<SellListingKind>(initialKind ?? 'auction')
  const [nftContract, setNftContract] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [tokenStandard, setTokenStandard] = useState<'ERC721' | 'ERC1155'>('ERC721')
  const [pickerMode, setPickerMode] = useState<'indexer' | 'manual'>('indexer')
  const [price, setPrice] = useState('')
  const [paymentToken, setPaymentToken] = useState<'ETH' | 'ERC20'>('ETH')
  const [erc20Address, setErc20Address] = useState('')
  const [erc20Decimals, setErc20Decimals] = useState('18')
  const [timingMode, setTimingMode] = useState<SellListingForm['timingMode']>('on_first_bid')
  const [durationSeconds, setDurationSeconds] = useState(604_800)
  const [minIncrementBps, setMinIncrementBps] = useState('500')
  const [totalAvailable, setTotalAvailable] = useState('1')
  const [totalPerSale, setTotalPerSale] = useState('1')
  const [formError, setFormError] = useState<string | null>(null)

  const marketplaceEnabled = isAuctionHouseEnabled(chainId)
  const marketplaceChains = getMarketplaceChainConfigs().map((c) => c.id)

  const listingHook = useCreateMarketplaceListing(chainId)

  let marketplaceAddress: Address | null = null
  try {
    marketplaceAddress = marketplaceEnabled ? getMarketplaceAddress(chainId) : null
  } catch {
    marketplaceAddress = null
  }

  const contractValid = isAddress(nftContract)
  const contractAddress = contractValid ? (nftContract as Address) : undefined

  const { data: ownedNfts, isLoading: loadingNfts, error: nftsError } = useQuery({
    queryKey: ['sell-owned-nfts', chainId, address, nftContract],
    queryFn: async (): Promise<{ nfts: PickerNft[]; source: string; message?: string }> => {
      if (!address || !contractValid) return { nfts: [], source: 'manual' }
      const res = await fetch(
        `/api/nfts/for-owner?owner=${encodeURIComponent(address)}&contractAddress=${encodeURIComponent(nftContract)}&chainId=${chainId}`
      )
      return res.json()
    },
    enabled: !!address && contractValid && pickerMode === 'indexer',
    staleTime: 30_000,
  })

  const { data: detectedStandard } = useQuery({
    queryKey: ['detect-nft-standard', chainId, nftContract],
    queryFn: async () => {
      if (!contractValid) return 'UNKNOWN' as const
      return detectNftStandard(chainId, nftContract as Address)
    },
    enabled: contractValid,
  })

  useEffect(() => {
    if (detectedStandard === 'ERC1155') setTokenStandard('ERC1155')
    if (detectedStandard === 'ERC721') setTokenStandard('ERC721')
  }, [detectedStandard])

  const ownershipQuery = useQuery({
    queryKey: ['sell-ownership', chainId, address, nftContract, tokenId, tokenStandard],
    queryFn: async () => {
      if (!address || !contractValid || !tokenId.trim()) return false
      return verifyTokenOwnership(
        chainId,
        nftContract as Address,
        BigInt(tokenId),
        address,
        tokenStandard
      )
    },
    enabled: !!address && contractValid && !!tokenId.trim(),
  })

  const { data: isApprovedForAll, refetch: refetchApprovalForAll } = useReadContract({
    address: contractAddress,
    abi: tokenStandard === 'ERC1155' ? ERC1155_ABI : ERC721_ABI,
    functionName: 'isApprovedForAll',
    args: address && marketplaceAddress ? [address, marketplaceAddress] : undefined,
    chainId,
    query: { enabled: !!address && !!contractAddress && !!marketplaceAddress },
  })

  const ERC721_APPROVAL_ABI = [
    {
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      name: 'getApproved',
      outputs: [{ type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const

  const { data: singleApproved, refetch: refetchSingleApproved } = useReadContract({
    address: contractAddress,
    abi: ERC721_APPROVAL_ABI,
    functionName: 'getApproved',
    args: tokenId.trim() ? [BigInt(tokenId)] : undefined,
    chainId,
    query: {
      enabled: tokenStandard === 'ERC721' && !!contractAddress && !!tokenId.trim(),
    },
  })

  const {
    writeContract: writeApproval,
    data: approvalHash,
    isPending: isApproving,
    error: approvalWriteError,
  } = useWriteContract()

  const { isSuccess: approvalConfirmed, isLoading: approvalConfirming } = useWaitForTransactionReceipt({
    hash: approvalHash,
  })

  useEffect(() => {
    if (approvalConfirmed) {
      refetchApprovalForAll()
      refetchSingleApproved()
    }
  }, [approvalConfirmed, refetchApprovalForAll, refetchSingleApproved])

  const isApproved = useMemo(() => {
    if (approvalConfirmed) return true
    if (isApprovedForAll === true) return true
    if (
      tokenStandard === 'ERC721' &&
      marketplaceAddress &&
      typeof singleApproved === 'string' &&
      (singleApproved as string).toLowerCase() === marketplaceAddress.toLowerCase()
    ) {
      return true
    }
    return false
  }, [approvalConfirmed, isApprovedForAll, marketplaceAddress, singleApproved, tokenStandard])

  const buildForm = (): SellListingForm => ({
    kind,
    price,
    paymentToken,
    erc20Address: paymentToken === 'ERC20' ? erc20Address : undefined,
    erc20Decimals: paymentToken === 'ERC20' ? Number(erc20Decimals) : undefined,
    timingMode,
    durationSeconds,
    minIncrementBps: Number(minIncrementBps),
    totalAvailable: Number(totalAvailable),
    totalPerSale: Number(totalPerSale),
    tokenId,
    tokenStandard,
    nftContract,
  })

  const wrongNetwork = isConnected && walletChainId !== chainId

  const handleApprove = () => {
    if (!contractAddress || !marketplaceAddress || !address) return
    if (tokenStandard === 'ERC721') {
      writeApproval({
        address: contractAddress,
        abi: ERC721_ABI,
        functionName: 'approve',
        args: [marketplaceAddress, BigInt(tokenId)],
        chainId,
      })
    } else {
      writeApproval({
        address: contractAddress,
        abi: ERC1155_ABI,
        functionName: 'setApprovalForAll',
        args: [marketplaceAddress, true],
        chainId,
      })
    }
  }

  const handleSubmitListing = () => {
    setFormError(null)
    const form = buildForm()
    const validation = validateSellListingForm(form)
    if (!validation.ok) {
      setFormError(validation.message)
      return
    }
    if (!ownershipQuery.data) {
      setFormError('You do not appear to own this token on the selected chain.')
      return
    }
    if (!isApproved) {
      setFormError('Approve the marketplace before creating the listing.')
      return
    }
    if (wrongNetwork) {
      setFormError(`Switch your wallet to ${getChainName(chainId)}.`)
      return
    }
    listingHook.createListing(form)
  }

  useEffect(() => {
    if (listingHook.isSuccess && listingHook.listingId) {
      setStep('done')
    }
  }, [listingHook.isSuccess, listingHook.listingId])

  if (!marketplaceEnabled) {
    return (
      <div className="sm-card p-6 mt-8 space-y-3">
        <p className="sm-heading text-lg">Listing not available on this chain</p>
        <p className="text-sm text-mute leading-relaxed">
          {getChainName(chainId)} does not have a marketplace contract configured. Auction and fixed-price
          listings require an on-chain auction house address. Switch to a supported network
          {marketplaceChains.length > 0 && (
            <>
              {' '}
              (
              {marketplaceChains.map((id) => getChainName(id)).join(', ')})
            </>
          )}
          .
        </p>
        {marketplaceChains.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {marketplaceChains.filter((id): id is SupportedChainId => isSupportedChainId(id)).map((id) => (
              <button
                key={id}
                type="button"
                className="sm-btn-secondary text-sm"
                onClick={() => setChainId(id)}
              >
                Use {getChainName(id)}
              </button>
            ))}
          </div>
        )}
        <Link href="/create" className="inline-block text-sm text-sky-deep hover:underline mt-4">
          Create an LSSVM pool instead →
        </Link>
      </div>
    )
  }

  if (step === 'done' && listingHook.listingId) {
    const href = listingDetailHref(chainId, listingHook.listingId.toString(), kind)
    return (
      <div className="sm-card p-6 mt-8 space-y-4">
        <p className="sm-play text-sm text-sky-deep">Listing live</p>
        <h2 className="sm-heading text-2xl">Your listing was created</h2>
        <p className="text-sm text-mute">
          Listing ID <span className="font-mono text-ink">{listingHook.listingId.toString()}</span> on{' '}
          {getChainName(chainId)}.
        </p>
        {listingHook.txHash && (
          <a
            href={getTxExplorerUrl(chainId, listingHook.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-sky-deep hover:underline"
          >
            View transaction
          </a>
        )}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href={href} className="sm-btn-primary">
            View listing
          </Link>
          <Link href="/auctions" className="sm-btn-secondary">
            Browse auctions
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-6">
      {!isConnected && (
        <div className="sm-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-mute">Connect a wallet to list NFTs you own.</p>
          <WalletButton />
        </div>
      )}

      {step === 'type' && (
        <div className="sm-card p-6 space-y-4">
          <p className="text-sm text-mute">Choose listing type on {getChainName(chainId)}.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="sm-choice sm-choice-active text-left p-4"
              onClick={() => {
                setKind('auction')
                setStep('asset')
              }}
            >
              <p className="sm-heading text-base">Timed auction</p>
              <p className="mt-1 text-xs text-mute">English auction with reserve and optional start-on-first-bid.</p>
            </button>
            <button
              type="button"
              className="sm-choice text-left p-4"
              onClick={() => {
                setKind('fixed_price')
                setStep('asset')
              }}
            >
              <p className="sm-heading text-base">Fixed price</p>
              <p className="mt-1 text-xs text-mute">Set an ask; buyers purchase from the marketplace contract.</p>
            </button>
          </div>
        </div>
      )}

      {step !== 'type' && (
        <div className="flex flex-wrap gap-2 text-xs sm-play uppercase tracking-wider text-soft">
          <StepPill label="Asset" active={step === 'asset'} done={step !== 'asset'} />
          <StepPill label="Terms" active={step === 'params'} done={step === 'review' || step === 'done'} />
          <StepPill label="Review" active={step === 'review'} />
        </div>
      )}

      {step === 'asset' && (
        <div className="sm-card p-6 space-y-5">
          <KindSummary kind={kind} onChangeKind={() => setStep('type')} />

          <FormField label="Collection contract">
            <input
              className="sm-input w-full font-mono text-sm"
              value={nftContract}
              onChange={(e) => setNftContract(e.target.value.trim())}
              placeholder="0x…"
            />
          </FormField>

          {contractValid && <UnverifiedCollectionWarning chainId={chainId} contract={contractAddress} />}

          <FormField label="How to pick token">
            <div className="flex gap-2">
              <button
                type="button"
                className={`sm-choice flex-1 text-sm ${pickerMode === 'indexer' ? 'sm-choice-active' : ''}`}
                onClick={() => setPickerMode('indexer')}
              >
                Load my tokens
              </button>
              <button
                type="button"
                className={`sm-choice flex-1 text-sm ${pickerMode === 'manual' ? 'sm-choice-active' : ''}`}
                onClick={() => setPickerMode('manual')}
              >
                Manual ID
              </button>
            </div>
          </FormField>

          {pickerMode === 'indexer' && contractValid && isConnected && (
            <div className="space-y-2">
              {loadingNfts && <p className="text-xs text-mute">Loading your tokens…</p>}
              {nftsError && <p className="text-xs text-crimson">Failed to load tokens.</p>}
              {ownedNfts?.message && (
                <p className="text-xs text-mute">{ownedNfts.message}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                {(ownedNfts?.nfts ?? []).map((nft) => (
                  <button
                    key={nft.tokenId}
                    type="button"
                    onClick={() => {
                      setTokenId(nft.tokenId)
                      if (nft.balance && Number(nft.balance) > 1) {
                        setTokenStandard('ERC1155')
                        setTotalAvailable(nft.balance)
                      }
                    }}
                    className={`rounded-lg border-2 p-2 text-left text-xs transition ${
                      tokenId === nft.tokenId ? 'border-sky-deep bg-mist/40' : 'border-line'
                    }`}
                  >
                    {nft.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={nft.image} alt="" className="w-full aspect-square object-cover rounded mb-1" />
                    ) : (
                      <div className="aspect-square bg-mist rounded mb-1 grid place-items-center text-soft">#</div>
                    )}
                    <p className="truncate font-mono">#{nft.tokenId}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(pickerMode === 'manual' || tokenId) && (
            <FormField label="Token ID">
              <input
                className="sm-input w-full font-mono text-sm"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value.trim())}
                placeholder="0"
              />
            </FormField>
          )}

          <FormField label="Token standard">
            <div className="flex gap-2">
              {(['ERC721', 'ERC1155'] as const).map((std) => (
                <button
                  key={std}
                  type="button"
                  className={`sm-choice flex-1 text-sm ${tokenStandard === std ? 'sm-choice-active' : ''}`}
                  onClick={() => setTokenStandard(std)}
                >
                  {std}
                </button>
              ))}
            </div>
            {detectedStandard && detectedStandard !== 'UNKNOWN' && (
              <p className="text-[11px] text-soft mt-1">Detected on-chain: {detectedStandard}</p>
            )}
          </FormField>

          {tokenId && ownershipQuery.data === false && (
            <p className="text-xs text-crimson">This wallet does not own token {tokenId} in this collection.</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="sm-btn-primary"
              disabled={!contractValid || !tokenId || ownershipQuery.data !== true}
              onClick={() => setStep('params')}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'params' && (
        <div className="sm-card p-6 space-y-5">
          <KindSummary kind={kind} onChangeKind={() => setStep('type')} />
          <p className="text-xs font-mono text-mute break-all">
            {nftContract} · token {tokenId}
          </p>

          <FormField label={kind === 'auction' ? 'Reserve price' : 'Price'}>
            <input className="sm-input w-full" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.1" />
          </FormField>

          <FormField label="Payment token">
            <div className="flex gap-2">
              <button
                type="button"
                className={`sm-choice flex-1 text-sm ${paymentToken === 'ETH' ? 'sm-choice-active' : ''}`}
                onClick={() => setPaymentToken('ETH')}
              >
                ETH
              </button>
              <button
                type="button"
                className={`sm-choice flex-1 text-sm ${paymentToken === 'ERC20' ? 'sm-choice-active' : ''}`}
                onClick={() => setPaymentToken('ERC20')}
              >
                ERC-20
              </button>
            </div>
          </FormField>

          {paymentToken === 'ERC20' && (
            <>
              <FormField label="ERC-20 contract">
                <input
                  className="sm-input w-full font-mono text-sm"
                  value={erc20Address}
                  onChange={(e) => setErc20Address(e.target.value.trim())}
                  placeholder="0x…"
                />
              </FormField>
              <FormField label="Decimals">
                <input
                  className="sm-input w-full"
                  value={erc20Decimals}
                  onChange={(e) => setErc20Decimals(e.target.value)}
                />
              </FormField>
            </>
          )}

          {kind === 'auction' && (
            <>
              <FormField label="Auction timing">
                <select
                  className="sm-input w-full"
                  value={timingMode}
                  onChange={(e) => setTimingMode(e.target.value as SellListingForm['timingMode'])}
                >
                  <option value="on_first_bid">Start on first bid (duration from first bid)</option>
                  <option value="now">Start now</option>
                </select>
              </FormField>
              <FormField label="Duration">
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.seconds}
                      type="button"
                      className={`sm-choice text-xs ${durationSeconds === p.seconds ? 'sm-choice-active' : ''}`}
                      onClick={() => setDurationSeconds(p.seconds)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="Min bid increment (bps)">
                <input
                  className="sm-input w-full"
                  value={minIncrementBps}
                  onChange={(e) => setMinIncrementBps(e.target.value)}
                />
                <p className="text-[11px] text-soft mt-1">500 = 5% minimum raise between bids.</p>
              </FormField>
            </>
          )}

          {kind === 'fixed_price' && tokenStandard === 'ERC1155' && (
            <>
              <FormField label="Total quantity for sale">
                <input
                  className="sm-input w-full"
                  value={totalAvailable}
                  onChange={(e) => setTotalAvailable(e.target.value)}
                />
              </FormField>
              <FormField label="Quantity per purchase">
                <input
                  className="sm-input w-full"
                  value={totalPerSale}
                  onChange={(e) => setTotalPerSale(e.target.value)}
                />
              </FormField>
            </>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <button type="button" className="sm-btn-secondary" onClick={() => setStep('asset')}>
              Back
            </button>
            <button type="button" className="sm-btn-primary" onClick={() => setStep('review')}>
              Review
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="sm-card p-6 space-y-5">
          <h2 className="sm-heading text-xl">Review & submit</h2>
          <ul className="text-sm text-mute space-y-1">
            <li>
              Type: <span className="text-ink">{kind === 'auction' ? 'Auction' : 'Fixed price'}</span>
            </li>
            <li>
              Asset:{' '}
              <span className="font-mono text-ink text-xs break-all">
                {nftContract} #{tokenId} ({tokenStandard})
              </span>
            </li>
            <li>
              Price: <span className="text-ink">{price} {paymentToken === 'ETH' ? 'ETH' : 'ERC-20'}</span>
            </li>
            <li>
              Chain: <span className="text-ink">{getChainName(chainId)}</span>
            </li>
          </ul>

          {wrongNetwork && (
            <SellStatusPanel
              title="Wrong network"
              body={`Your wallet is not on ${getChainName(chainId)}.`}
              action={
                <button
                  type="button"
                  className="sm-btn-secondary text-sm mt-2"
                  onClick={() => switchChain?.({ chainId })}
                >
                  Switch network
                </button>
              }
            />
          )}

          <div className="rounded-xl border border-line px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-ink">Marketplace approval</p>
            {isApproved ? (
              <p className="text-xs text-green-700">Approved — ready to list.</p>
            ) : (
              <>
                <p className="text-xs text-mute">
                  {tokenStandard === 'ERC721'
                    ? 'Approve this token for the marketplace (or setApprovalForAll on the collection).'
                    : 'Set approval for all on the collection for the marketplace.'}
                </p>
                <button
                  type="button"
                  className="sm-btn-secondary text-sm"
                  disabled={isApproving || approvalConfirming || wrongNetwork || !isConnected}
                  onClick={handleApprove}
                >
                  {isApproving || approvalConfirming ? 'Approving…' : 'Approve'}
                </button>
                {approvalWriteError && (
                  <p className="text-xs text-crimson">{approvalWriteError.message}</p>
                )}
              </>
            )}
          </div>

          {(formError || listingHook.error) && (
            <p className="text-sm text-crimson">{formError || listingHook.error}</p>
          )}

          {(listingHook.isSubmitting || listingHook.isConfirming) && (
            <SellStatusPanel title="Transaction pending" body="Confirm in your wallet and wait for confirmation…" />
          )}

          <div className="flex justify-between gap-2 pt-2">
            <button type="button" className="sm-btn-secondary" onClick={() => setStep('params')}>
              Back
            </button>
            <button
              type="button"
              className="sm-btn-primary"
              disabled={
                !isConnected ||
                wrongNetwork ||
                !isApproved ||
                listingHook.isSubmitting ||
                listingHook.isConfirming
              }
              onClick={handleSubmitListing}
            >
              Create listing
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StepPill({ label, active, done }: { label: string; active?: boolean; done?: boolean }) {
  return (
    <span
      className={`px-2 py-1 rounded-full border ${
        active ? 'border-sky-deep text-sky-deep' : done ? 'border-line text-mute' : 'border-line text-soft'
      }`}
    >
      {label}
    </span>
  )
}

function KindSummary({ kind, onChangeKind }: { kind: SellListingKind; onChangeKind: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="sm-heading text-lg">{kind === 'auction' ? 'Timed auction' : 'Fixed price'}</p>
      <button type="button" className="text-xs text-sky-deep hover:underline" onClick={onChangeKind}>
        Change type
      </button>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-sm text-mute block mb-1">{label}</label>
      {children}
    </div>
  )
}

function SellStatusPanel({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-sky-deep/30 bg-mist/30 px-4 py-3">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="text-xs text-mute mt-1">{body}</p>
      {action}
    </div>
  )
}