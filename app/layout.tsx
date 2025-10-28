import "./globals.css"
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { ReactQueryClientProvider } from "@/components/ReactQueryProvider"
import { WagmiRoot } from "@/components/WagmiRoot"

const embed = {
  version: "1",
  imageUrl: "https://your-domain.xyz/og.png",
  button: {
    title: "Start Glazing",
    action: {
      type: "launch_miniapp",
      name: "Donut Miner",
      url: "https://your-domain.xyz/mini",
      splashImageUrl: "https://your-domain.xyz/icon.png",
      splashBackgroundColor: "#0b0b0b",
    },
  },
}

export const metadata: Metadata = {
  title: "Donut Miner",
  description: "Become King Glazer. Earn donuts over time.",
  other: { "fc:miniapp": JSON.stringify(embed) },
}

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body className="bg-neutral-950 text-neutral-100">
        <WagmiRoot>
          <ReactQueryClientProvider>{children}</ReactQueryClientProvider>
        </WagmiRoot>
      </body>
    </html>
  )
}
