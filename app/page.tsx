"use client"

import { useEffect, useMemo, useState } from "react"
import { sdk } from "@farcaster/miniapp-sdk"
import { useAccount } from "wagmi"
import { useMinerState } from "@/hooks/useMinerState"
import { HeaderBar } from "@/components/HeaderBar"
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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,105,180,0.1),_transparent_55%),#08080b]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(236,72,153,0.18),_transparent_60%)]" />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-[460px] flex-col gap-6 px-5 py-6">
        <HeaderBar
          username={user?.username}
          displayName={user?.displayName}
          pfp={user?.pfpUrl}
        />
        {isLoading || !data ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-[520px] w-full animate-pulse rounded-[32px] border border-white/10 bg-neutral-900/70" />
          </div>
        ) : (
          <GlazePanel
            epochId={data.epochId}
            timeLeft={data.timeLeft}
            dps={data.dps}
            nextDps={data.nextDps}
            priceWei={data.price as unknown as bigint}
            currentMiner={data.miner}
            currentMinerUri={data.uri}
            accrued={data.accrued}
            uriSuggestion={uriSuggestion}
          />
        )}
      </main>
    </div>
  )
}
