// TODO: Phase 1 — Root layout (fonts Google, metadata)
import '../styles/globals.css'

export const metadata = {
  title: 'Connecteo — Gestion de Stock',
  description: 'Système multi-départements de gestion des stocks',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
