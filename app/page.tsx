"use client";

import { useEffect } from "react";
import { CircleUserRound } from "lucide-react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  useEffect(() => {
    sdk.actions.ready().catch(() => {
      // Ignore errors during local development where the SDK may be unavailable.
    });
  }, []);

  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-black font-mono text-white">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-1 flex-col rounded-[28px] bg-black px-4 pb-4 shadow-inner"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        }}
      >
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-wide">DONUT MINER</h1>
            <div className="flex items-center gap-2 rounded-full bg-black px-3 py-1">
              <Avatar className="h-8 w-8 border border-zinc-800">
                <AvatarFallback className="bg-zinc-800 text-white">
                  <CircleUserRound className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight text-left">
                <div className="text-sm font-bold">heeshillio</div>
                <div className="text-xs text-gray-400">@heesh</div>
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-1.5 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                  KING GLAZER
                </div>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 border border-zinc-800">
                    <AvatarFallback className="bg-zinc-800 text-white text-xs uppercase">
                      fz
                    </AvatarFallback>
                  </Avatar>
                  <div className="leading-tight text-left">
                    <div className="text-sm text-white">fuzboy</div>
                    <div className="text-[11px] text-gray-400">@fuzy</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-1.5 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                  GLAZED
                </div>
                <div className="text-2xl font-semibold text-white">🍩535</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="select-none text-[10rem] leading-none">🍩</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-1.5 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                  GLAZE RATE
                </div>
                <div className="flex items-end gap-0.5">
                  <div className="text-2xl font-semibold text-white">🍩5</div>
                  <span className="pb-1 text-xs text-gray-400">/s</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-1.5 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                  GLAZE PRICE
                </div>
                <div className="text-2xl font-semibold text-pink-400">
                  Ξ0.012
                </div>
              </CardContent>
            </Card>
          </div>

          <Button className="w-full rounded-2xl bg-pink-500 py-3.5 text-base font-bold text-black shadow-lg transition-colors hover:bg-pink-400">
            GLAZE
          </Button>

          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-400">
              Your Balances
            </div>
            <div className="flex justify-between text-[13px] font-semibold">
              <div className="flex items-center gap-2">
                <span>🍩</span>
                <span>343.23</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Ξ</span>
                <span>1.334</span>
              </div>
            </div>
          </div>
        </div>

        <p className="px-1 pt-2 text-center text-[12px] leading-snug text-gray-400">
          Pay the Glaze Price to become the King Glazer. Earn $DONUT each second
          until another player glazes the donut. 80% of their payment goes to
          you.
        </p>
      </div>
    </main>
  );
}
