import { Suspense } from 'react'

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="sm-container py-16 text-sm text-mute">Loading…</div>}>{children}</Suspense>
}
