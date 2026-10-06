import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Claris | Registro de viajes y ganancias',
  applicationName: 'Claris',
  description: 'Registra viajes, gastos y ganancias.',
  generator: 'v0.app',
  // Permite añadir la app a la pantalla de inicio y abrirla a pantalla completa
  // (sin la barra del navegador): así se ve igual que desde el preview.
  appleWebApp: {
    capable: true,
    title: 'Claris',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false, date: false, email: false, address: false },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Necesario para usar env(safe-area-inset-*) en pantallas con notch.
  viewportFit: 'cover',
  colorScheme: 'dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'black' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
