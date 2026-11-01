import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/ibm-plex-sans'
import './globals.css'
import { THEME_INIT_SCRIPT, ThemeProvider } from '@/contexts/theme'

export const metadata: Metadata = {
  title: 'GastAI',
  description: 'Gestão de gastos pessoal',
  appleWebApp: { capable: true, title: 'GastAI', statusBarStyle: 'black' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1117' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme é definido por um script antes da pintura; por isso o React não deve estranhar a diferença
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
