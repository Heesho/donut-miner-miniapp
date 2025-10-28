"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAccount, useWriteContract } from "wagmi"
import { encodeFunctionData } from "viem"
import { minerAbi } from "@/lib/abi"
import { ADDR } from "@/lib/env"
import { DonutVisual } from "./DonutVisual"
import { cn } from "@/lib/utils"
import { fmtEth } from "@/hooks/useMinerState"
import { HeaderBar } from "./HeaderBar"

type MinerPersona = { username?: string; displayName?: string; pfpUrl?: string }

type Props = {
  user?: MinerPersona
  epochId: number
  timeLeft: number
  dps: number
  nextDps: number
  priceWei: bigint
  currentMiner: `0x${string}`
  currentMinerUri?: string | null
  accrued: number
  donutsHeld?: number
  uriSuggestion: string
}

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
  const glazedCount = Math.max(0, Math.floor(p.accrued))

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
    <Card className="rounded-[36px] border-2 border-white/35 bg-black/95 px-6 py-6 text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
      <CardHeader className="space-y-6 px-0 pt-0">
        <HeaderBar username={p.user?.username} displayName={p.user?.displayName} pfp={p.user?.pfpUrl} />
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-neutral-400">
          <span>King Glazer</span>
          <span>Epoch #{p.epochId}</span>
        </div>
        <div className="rounded-[28px] border border-white/25 px-4 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-white/70 bg-black">
                <AvatarImage src={persona.pfpUrl} />
                <AvatarFallback className="bg-black text-sm font-semibold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm text-neutral-300">Current Miner</div>
                <div className="truncate font-semibold text-white">
                  {persona.username
                    ? `@${persona.username}`
                    : persona.displayName
                    ? persona.displayName
                    : `${p.currentMiner.slice(0, 6)}…${p.currentMiner.slice(-4)}`}
                </div>
              </div>
            </div>
            <dl className="text-center">
              <dt className="text-xs uppercase tracking-[0.25em] text-neutral-400">Glaze Rate</dt>
              <dd className="text-xl font-semibold text-pink-200">
                🍩 {p.dps.toFixed(2)}
                <span className="text-sm text-neutral-300"> /s</span>
              </dd>
            </dl>
            <dl className="text-center">
              <dt className="text-xs uppercase tracking-[0.25em] text-neutral-400">Glazed</dt>
              <dd className="text-xl font-semibold text-pink-200">{glazedCount}</dd>
            </dl>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-0 pb-0">
        <div className="flex justify-center">
          <div className="rounded-full border border-white/20 bg-neutral-900/40 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <DonutVisual />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-neutral-400">
            <span>Epoch progress</span>
            <span>{Math.round(timeProgress)}%</span>
          </div>
          <Progress value={timeProgress} className="h-2.5 overflow-hidden rounded-full bg-neutral-900" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Next Glaze Rate"
            value={`🍩 ${p.nextDps.toFixed(2)}/s`}
            sub="Projected after mint"
          />
          <StatCard label="Glaze Price" value={`${priceEthLabel} ETH`} sub="Due on glaze" accent />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-neutral-300">
          <div>
            <div className="uppercase tracking-[0.3em] text-xs text-neutral-500">Your donuts</div>
            <div className="text-lg font-semibold text-white">
              {p.donutsHeld !== undefined ? p.donutsHeld.toFixed(2) : "0.00"}
            </div>
          </div>
          <div className="text-right">
            <div className="uppercase tracking-[0.3em] text-xs text-neutral-500">Slippage Guard</div>
            <div className="text-lg font-semibold text-white">
              {slippagePct}% <span className="text-sm text-neutral-300">(max {maxPriceLabel} ETH)</span>
            </div>
          </div>
        </div>

        <Button
          onClick={onGlaze}
          disabled={!ADDR.miner || !p.priceWei || isPending}
          size="lg"
          className={cn(
            "mt-2 h-14 w-full rounded-[28px] border border-white/30 text-lg font-semibold text-black",
            "bg-gradient-to-b from-pink-400 via-pink-500 to-rose-500 hover:from-pink-300 hover:to-rose-400",
            "shadow-[0_18px_38px_rgba(255,105,180,0.45)] transition-transform hover:-translate-y-[1px] active:translate-y-[1px]",
          )}
        >
          {isPending ? "Glazing…" : "Glaze"}
        </Button>

        <p className="rounded-[24px] border border-white/20 bg-neutral-900/60 px-4 py-4 text-center text-sm leading-relaxed text-neutral-200">
          Pay the glaze price to become <span className="font-semibold text-pink-200">King Glazer</span>. Earn
          <span className="font-semibold text-pink-200"> 100% of donuts</span> each second until another player
          takes the donut. 80% of their payment comes back to you.
        </p>
      </CardContent>
    </Card>
  )
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-white/20 px-4 py-3",
        accent ? "bg-pink-500/20" : "bg-neutral-900/50",
      )}
    >
      <div className="text-xs uppercase tracking-[0.3em] text-neutral-400">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-[11px] text-neutral-400">{sub}</div>
    </div>
  )
}
