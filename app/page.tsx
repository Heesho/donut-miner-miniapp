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

  if (isLoading || !data) {
    return (
      <div className="space-y-6 p-4">
        <HeaderBar username={user?.username} pfp={user?.pfpUrl} />
        <div className="h-[540px] animate-pulse rounded-xl bg-neutral-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      <HeaderBar username={user?.username} pfp={user?.pfpUrl} />
      <GlazePanel
        epochId={data.epochId}
        startTime={data.startTime}
        timeLeft={data.timeLeft}
        dps={data.dps}
        priceWei={data.price as unknown as bigint}
        currentMiner={data.miner}
        uriSuggestion={uriSuggestion}
      />
      <div className="text-center text-xs text-neutral-400">
        Accruing donuts for current miner: <b>{data.accrued.toFixed(2)}</b>
      </div>
    </div>
  )
}
