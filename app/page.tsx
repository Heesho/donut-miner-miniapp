"use client"

import { useEffect, useMemo, useState } from "react"
import { sdk } from "@farcaster/miniapp-sdk"
import { useAccount } from "wagmi"
import { useMinerState } from "@/hooks/useMinerState"
import { GlazePanel } from "@/components/GlazePanel"

export default function Page() {
  useEffect(() => {
    sdk.back.enableWebNavigation().catch(() => {})
  }, [])

  useEffect(() => {
    ;(async () => {
      await sdk.actions.ready()
    })()
  }, [])

  const { address } = useAccount()
  const { data, isLoading } = useMinerState(address)
  const [user, setUser] = useState<{ username?: string; displayName?: string; pfpUrl?: string }>()

  useEffect(() => {
    let cancelled = false
    sdk.context
      .then((ctx) => {
        if (!cancelled) {
          setUser({
            username: ctx.user?.username,
            displayName: ctx.user?.displayName,
            pfpUrl: ctx.user?.pfpUrl,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setUser(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const uriSuggestion = useMemo(() => {
    const obj = {
      username: user?.username,
      displayName: user?.displayName,
      pfpUrl: user?.pfpUrl,
    }
    try {
      return JSON.stringify(obj)
    } catch {
      return "{}"
    }
  }, [user])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <main className="relative mx-auto flex h-[640px] w-full max-w-[420px] flex-col justify-center gap-6 px-5 py-6">
        {isLoading || !data ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-[520px] w-full animate-pulse rounded-[32px] border border-white/10 bg-neutral-900/70" />
          </div>
        ) : (
          <GlazePanel
            user={user ?? undefined}
            epochId={data.epochId}
            timeLeft={data.timeLeft}
            dps={data.dps}
            nextDps={data.nextDps}
            priceWei={data.price as unknown as bigint}
            currentMiner={data.miner}
            currentMinerUri={data.uri}
            accrued={data.accrued}
            donutsHeld={data.donutsOfAccount}
            uriSuggestion={uriSuggestion}
          />
        )}
      </main>
    </div>
  )
}
