"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type Props = { username?: string; displayName?: string; pfp?: string }

export function HeaderBar({ username, displayName, pfp }: Props) {
  const label = displayName || (username ? `@${username}` : "Mini Glazer")
  const initials =
    displayName
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    username?.slice(0, 2)?.toUpperCase() ||
    "FC"

  return (
    <header className="flex items-center justify-between text-white">
      <div className="font-display text-[32px] font-semibold leading-none drop-shadow-[0_4px_14px_rgba(255,105,180,0.28)]">
        Donut Miner
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right text-sm leading-tight">
          <div className="font-medium">{label}</div>
          <div className="text-[11px] text-neutral-400">Mini App</div>
        </div>
        <Avatar className="h-11 w-11 border-2 border-white/70 bg-black">
          <AvatarImage src={pfp} />
          <AvatarFallback className="bg-black text-sm font-semibold text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
