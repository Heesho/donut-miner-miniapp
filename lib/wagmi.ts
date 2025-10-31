import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { fallback, http, createStorage, cookieStorage } from "wagmi";
import { base } from "wagmi/chains";
import { createConfig } from "wagmi";

export const wagmiConfig = createConfig({
  chains: [base],
  ssr: true,
  connectors: [farcasterMiniApp()],
  transports: {
    [base.id]: fallback([
      http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
      http(),
    ]),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  pollingInterval: 12_000,
});
