"use client"

import { WagmiProvider } from "wagmi"
import { wagmiConfig } from "@/lib/wagmi"

export function WagmiRoot({ children }: { children: React.ReactNode }) {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
}
