import "./globals.css"
import type { Metadata } from "next"
import { ReactQueryClientProvider } from "@/components/ReactQueryProvider"
import { WagmiProvider } from "wagmi"
import { wagmiConfig } from "@/lib/wagmi"
import { GeistSans } from "geist/font/sans"

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="bg-neutral-950 text-neutral-100">
        <WagmiProvider config={wagmiConfig}>
          <ReactQueryClientProvider>{children}</ReactQueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  )
}
