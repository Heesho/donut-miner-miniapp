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
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-10 bg-black pb-2 flex items-center justify-between">
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

          <div className="space-y-6 px-2 overflow-y-auto scrollbar-hide flex-1">
            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                What Is $DONUT
              </h2>
              <div className="space-y-2 text-sm text-gray-300">
                <p className="leading-relaxed">
                  $DONUT is a store-of-value token on Base.
                </p>
                <p className="leading-relaxed">
                  It is mined through a continuous Dutch auction instead of proof-of-work or staking.
                </p>
                <p className="leading-relaxed">
                  Auction revenue increases $DONUT's liquidity and scarcity.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                How Mining Works
              </h2>
              <div className="space-y-2 text-sm text-gray-300">
                <p className="leading-relaxed">
                  Only one active miner at a time, called the King Glazer.
                </p>
                <p className="leading-relaxed">
                  The right to mine is bought with ETH through a continuous Dutch auction:
                </p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>Price doubles after each purchase.</li>
                  <li>Then decays to 0 over one hour.</li>
                  <li>Anyone can purchase control of emissions at the current price.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                Revenue Split
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>80% → previous King Glazer</li>
                <li>15% → treasury (Blazery)</li>
                <li>5% → provider (frontend host)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                Emission Schedule
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>Starts at 10 DONUT / sec</li>
                <li>Halving every 10 days</li>
                <li>Tail emission: 0.01 DONUT / sec (forever)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                Proof of Just-In-Time Stake
              </h2>
              <div className="space-y-2 text-sm text-gray-300">
                <p className="leading-relaxed">
                  ETH is "staked" only while controlling emissions.
                </p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>Profit if the next purchase pays more.</li>
                  <li>Lose if it pays less.</li>
                  <li>Earn $DONUT the entire time you hold control.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                Treasury
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed">
                Treasury ETH is used to buy and burn DONUT-WETH LP in the Blazery.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed mt-2">
                Once sufficient liquidity is established, the Glazery can be upgraded to buy and burn DONUT directly, or governance can decide to acquire other assets or reinvest the treasury.
              </p>
            </section>

            <section className="pb-4">
              <h2 className="text-lg font-bold text-pink-400 mb-2">
                Builder Codes
              </h2>
              <div className="space-y-2 text-sm text-gray-300">
                <p className="leading-relaxed">
                  Anyone can host their own Donut Shop by deploying a frontend.
                </p>
                <p className="leading-relaxed">
                  Add your builder code to earn 5% of all purchases made through your shop.
                </p>
                <p className="leading-relaxed">
                  The protocol will launch with two official Donut Shops:
                </p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>Glaze Corp by @heesh</li>
                  <li>Pinky Glazer by @bigbroc</li>
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>
      <NavBar />
    </main>
  );
}
