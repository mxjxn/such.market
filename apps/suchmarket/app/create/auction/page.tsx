import Link from 'next/link'
import { redirect } from 'next/navigation'

/** Legacy path → unified Sell stub. */
export default function CreateAuctionStubPage() {
  redirect('/sell')
}
