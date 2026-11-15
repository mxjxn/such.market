'use client'

import { useState } from 'react'
import Link from 'next/link'

const CHAINS = [
  { id: 8453, name: 'Base' },
  { id: 84532, name: 'Base Sepolia' },
  { id: 1, name: 'Ethereum' },
]

export default function VerifyCollectionPage() {
  const [chainId, setChainId] = useState('8453')
  const [contractAddress, setContractAddress] = useState('')
  const [contact, setContact] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/verify-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId: Number(chainId), contractAddress, contact, notes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Submission failed')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sm-band-sky min-h-full">
      <div className="sm-container py-10 md:py-14 max-w-lg">
        <Link href="/explore" className="text-sm text-sky-deep hover:underline">
          ← Explore
        </Link>
        <h1 className="sm-heading text-3xl mt-4">Verify a collection</h1>
        <p className="mt-2 text-sm text-mute leading-relaxed">
          Collections minted in <strong>cryptoart.studio</strong> are auto-verified for barter discovery.
          Other collections can apply for manual curation (no on-chain proof yet — ops reviews submissions).
        </p>

        {submitted ? (
          <div className="sm-card p-6 mt-8">
            <p className="sm-heading text-lg">Application received</p>
            <p className="mt-2 text-sm text-mute">
              We queue submissions for admin review. Barter offers stay allowed while pending; unverified
              collections use the default visibility rules in BARTER_OFFERS.md.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="sm-card p-6 mt-8 space-y-4">
            <div>
              <label className="text-sm text-mute block mb-1">Chain</label>
              <select
                className="sm-input w-full"
                value={chainId}
                onChange={(e) => setChainId(e.target.value)}
              >
                {CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-mute block mb-1">Contract address</label>
              <input
                className="sm-input w-full font-mono text-sm"
                placeholder="0x…"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value.trim())}
                required
              />
            </div>
            <div>
              <label className="text-sm text-mute block mb-1">Contact (email or Farcaster)</label>
              <input
                className="sm-input w-full"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-mute block mb-1">Notes (optional)</label>
              <textarea
                className="sm-input w-full min-h-[88px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Collection name, studio link, or proof of deployment"
              />
            </div>
            {error && <p className="text-sm text-clay">{error}</p>}
            <button type="submit" className="sm-btn-primary w-full" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit for review'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}