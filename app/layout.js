import '../styles/globals.css'
import ThemeManager from '@/components/layout/ThemeManager'

export const metadata = {
  title: 'ARGOS',
  description: 'Gestion des stocks',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cs-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <ThemeManager />
        {children}
      </body>
    </html>
  )
}