"use client"

import { useQuery } from "@tanstack/react-query"
import { createPublicClient, http, formatEther } from "viem"
import { base } from "viem/chains"
import { multicallAbi } from "@/lib/abi"
import { ADDR } from "@/lib/env"

const client = createPublicClient({ chain: base, transport: http() })

export function useMinerState(account?: `0x${string}` | null) {
  return useQuery({
    queryKey: ["miner", account ?? "0x0"],
    refetchInterval: 3_000,
    queryFn: async () => {
      if (!ADDR.multicall) throw new Error("Missing multicall address")
      const res = await client.readContract({
        address: ADDR.multicall,
        abi: multicallAbi,
        functionName: "getMiner",
        args: [account ?? "0x0000000000000000000000000000000000000000"],
      })
      const now = Math.floor(Date.now() / 1000)
      const epochSeconds = 3600
      const timePassed = Math.max(0, now - Number(res.startTime))
      const timeLeft = Math.max(0, epochSeconds - timePassed)
      const dps = Number(res.dps) / 1e18
      const accrued = dps * timePassed

      return {
        epochId: Number(res.epochId),
        initPrice: res.initPrice,
        startTime: Number(res.startTime),
        price: res.price,
        dps,
        nextDps: Number(res.nextDps) / 1e18,
        miner: res.miner as `0x${string}`,
        uri: res.uri as string,
        timePassed,
        timeLeft,
        accrued,
        donutsOfAccount: Number(res.donuts) / 1e18,
        accountEth: Number(res.balance) / 1e18,
      }
    },
  })
}

export const fmtEth = (wei: bigint | number) =>
  typeof wei === "bigint" ? Number(formatEther(wei)) : wei
