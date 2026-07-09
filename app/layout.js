import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'UCIP — University Competitor Intelligence Platform',
  description: 'Daily automated intelligence on LPU vs global university competitors',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
