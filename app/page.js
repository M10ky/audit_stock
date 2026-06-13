// TODO: Phase 2 — Redirect vers /dashboard ou /login selon session
import { redirect } from 'next/navigation'
export default function Home() {
  redirect('/login')
}
