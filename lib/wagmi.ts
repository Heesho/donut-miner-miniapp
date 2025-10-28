import { http, createConfig } from "wagmi"
import { base } from "wagmi/chains"
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector"

export const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http() },
  connectors: [miniAppConnector()],
})
