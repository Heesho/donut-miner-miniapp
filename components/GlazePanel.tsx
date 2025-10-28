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

type Persona = { username?: string; displayName?: string; pfpUrl?: string }

type Props = {
  user?: Persona
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

const formatLabel = (persona?: Persona, fallback?: `0x${string}`) => {
  if (persona?.displayName) return persona.displayName
  if (persona?.username) return persona.username
  if (fallback) return `${fallback.slice(0, 6)}…${fallback.slice(-4)}`
  return "—"
}

const formatHandle = (persona?: Persona) =>
  persona?.username ? `@${persona.username}` : ""

export default function GlazePanel(p: Props) {
  const { address } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()
  const [slippagePct] = useState(5)

  const persona = useMemo<Persona>(() => {
    if (!p.currentMinerUri) return {}
    try {
      return JSON.parse(p.currentMinerUri) as Persona
    } catch {
      return {}
    }
  }, [p.currentMinerUri])

  const kingLabel = formatLabel(persona, p.currentMiner)
  const kingHandle = formatHandle(persona)

  const priceEth = fmtEth(p.priceWei)
  const priceLabel = Number.isFinite(priceEth) ? priceEth.toFixed(3) : "0.000"
  const glazedCount = Math.max(0, Math.floor(p.accrued))

  const { data: ethBalanceData } = useBalance({
    address,
    chainId: 8453,
    query: { enabled: Boolean(address) },
  })

  const donutBalance = p.donutsHeld !== undefined ? p.donutsHeld.toFixed(2) : "0.00"
  const ethBalance = ethBalanceData ? Number(formatEther(ethBalanceData.value)).toFixed(3) : "0.000"

  const onGlaze = async () => {
    if (!address || !ADDR.miner) return
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 5)
    const provider =
      ADDR.provider && ADDR.provider.length === 42
        ? (ADDR.provider as `0x${string}`)
        : "0x0000000000000000000000000000000000000000"
    const maxPrice =
      (p.priceWei * BigInt(100 + slippagePct)) / BigInt(100)

    const args = [
      address,
      provider,
      BigInt(p.epochId),
      deadline,
      maxPrice,
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

  if (p.isLoading) {
    return (
      <main className="grid h-screen w-screen place-items-center bg-black">
        <div className="h-[95vh] aspect-[9/16] w-auto max-w-[520px] rounded-[28px] border border-zinc-800 bg-black p-3 shadow-inner" />
      </main>
    )
  }

  return (
    <main className="h-screen w-screen grid place-items-center bg-black text-white overflow-hidden font-mono">
      <div className="relative flex h-[95vh] aspect-[9/16] w-auto max-w-[520px] flex-col justify-between rounded-[28px] border border-zinc-800 bg-black p-3 shadow-inner">
        <div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-wide">DONUT MINER</h1>
            <div className="flex items-center gap-2 rounded-full bg-black px-3 py-1">
              <Avatar className="h-8 w-8">
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
                  {p.user?.displayName ?? p.user?.username ?? "heeshillio"}
                </div>
                <div className="text-xs text-gray-400">
                  {formatHandle(p.user) || "@heesh"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-2 p-3">
                <div className="text-sm font-bold uppercase text-gray-400">KING GLAZER</div>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {persona.pfpUrl ? (
                      <AvatarImage src={persona.pfpUrl} />
                    ) : (
                      <AvatarFallback className="bg-zinc-800 text-xs text-white">
                        {kingLabel.slice(0, 2).toLowerCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="leading-tight text-left">
                    <div className="text-sm text-white">{kingLabel || "fuzboy"}</div>
                    <div className="text-[11px] text-gray-400">
                      {kingHandle || "@fuzy"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-2 p-3">
                <div className="text-sm font-bold uppercase text-gray-400">GLAZED</div>
                <div className="text-2xl font-semibold text-white">
                  🍩{glazedCount || 535}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="my-12 flex select-none justify-center text-[12rem] leading-none">🍩</div>
        </div>

        <div className="mb-2 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-2 p-3">
                <div className="text-sm font-bold uppercase text-gray-400">GLAZE RATE</div>
                <div className="flex items-end gap-1">
                  <div className="text-2xl font-semibold text-white">
                    🍩{p.dps.toFixed(2) || "5"}
                  </div>
                  <span className="pb-1 text-xs text-gray-400">/s</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-2 p-3">
                <div className="text-sm font-bold uppercase text-gray-400">GLAZE PRICE</div>
                <div className="text-2xl font-semibold text-pink-400">Ξ{priceLabel || "0.012"}</div>
              </CardContent>
            </Card>
          </div>

          <Button
            className="w-full rounded-2xl bg-pink-500 py-4 text-base font-bold text-black shadow-lg hover:bg-pink-400"
            onClick={onGlaze}
            disabled={!ADDR.miner || !p.priceWei || isPending}
          >
            {isPending ? "GLAZING…" : "GLAZE"}
          </Button>

          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-400">
              Your Balances
            </div>
            <div className="flex justify-between text-[13px] font-semibold">
              <div className="flex items-center gap-2">
                <span>🍩</span>
                <span>{donutBalance !== "0.00" ? donutBalance : "343.23"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Ξ</span>
                <span>{ethBalance !== "0.000" ? ethBalance : "1.334"}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="pb-2 text-center text-[12px] leading-snug text-gray-400">
          Pay the Glaze Price to become the King Glazer. Earn $DONUT each second until another player
          glazes the donut. 80% of their payment goes to you.
        </p>
      </div>
    </main>
  )
}
