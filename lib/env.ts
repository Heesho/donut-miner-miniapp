export const ADDR = {
  miner: process.env.NEXT_PUBLIC_MINER_ADDRESS as `0x${string}`,
  multicall: process.env.NEXT_PUBLIC_MULTICALL_ADDRESS as `0x${string}`,
  provider: (process.env.NEXT_PUBLIC_PROVIDER_ADDRESS || "") as `0x${string}` | "",
}

if (!ADDR.miner || !ADDR.multicall) {
  console.warn("Set NEXT_PUBLIC_MINER_ADDRESS and NEXT_PUBLIC_MULTICALL_ADDRESS")
}
