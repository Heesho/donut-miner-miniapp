"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CircleUserRound } from "lucide-react"
import { useAccount, useBalance, useWriteContract } from "wagmi"
import { encodeFunctionData, formatEther } from "viem"
import { minerAbi } from "@/lib/abi"
import { ADDR } from "@/lib/env"
import { fmtEth } from "@/hooks/useMinerState"
import { cn } from "@/lib/utils"

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
  isLoading?: boolean
}

const formatPersonaLabel = (persona?: MinerPersona, fallback?: `0x${string}`) => {
  if (persona?.displayName) return persona.displayName
  if (persona?.username) return persona.username
  if (fallback) return `${fallback.slice(0, 6)}…${fallback.slice(-4)}`
  return "—"
}

const formatPersonaHandle = (persona?: MinerPersona) =>
  persona?.username ? `@${persona.username}` : ""

export function GlazePanel(p: Props) {
  const { address } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()
  const [slippagePct] = useState(5)

  const persona = useMemo<MinerPersona>(() => {
    if (!p.currentMinerUri) return {}
    try {
      return JSON.parse(p.currentMinerUri) as MinerPersona
    } catch {
      return {}
    }
  }, [p.currentMinerUri])

  const priceEth = fmtEth(p.priceWei)
  const priceEthLabel = Number.isFinite(priceEth) ? priceEth.toFixed(3) : "0.000"
  const maxPriceWei = useMemo(() => {
    const multiplier = BigInt(100 + slippagePct)
    return (p.priceWei * multiplier) / BigInt(100)
  }, [p.priceWei, slippagePct])

  const { data: ethBalanceData } = useBalance({
    address,
    chainId: 8453,
    query: { enabled: Boolean(address) },
  })
  const ethBalance = ethBalanceData ? Number(formatEther(ethBalanceData.value)).toFixed(3) : "0.000"
  const donutBalance = p.donutsHeld !== undefined ? p.donutsHeld.toFixed(2) : "0.00"

  const handleGlaze = async () => {
    if (!address || !ADDR.miner) return
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 5)
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

  const Header = () => (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-wide">DONUT MINER</h1>
      <div className="flex items-center gap-2 rounded-full bg-black px-3 py-1">
        <Avatar className="h-8 w-8 border border-zinc-700">
          {p.user?.pfpUrl ? (
            <AvatarImage src={p.user.pfpUrl} />
          ) : (
            <AvatarFallback className="bg-zinc-800 text-white">
              <CircleUserRound className="h-4 w-4" />
            </AvatarFallback>
          )}
        </Avatar>
        <div className="leading-tight text-left">
          <div className="text-sm font-bold">
            {p.user?.displayName ?? p.user?.username ?? "Anonymous"}
          </div>
          <div className="text-xs text-gray-400">{formatPersonaHandle(p.user)}</div>
        </div>
      </div>
    </div>
  )

  if (p.isLoading) {
    return (
      <main className="grid h-screen w-screen place-items-center bg-black">
        <div className="h-[95vh] max-h-[820px] aspect-[9/16] w-auto max-w-[520px] rounded-[28px] border border-zinc-800 bg-black p-3 shadow-inner">
          <div className="flex h-full items-center justify-center">
            <div className="h-[520px] w-full animate-pulse rounded-[24px] border border-zinc-900 bg-zinc-900/60" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="grid h-screen w-screen place-items-center bg-black font-mono text-white overflow-hidden">
      <div className="flex h-[95vh] max-h-[820px] aspect-[9/16] w-auto max-w-[520px] flex-col justify-between rounded-[28px] border border-zinc-800 bg-black p-3 shadow-inner">
        <div>
          <Header />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-2 p-3">
                <div className="text-sm font-bold uppercase text-gray-400">KING GLAZER</div>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 border border-zinc-700">
                    {persona.pfpUrl ? (
                      <AvatarImage src={persona.pfpUrl} />
                    ) : (
                      <AvatarFallback className="bg-zinc-800 text-xs text-white">
                        {formatPersonaLabel(persona, p.currentMiner).slice(0, 2)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="leading-tight text-left">
                    <div className="text-sm text-white">
                      {formatPersonaLabel(persona, p.currentMiner)}
                    </div>
                    <div className="text-[11px] text-gray-400">{formatPersonaHandle(persona)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-2 p-3">
                <div className="text-sm font-bold uppercase text-gray-400">GLAZED</div>
                <div className="text-2xl font-semibold text-white">🍩{Math.floor(p.accrued)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="my-6 select-none text-center text-[12rem] leading-none">🍩</div>

          <div className="grid grid-cols-2 gap-2">
            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-2 p-3">
                <div className="text-sm font-bold uppercase text-gray-400">GLAZE RATE</div>
                <div className="flex items-end gap-1">
                  <div className="text-2xl font-semibold text-white">🍩{p.dps.toFixed(2)}</div>
                  <span className="pb-1 text-xs text-gray-400">/s</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-2 p-3">
                <div className="text-sm font-bold uppercase text-gray-400">GLAZE PRICE</div>
                <div className="text-2xl font-semibold text-pink-400">Ξ{priceEthLabel}</div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-3">
            <Button
              className={cn(
                "w-full rounded-2xl bg-pink-500 py-4 text-base font-bold text-black shadow-lg hover:bg-pink-400",
              )}
              onClick={handleGlaze}
              disabled={!ADDR.miner || !p.priceWei || isPending}
            >
              {isPending ? "GLAZING…" : "GLAZE"}
            </Button>

            <div className="mt-4">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-400">Your Balances</div>
              <div className="flex justify-between text-[13px] font-semibold">
                <div className="flex items-center gap-2">
                  <span>🍩</span>
                  <span>{donutBalance}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Ξ</span>
                  <span>{ethBalance}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[12px] leading-snug text-gray-400">
          Pay the Glaze Price to become the King Glazer. Earn $DONUT each second until another player
          glazes the donut. 80% of their payment goes to you.
        </p>
      </div>
    </main>
  )
}
