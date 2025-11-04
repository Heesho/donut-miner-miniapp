"use client";

import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavBar } from "@/components/nav-bar";

type MiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

const initialsFrom = (label?: string) => {
  if (!label) return "";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
};

export default function AboutPage() {
  const readyRef = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrateContext = async () => {
      try {
        const ctx = (await (sdk as unknown as {
          context: Promise<MiniAppContext> | MiniAppContext;
        }).context) as MiniAppContext;
        if (!cancelled) {
          setContext(ctx);
        }
      } catch {
        if (!cancelled) setContext(null);
      }
    };
    hydrateContext();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!readyRef.current) {
        readyRef.current = true;
        sdk.actions.ready().catch(() => {});
      }
    }, 1200);
    return () => clearTimeout(timeout);
  }, []);

  const userDisplayName =
    context?.user?.displayName ?? context?.user?.username ?? "Farcaster user";
  const userHandle = context?.user?.username
    ? `@${context.user.username}`
    : context?.user?.fid
      ? `fid ${context.user.fid}`
      : "";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;

  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-black font-mono text-white">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-1 flex-col overflow-hidden rounded-[28px] bg-black px-2 pb-4 shadow-inner"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="flex flex-1 flex-col overflow-y-auto scrollbar-hide">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold tracking-wide">ABOUT</h1>
            {context?.user ? (
              <div className="flex items-center gap-2 rounded-full bg-black px-3 py-1">
                <Avatar className="h-8 w-8 border border-zinc-800">
                  <AvatarImage
                    src={userAvatarUrl || undefined}
                    alt={userDisplayName}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-zinc-800 text-white">
                    {initialsFrom(userDisplayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight text-left">
                  <div className="text-sm font-bold">{userDisplayName}</div>
                  {userHandle ? (
                    <div className="text-xs text-gray-400">{userHandle}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6 px-2">
            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                What is Glaze Corp?
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed">
                Glaze Corp is a competitive donut mining game where players race
                to control the glaze factory. Pay the current price to become
                the King Glazer and earn $DONUT tokens every second until
                another player takes your place.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                How Does It Work?
              </h2>
              <div className="space-y-3 text-sm text-gray-300">
                <div>
                  <h3 className="font-bold text-white mb-1">1. Glazery</h3>
                  <p className="leading-relaxed">
                    Pay the glaze price in ETH to become the King Glazer. You'll
                    earn $DONUT tokens every second at the current glaze rate.
                    When another player glazes, you receive 80% of their payment
                    back as WETH.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">2. Blazery</h3>
                  <p className="leading-relaxed">
                    Use the Blazery to participate in Dutch auctions. Buy
                    accumulated WETH from the protocol using DONUT-WETH LP
                    tokens. The auction price decreases over time, so timing is
                    everything.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                Economics
              </h2>
              <div className="space-y-2 text-sm text-gray-300">
                <p className="leading-relaxed">
                  The price to glaze increases with each transaction, creating a
                  competitive dynamic. 80% of each payment goes to the previous
                  King Glazer, while 20% is accumulated in the protocol for
                  Dutch auctions.
                </p>
                <p className="leading-relaxed">
                  The glaze rate (donuts per second) also increases over time,
                  rewarding early and strategic players who time their entries
                  well.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">Strategy</h2>
              <ul className="space-y-2 text-sm text-gray-300 list-disc list-inside">
                <li>Monitor the current price and glaze rate</li>
                <li>Consider how long you can hold the position</li>
                <li>Watch for auction opportunities in the Blazery</li>
                <li>Balance between mining donuts and participating in auctions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                Built on Base
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed">
                Glaze Corp runs entirely on Base, Coinbase's Ethereum L2. All
                transactions are fast and cheap, making it easy to compete for
                the King Glazer position and participate in auctions.
              </p>
            </section>

            <section className="pb-4">
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                Join the Competition
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed">
                Head over to the Glazery to start mining donuts, or check out
                the Blazery for auction opportunities. May the best glazer win!
              </p>
            </section>
          </div>
        </div>
      </div>
      <NavBar />
    </main>
  );
}
