"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAccount, useWriteContract } from "wagmi"
import { encodeFunctionData } from "viem"
import { minerAbi } from "@/lib/abi"
import { ADDR } from "@/lib/env"
import { DonutVisual } from "./DonutVisual"
import { cn } from "@/lib/utils"
import { fmtEth } from "@/hooks/useMinerState"

type MinerPersona = { username?: string; displayName?: string; pfpUrl?: string }

type Props = {
  epochId: number
  timeLeft: number
  dps: number
  nextDps: number
  priceWei: bigint
  currentMiner: `0x${string}`
  currentMinerUri?: string | null
  accrued: number
  uriSuggestion: string
}

const sprinkleColors = ["#FB7185", "#FACC15", "#4ADE80", "#60A5FA", "#A78BFA", "#F97316"]

export function GlazePanel(p: Props) {
  const { address } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()
  const [slippagePct] = useState(5)

  const timeProgress = useMemo(() => {
    const total = 3600
    return Math.min(100, Math.max(0, 100 * ((total - p.timeLeft) / total)))
  }, [p.timeLeft])

  const persona = useMemo<MinerPersona>(() => {
    if (!p.currentMinerUri) return {}
    try {
      const parsed = JSON.parse(p.currentMinerUri) as MinerPersona
      return parsed ?? {}
    } catch {
      return {}
    }
  }, [p.currentMinerUri])

  const priceEth = fmtEth(p.priceWei)
  const priceEthLabel = Number.isFinite(priceEth) ? priceEth.toFixed(6) : "0.000000"
  const maxPriceWei = useMemo(() => {
    const wei = typeof p.priceWei === "bigint" ? p.priceWei : BigInt(Math.floor(p.priceWei))
    const multiplier = BigInt(100) + BigInt(slippagePct)
    return (wei * multiplier) / BigInt(100)
  }, [p.priceWei, slippagePct])
  const maxPriceLabel = useMemo(() => {
    const value = fmtEth(maxPriceWei)
    return Number.isFinite(value) ? value.toFixed(6) : "0.000000"
  }, [maxPriceWei])

  const now = Math.floor(Date.now() / 1000)

  async function onGlaze() {
    if (!address || !ADDR.miner) return
    const deadline = BigInt(now + 60 * 5)
    const provider =
      ADDR.provider && ADDR.provider.length === 42
        ? (ADDR.provider as `0x${string}`)
        : ("0x0000000000000000000000000000000000000000" as const)
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

  const initials =
    persona.displayName?.charAt(0) ??
    persona.username?.charAt(0)?.toUpperCase() ??
    p.currentMiner.slice(2, 4).toUpperCase()

  return (
    <Card className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,167,196,0.22),_transparent_55%),_rgba(6,6,9,0.85)] p-1 text-neutral-100 shadow-[0_40px_80px_rgba(255,105,180,0.22)]">
      <div className="rounded-[28px] border border-white/10 bg-neutral-950/80">
        <CardHeader className="space-y-4 px-6 pt-6">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.35em] text-pink-200/80">King Glazer</span>
            <span className="rounded-full border border-pink-300/30 bg-pink-500/10 px-3 py-1 text-xs font-medium text-pink-100">
              Epoch #{p.epochId}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-neutral-900/60 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-12 w-12 border border-pink-300/30 bg-neutral-950">
                <AvatarImage src={persona.pfpUrl} />
                <AvatarFallback className="text-sm font-semibold text-neutral-200">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-400">Current miner</p>
                <p className="truncate text-lg font-semibold text-neutral-50">
                  {persona.displayName ?? persona.username ?? `${p.currentMiner.slice(0, 6)}…${p.currentMiner.slice(-4)}`}
                </p>
              </div>
            </div>
            <dl className="text-right">
              <dt className="text-xs uppercase tracking-[0.3em] text-neutral-500">Glaze rate</dt>
              <dd className="text-2xl font-semibold text-pink-100 drop-shadow-[0_6px_18px_rgba(255,105,180,0.4)]">
                {p.dps.toFixed(2)} / s
              </dd>
            </dl>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 px-6 pb-8">
          <div className="grid grid-cols-2 gap-4 rounded-3xl border border-white/5 bg-neutral-950/70 p-4">
            <InfoTile
              label="Glaze Price"
              value={`${priceEthLabel} ETH`}
              pill="Live"
              accent="from-pink-500/40 to-pink-600/25"
            />
            <InfoTile
              label="Next Glaze Rate"
              value={`${p.nextDps.toFixed(2)} / s`}
              pill="Up Next"
              accent="from-violet-500/40 to-violet-600/25"
            />
            <InfoTile
              label="Donuts Accruing"
              value={p.accrued.toFixed(2)}
              pill="Unminted"
              accent="from-amber-500/40 to-amber-600/25"
            />
            <InfoTile
              label="Sprinkles"
              value={`${sprinkleColors.length * 4} pcs`}
              pill="Style"
              accent="from-sky-500/40 to-sky-600/25"
            />
          </div>

          <div className="flex justify-center">
            <DonutVisual />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-neutral-500">
              <span>Epoch progress</span>
              <span>{Math.round(timeProgress)}%</span>
            </div>
            <Progress
              value={timeProgress}
              className="h-3 overflow-hidden rounded-full border border-white/10 bg-neutral-900"
            />
          </div>

          <TooltipProvider>
            <div className="flex flex-col gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onGlaze}
                    disabled={!ADDR.miner || !p.priceWei || isPending}
                    size="lg"
                    className={cn(
                      "h-14 w-full rounded-full text-lg font-semibold",
                      "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400",
                      "shadow-[0_24px_45px_rgba(255,105,180,0.45)] transition-transform hover:translate-y-0.5 active:translate-y-0",
                    )}
                  >
                    {isPending ? "Glazing…" : "Glaze"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Pay the current price, become King Glazer, and start earning donuts instantly.
                </TooltipContent>
              </Tooltip>
              <p className="text-center text-xs text-neutral-400">
                Slippage guard: {slippagePct}% (max {maxPriceLabel} ETH)
              </p>
            </div>
          </TooltipProvider>

          <p className="rounded-2xl border border-white/5 bg-neutral-950/70 px-4 py-3 text-center text-sm text-neutral-300">
            Pay the glaze price to seize the throne. You&apos;ll capture 💰{" "}
            <span className="font-semibold text-pink-200">80%</span> of the payment and keep earning{" "}
            <span className="font-semibold text-pink-200">$DONUT</span> each second until someone sweeter
            takes your spot.
          </p>
        </CardContent>
      </div>
    </Card>
  )
}

function InfoTile({
  label,
  value,
  pill,
  accent,
}: {
  label: string
  value: string | number
  pill: string
  accent: string
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-900/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <span className={cn("self-start rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-pink-100", `bg-gradient-to-r ${accent}`)}>
        {pill}
      </span>
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">{label}</p>
        <p className="text-lg font-semibold text-neutral-50">{value}</p>
      </div>
    </div>
  )
}
