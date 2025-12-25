"use client";

import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { NavBar } from "@/components/nav-bar";
import { Wallet, BarChart3, ExternalLink, Vote } from "lucide-react";

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
        if (!cancelled) setContext(ctx);
      } catch {
        if (!cancelled) setContext(null);
      }
    };
    hydrateContext();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      sdk.actions.ready().catch(() => {});
    }
  }, []);

  const userDisplayName = context?.user?.displayName ?? context?.user?.username ?? "User";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;

  return (
    <main className="flex min-h-screen w-full max-w-[430px] mx-auto flex-col bg-background font-mono text-foreground">
      <div
        className="flex flex-col h-screen px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">About</h1>
          {context?.user && (
            <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
              <Avatar className="h-6 w-6">
                <AvatarImage src={userAvatarUrl || undefined} alt={userDisplayName} />
                <AvatarFallback className="text-[10px]">{initialsFrom(userDisplayName)}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{context.user.username || `fid:${context.user.fid}`}</span>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <a
            href="https://debank.com/profile/0x690c2e187c8254a887b35c0b4477ce6787f92855"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="p-2 flex items-center justify-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Portfolio</span>
              </CardContent>
            </Card>
          </a>
          <a
            href="https://app.aragon.org/dao/base-mainnet/0x690C2e187c8254a887B35C0B4477ce6787F92855/dashboard"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="p-2 flex items-center justify-center gap-1.5">
                <Vote className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">DAO</span>
              </CardContent>
            </Card>
          </a>
          <a
            href="https://dune.com/xyk/donut-company"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="p-2 flex items-center justify-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Analytics</span>
              </CardContent>
            </Card>
          </a>
        </div>

        {/* Scrollable Content */}
        <Card className="flex-1 min-h-0">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-4">
              <Section title="What Is $DONUT">
                <li>$DONUT is a store-of-value token on Base</li>
                <li>Mined through a continuous Dutch auction instead of proof-of-work or staking</li>
                <li>Auction revenue increases $DONUT&apos;s liquidity and scarcity</li>
              </Section>

              <Section title="How Mining Works">
                <li>Only one active miner at a time, called the King Glazer</li>
                <li>The right to mine is bought with ETH through a continuous Dutch auction</li>
                <li>Price doubles after each purchase, then decays to 0 over one hour</li>
                <li>Anyone can purchase control of emissions at the current price</li>
              </Section>

              <Section title="Revenue Split">
                <li>80% → previous King Glazer</li>
                <li>15% → treasury</li>
                <li>5% → provider (frontend host)</li>
              </Section>

              <Section title="Emission Schedule">
                <li>Starts at 4 DONUT / sec</li>
                <li>Halving every 30 days</li>
                <li>Tail emission: 0.01 DONUT / sec (forever)</li>
              </Section>

              <Section title="Proof of Just-In-Time Stake">
                <li>ETH is &quot;staked&quot; only while controlling emissions</li>
                <li>Profit if the next purchase pays more</li>
                <li>Lose if it pays less</li>
                <li>Earn $DONUT the entire time you hold control</li>
              </Section>

              <Section title="Liquid Signal Governance (LSG)">
                <li>A decentralized protocol for managing revenue allocation through liquid democracy</li>
                <li>Token holders vote on strategies to determine how protocol revenue is distributed</li>
                <li>No multisigs or hard-coded fee splits - voting power directly influences proportional distribution</li>
                <li>Flexible strategies: buybacks, LP accumulation, treasury diversification, and more</li>
              </Section>

              <Section title="Staking for Voting Power">
                <li>Stake DONUT to receive gDONUT (1:1 ratio)</li>
                <li>gDONUT is non-transferable - prevents flash loan attacks on governance</li>
                <li>Delegate your voting power to yourself or another address</li>
                <li>Must clear all votes before unstaking</li>
              </Section>

              <Section title="Voting on Strategies">
                <li>Allocate your voting power across multiple strategies</li>
                <li>Vote weights determine proportional revenue distribution</li>
                <li>One epoch delay between voting and resetting (7 days)</li>
                <li>Revenue flows through RevenueRouter to the Voter contract</li>
              </Section>

              <Section title="Dutch Auctions">
                <li>Treasury WETH is sold via descending-price auctions</li>
                <li>Price starts high and decays linearly toward zero over the epoch</li>
                <li>Buy when the price is profitable for you!</li>
              </Section>

              <Section title="Voter Incentives (Bribes)">
                <li>20% of auction payments are routed to bribe contracts</li>
                <li>Voters earn rewards proportional to their vote weight on each strategy</li>
                <li>Claim accumulated rewards anytime on the Vote page</li>
                <li>Creates sustainable incentives for governance participation</li>
              </Section>

              <Section title="Builder Codes">
                <li>Anyone can host their own Donut Shop by deploying a frontend</li>
                <li>Add your builder code to earn 5% of all purchases made through your shop</li>
              </Section>
            </div>
          </CardContent>
        </Card>
      </div>

      <NavBar />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-primary mb-1.5">{title}</h2>
      <ul className="space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
        {children}
      </ul>
    </div>
  );
}
