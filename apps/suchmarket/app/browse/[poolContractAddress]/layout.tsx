import { Suspense } from 'react'

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>
}
