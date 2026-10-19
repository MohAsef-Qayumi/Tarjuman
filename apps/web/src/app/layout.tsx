import type { Metadata } from "next"
import { Amiri, Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-amiri" })

export const metadata: Metadata = {
  title: "Tarjuman — Read classical Arabic in your language",
  description:
    "Instant, glossary-aware translation of classical Islamic Arabic texts into English, Dari, Pashto, Urdu and more, right where you read them.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${amiri.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  )
}
