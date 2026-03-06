import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { FloatingRoleMenu } from "@/components/navigation/FloatingRoleMenu"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Barboo",
    template: "%s | Barboo",
  },
  description: "Barboo - Conectando barbeiros e clientes",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "256x256", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/favicon.ico", sizes: "180x180", type: "image/png" },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <FloatingRoleMenu />
      </body>
    </html>
  )
}
