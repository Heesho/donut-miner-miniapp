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
    <GlazePanel
      user={user ?? undefined}
      epochId={data?.epochId ?? 0}
      timeLeft={data?.timeLeft ?? 0}
      dps={data?.dps ?? 0}
      nextDps={data?.nextDps ?? 0}
      priceWei={(data?.price as unknown as bigint) ?? 0n}
      currentMiner={data?.miner ?? "0x0000000000000000000000000000000000000000"}
      currentMinerUri={data?.uri ?? null}
      accrued={data?.accrued ?? 0}
      donutsHeld={data?.donutsOfAccount ?? 0}
      uriSuggestion={uriSuggestion}
      isLoading={isLoading}
    />
  )
}
