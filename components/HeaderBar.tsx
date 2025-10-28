"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export function HeaderBar({ username, pfp }: { username?: string; pfp?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-2xl font-semibold leading-none">Donut Miner</div>
        {username ? <div className="text-sm text-neutral-400">@{username}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="rounded-full">
          Mini App
        </Badge>
        <Avatar className="h-8 w-8">
          <AvatarImage src={pfp} />
          <AvatarFallback>FC</AvatarFallback>
        </Avatar>
      </div>
    </div>
  )
}
