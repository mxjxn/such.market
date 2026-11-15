import { redirect } from 'next/navigation'

/** Legacy path → unified Sell stub. */
export default function CreateFixedPriceStubPage() {
  redirect('/sell')
}
