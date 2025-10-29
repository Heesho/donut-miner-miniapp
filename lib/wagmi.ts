import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { fallback, http, createStorage, cookieStorage } from "wagmi";
import { base } from "wagmi/chains";
import { createConfig } from "wagmi";

export const wagmiConfig = createConfig({
  chains: [base],
  autoConnect: true,
  ssr: true,
  connectors: [farcasterMiniApp()],
  transports: {
    [base.id]: fallback([http()]),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  pollingInterval: 6_000,
});
