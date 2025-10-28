"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

type Props = { username?: string; displayName?: string; pfp?: string }

export function HeaderBar({ username, displayName, pfp }: Props) {
  const initials = displayName
    ? displayName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : username?.slice(0, 2)?.toUpperCase() ?? "FC"

  return (
    <header className="flex items-center justify-between rounded-3xl border border-white/10 bg-neutral-950/80 px-5 py-4 shadow-[0_24px_60px_rgba(255,105,180,0.12)] backdrop-blur">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-pink-200 drop-shadow-[0_2px_8px_rgba(255,105,180,0.25)]">
          Donut Miner
        </h1>
        <p className="text-sm text-neutral-400">
          {displayName ?? username ? (
            <>
              Welcome back,{" "}
              <span className="font-medium text-neutral-200">
                {displayName ?? `@${username}`}
              </span>
            </>
          ) : (
            "Glaze, earn, and stay frosted."
          )}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge className="rounded-full border border-pink-300/40 bg-pink-500/20 text-xs font-semibold uppercase tracking-wide text-pink-100">
          Mini App
        </Badge>
        <Avatar className="h-12 w-12 border-2 border-pink-300/60 shadow-[0_10px_20px_rgba(255,105,180,0.25)]">
          <AvatarImage src={pfp} />
          <AvatarFallback className="bg-neutral-900 text-sm font-medium text-neutral-200">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
