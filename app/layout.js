import '../styles/globals.css'

export const metadata = {
  title: 'Connecteo Stock',
  description: 'Système multi-départements de gestion des stocks — Connecteo',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}