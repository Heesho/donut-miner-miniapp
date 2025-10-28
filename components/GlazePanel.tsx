"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAccount, useWriteContract } from "wagmi"
import { encodeFunctionData } from "viem"
import { minerAbi } from "@/lib/abi"
import { ADDR } from "@/lib/env"
import { DonutVisual } from "./DonutVisual"
import { cn } from "@/lib/utils"

type Props = {
  epochId: number
  startTime: number
  timeLeft: number
  dps: number
  priceWei: bigint
  currentMiner: `0x${string}`
  uriSuggestion: string
}

export function GlazePanel(p: Props) {
  const { address } = useAccount()
  const timeProgress = useMemo(() => {
    const total = 3600
    return Math.min(100, 100 * ((total - p.timeLeft) / total))
  }, [p.timeLeft])

  const priceEth = Number((Number(p.priceWei) / 1e18).toFixed(6))
  const [slippagePct] = useState(5)
  const maxPriceWei = BigInt(Math.floor(Number(p.priceWei) * (1 + slippagePct / 100)))
  const { writeContractAsync, isPending } = useWriteContract()
  const now = Math.floor(Date.now() / 1000)

  async function onGlaze() {
    if (!address || !ADDR.miner) return
    const deadline = BigInt(now + 60 * 5)
    const provider =
      ADDR.provider && ADDR.provider.length === 42
        ? (ADDR.provider as `0x${string}`)
        : "0x0000000000000000000000000000000000000000"
    const args = [
      address,
      provider,
      BigInt(p.epochId),
      deadline,
      maxPriceWei,
      p.uriSuggestion,
    ] as const

    encodeFunctionData({ abi: minerAbi, functionName: "mine", args })
    await writeContractAsync({
      address: ADDR.miner,
      abi: minerAbi,
      functionName: "mine",
      args,
      value: p.priceWei,
    })
  }

  return (
    <Card className="border-none bg-neutral-950/70 text-neutral-100">
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <div className="text-xl font-semibold tracking-tight">King Glazer</div>
          <div className="text-sm text-neutral-400">Epoch #{p.epochId}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs uppercase text-neutral-400">Current Miner</div>
            <div className="break-all font-medium">
              {p.currentMiner?.slice(0, 6)}…{p.currentMiner?.slice(-4)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-neutral-400">Glaze Rate</div>
            <div className="font-medium">{p.dps.toFixed(2)} / s</div>
          </div>
          <div>
            <div className="text-xs uppercase text-neutral-400">Price</div>
            <div className="font-medium">{priceEth} ETH</div>
          </div>
        </div>

        <div className="flex justify-center">
          <DonutVisual />
        </div>

        <div>
          <div className="mb-2 flex justify-between text-xs text-neutral-400">
            <span>Epoch progress</span>
            <span>{Math.round(timeProgress)}%</span>
          </div>
          <Progress value={timeProgress} />
        </div>

        <TooltipProvider>
          <div className="flex items-center justify-between gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onGlaze}
                  disabled={!ADDR.miner || !p.priceWei || isPending}
                  size="lg"
                  className={cn(
                    "w-full text-lg",
                    "bg-pink-500 hover:bg-pink-600",
                    "shadow-[0_8px_20px_rgba(255,105,180,.35)]",
                  )}
                >
                  {isPending ? "Glazing…" : "Glaze"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Becomes the new miner and pays the current price.</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <div className="text-center text-[12px] text-neutral-400">
          Slippage guard: {slippagePct}% (max {(Number(maxPriceWei) / 1e18).toFixed(6)} ETH)
        </div>
      </CardContent>
    </Card>
  )
}
