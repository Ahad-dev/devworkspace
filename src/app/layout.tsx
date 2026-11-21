import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { ThemeColorSync } from "@/components/providers/theme-color-sync"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: { default: "DevWorkspace", template: "%s · DevWorkspace" },
  description: "Personal engineering workspace for projects, tasks, handoffs and environments.",
  applicationName: "DevWorkspace",
  // Installed on iOS (Plan P9.1): the home-screen title and a status bar that follows the page.
  appleWebApp: { title: "DevWorkspace", statusBarStyle: "default" },
}

// Static on purpose: with Cache Components a request-dependent viewport would block every route.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>
          <ThemeColorSync />
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
