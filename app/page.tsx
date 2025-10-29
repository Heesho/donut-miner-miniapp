"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "@farcaster/miniapp-sdk";
import { CircleUserRound } from "lucide-react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { formatEther, formatUnits, zeroAddress, type Address } from "viem";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CONTRACT_ADDRESSES,
  MINER_ABI,
  MULTICALL_ABI,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";

type MiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

type MinerState = {
  epochId: bigint | number;
  initPrice: bigint;
  startTime: bigint | number;
  glazed: bigint;
  price: bigint;
  dps: bigint;
  nextDps: bigint;
  miner: Address;
  uri: string;
  ethBalance: bigint;
  donutBalance: bigint;
};

type GlazeState = "idle" | "pending" | "success" | "failure";

const DONUT_DECIMALS = 18;
const DEADLINE_BUFFER_SECONDS = 15 * 60;

const toBigInt = (value: bigint | number) =>
  typeof value === "bigint" ? value : BigInt(value);

const formatTokenAmount = (
  value: bigint,
  decimals: number,
  maximumFractionDigits = 2,
) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatUnits(value, decimals));
  if (!Number.isFinite(asNumber)) {
    return formatUnits(value, decimals);
  }
  return asNumber.toLocaleString(undefined, {
    maximumFractionDigits,
  });
};

const formatEth = (value: bigint, maximumFractionDigits = 4) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatEther(value));
  if (!Number.isFinite(asNumber)) {
    return formatEther(value);
  }
  return asNumber.toLocaleString(undefined, {
    maximumFractionDigits,
  });
};

const formatAddress = (addr?: string) => {
  if (!addr) return "—";
  const normalized = addr.toLowerCase();
  if (normalized === zeroAddress) return "No miner";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};

const initialsFrom = (label?: string) => {
  if (!label) return "";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
};

export default function HomePage() {
  const readyRef = useRef(false);
  const autoConnectAttempted = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [glazeState, setGlazeState] = useState<GlazeState>("idle");
  const glazeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const updateGlazeState = useCallback((next: GlazeState) => {
    if (glazeResetTimeoutRef.current) {
      clearTimeout(glazeResetTimeoutRef.current);
      glazeResetTimeoutRef.current = null;
    }
    setGlazeState(next);
    if (next === "success" || next === "failure") {
      glazeResetTimeoutRef.current = setTimeout(() => {
        setGlazeState("idle");
        glazeResetTimeoutRef.current = null;
      }, 3000);
    }
  }, []);

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
    return () => {
      if (glazeResetTimeoutRef.current) {
        clearTimeout(glazeResetTimeoutRef.current);
      }
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

  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const primaryConnector = connectors[0];

  useEffect(() => {
    if (
      autoConnectAttempted.current ||
      isConnected ||
      !primaryConnector ||
      isConnecting
    ) {
      return;
    }
    autoConnectAttempted.current = true;
    connectAsync({
      connector: primaryConnector,
      chainId: base.id,
    }).catch(() => {
      // Ignore auto-connect failures; user can connect manually.
    });
  }, [connectAsync, isConnected, isConnecting, primaryConnector]);

  const { data: rawMinerState, refetch: refetchMinerState } = useReadContract({
    address: CONTRACT_ADDRESSES.multicall,
    abi: MULTICALL_ABI,
    functionName: "getMiner",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: {
      refetchInterval: 1_000,
    },
  });

  const minerState = useMemo(() => {
    if (!rawMinerState) return undefined;
    return rawMinerState as unknown as MinerState;
  }, [rawMinerState]);

  useEffect(() => {
    if (!readyRef.current && minerState) {
      readyRef.current = true;
      sdk.actions.ready().catch(() => {});
    }
  }, [minerState]);

  const {
    data: txHash,
    writeContract,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: base.id,
  });

  useEffect(() => {
    if (!receipt) return;
    if (receipt.status === "success" || receipt.status === "reverted") {
      updateGlazeState(receipt.status === "success" ? "success" : "failure");
      refetchMinerState();
      const resetTimer = setTimeout(() => {
        resetWrite();
      }, 500);
      return () => clearTimeout(resetTimer);
    }
    return;
  }, [receipt, refetchMinerState, resetWrite, updateGlazeState]);

  const minerAddress = minerState?.miner ?? zeroAddress;
  const hasMiner = minerAddress !== zeroAddress;

  const { data: neynarUser } = useQuery<{
    user: {
      fid: number | null;
      username: string | null;
      displayName: string | null;
      pfpUrl: string | null;
    } | null;
  }>({
    queryKey: ["neynar-user", minerAddress],
    queryFn: async () => {
      const res = await fetch(
        `/api/neynar/user?address=${encodeURIComponent(minerAddress)}`,
      );
      if (!res.ok) {
        throw new Error("Failed to load Farcaster profile.");
      }
      return (await res.json()) as {
        user: {
          fid: number | null;
          username: string | null;
          displayName: string | null;
          pfpUrl: string | null;
        } | null;
      };
    },
    enabled: hasMiner,
    staleTime: 60_000,
    retry: false,
  });

  const handleGlaze = useCallback(async () => {
    if (!minerState) return;
    updateGlazeState("pending");
    try {
      let targetAddress = address;
      if (!targetAddress) {
        if (!primaryConnector) {
          throw new Error("Wallet connector not available yet.");
        }
        const result = await connectAsync({
          connector: primaryConnector,
          chainId: base.id,
        });
        targetAddress = result.accounts[0];
      }
      if (!targetAddress) {
        throw new Error("Unable to determine wallet address.");
      }
      const price = minerState.price;
      const epochId = toBigInt(minerState.epochId);
      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_SECONDS,
      );
      const maxPrice = price === 0n ? 0n : (price * 105n) / 100n;
      await writeContract({
        address: CONTRACT_ADDRESSES.miner,
        abi: MINER_ABI,
        functionName: "mine",
        args: [
          targetAddress,
          CONTRACT_ADDRESSES.provider,
          epochId,
          deadline,
          maxPrice,
          context?.user?.username ? `@${context.user.username}` : "",
        ],
        value: price,
        chainId: base.id,
      });
    } catch (error) {
      console.error("Failed to glaze:", error);
      updateGlazeState("failure");
      resetWrite();
    }
  }, [
    address,
    connectAsync,
    context?.user?.username,
    minerState,
    primaryConnector,
    resetWrite,
    updateGlazeState,
    writeContract,
  ]);

  const occupantDisplay = useMemo(() => {
    if (!minerState) {
      return {
        primary: "—",
        secondary: "",
        isYou: false,
        avatarUrl: null as string | null,
        isUnknown: true,
        addressLabel: "—",
      };
    }
    const minerAddr = minerState.miner;
    const fallback = formatAddress(minerAddr);
    const isYou =
      !!address &&
      minerAddr.toLowerCase() === (address as string).toLowerCase();

    const profile = neynarUser?.user ?? null;
    const profileUsername = profile?.username
      ? `@${profile.username}`
      : undefined;

    const hasProfile = !!profile;

    const contextProfile = context?.user ?? null;
    const contextPrimaryLabel = contextProfile?.username
      ? `@${contextProfile.username}`
      : contextProfile?.displayName ?? null;

    const addressLabel = fallback;

    const primary = hasProfile
      ? profileUsername ?? profile?.displayName ?? addressLabel
      : isYou && contextPrimaryLabel
        ? contextPrimaryLabel
        : addressLabel;

    const secondary = "";

    const avatarUrl = hasProfile
      ? profile?.pfpUrl ?? (isYou ? contextProfile?.pfpUrl ?? null : null)
      : isYou
        ? contextProfile?.pfpUrl ?? null
        : null;

    return {
      primary,
      secondary,
      isYou,
      avatarUrl,
      isUnknown: !hasProfile && !isYou,
      addressLabel,
    };
  }, [
    address,
    context?.user?.displayName,
    context?.user?.pfpUrl,
    context?.user?.username,
    minerState,
    neynarUser?.user,
  ]);

  const glazeRateDisplay = minerState
    ? formatTokenAmount(minerState.nextDps, DONUT_DECIMALS, 4)
    : "—";
  const glazePriceDisplay = minerState
    ? `Ξ${formatEth(minerState.price, minerState.price === 0n ? 0 : 5)}`
    : "Ξ—";
  const glazedDisplay = minerState
    ? `🍩${formatTokenAmount(minerState.glazed, DONUT_DECIMALS, 2)}`
    : "🍩—";

  const occupantInitialsSource = occupantDisplay.isUnknown
    ? occupantDisplay.addressLabel
    : occupantDisplay.primary || occupantDisplay.addressLabel;

  const occupantFallbackInitials = occupantDisplay.isUnknown
    ? (occupantInitialsSource?.slice(-2) ?? "??").toUpperCase()
    : initialsFrom(occupantInitialsSource);

  const donutBalanceDisplay =
    minerState && minerState.donutBalance !== undefined
      ? formatTokenAmount(minerState.donutBalance, DONUT_DECIMALS, 2)
      : "—";
  const ethBalanceDisplay =
    minerState && minerState.ethBalance !== undefined
      ? formatEth(minerState.ethBalance, 4)
      : "—";

  const buttonLabel = useMemo(() => {
    if (!minerState) return "Loading…";
    if (glazeState === "success") return "SUCCESS";
    if (glazeState === "failure") return "FAILURE";
    if (glazeState === "pending" || isWriting || isConfirming) {
      return "GLAZING…";
    }
    return "GLAZE";
  }, [glazeState, isConfirming, isWriting, minerState]);

  const isGlazeProcessing =
    glazeState !== "idle" || isWriting || isConfirming;
  const isGlazeDisabled = !minerState || isGlazeProcessing;

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
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        }}
      >
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-wide">GLAZE CORP</h1>
            <div className="flex items-center gap-2 rounded-full bg-black px-3 py-1">
              <Avatar className="h-8 w-8 border border-zinc-800">
                {userAvatarUrl ? (
                  <AvatarImage
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    className="object-cover"
                  />
                ) : null}
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
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Card
              className={cn(
                "border-zinc-800 bg-black transition-shadow",
                occupantDisplay.isYou &&
                  "border-pink-500 shadow-[inset_0_0_24px_rgba(236,72,153,0.55)] animate-glow",
              )}
            >
              <CardContent className="grid gap-1.5 p-2.5">
                <div
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.08em]",
                    occupantDisplay.isYou
                      ? "text-pink-400"
                      : "text-gray-400",
                  )}
                >
                  KING GLAZER
                </div>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {occupantDisplay.avatarUrl ? (
                      <AvatarImage
                        src={occupantDisplay.avatarUrl}
                        alt={occupantDisplay.primary}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="bg-zinc-800 text-white text-xs uppercase">
                      {minerState ? (
                        occupantFallbackInitials
                      ) : (
                        <CircleUserRound className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="leading-tight text-left">
                    <div className="flex items-center gap-1 text-sm text-white">
                      <span>{occupantDisplay.primary}</span>
                    </div>
                    {occupantDisplay.secondary ? (
                      <div className="text-[11px] text-gray-400">
                        {occupantDisplay.secondary}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-black">
              <CardContent className="grid gap-1.5 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                  GLAZED
                </div>
                <div className="text-2xl font-semibold text-white">
                  {glazedDisplay}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-2 -mx-2 w-[calc(100%+1rem)] overflow-hidden">
            <video
              className="aspect-[16/9] w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              src="/media/donut-loop.mp4"
            />
          </div>

          <div className="mt-2 flex flex-col gap-3 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <Card className="border-zinc-800 bg-black">
                <CardContent className="grid gap-1.5 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                    GLAZE RATE
                  </div>
                  <div className="text-2xl font-semibold text-white">
                    🍩{glazeRateDisplay}
                    <span className="text-xs text-gray-400"> /s</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-zinc-800 bg-black">
                <CardContent className="grid gap-1.5 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                    GLAZE PRICE
                  </div>
                  <div className="text-2xl font-semibold text-pink-400">
                    {glazePriceDisplay}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Button
              className="w-full rounded-2xl bg-pink-500 py-3.5 text-base font-bold text-black shadow-lg transition-colors hover:bg-pink-400 disabled:cursor-not-allowed disabled:bg-pink-500/40"
              onClick={handleGlaze}
              disabled={isGlazeDisabled}
            >
              {buttonLabel}
            </Button>

            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-400">
                Your Balances
              </div>
              <div className="flex justify-between text-[13px] font-semibold">
                <div className="flex items-center gap-2">
                  <span>🍩</span>
                  <span>{donutBalanceDisplay}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Ξ</span>
                  <span>{ethBalanceDisplay}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <p className="mt-3 px-2 text-center text-[11px] leading-snug text-gray-400">
              Pay the glaze price to become the King Glazer. Earn $DONUT every
              second until another player glazes the donut. 80% of their payment
              goes back to you.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
