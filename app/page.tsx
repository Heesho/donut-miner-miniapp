"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "@farcaster/miniapp-sdk";
import { CircleUserRound, Volume2, VolumeOff } from "lucide-react";
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
import { CONTRACT_ADDRESSES, MULTICALL_ABI } from "@/lib/contracts";
import { cn, getEthPrice } from "@/lib/utils";
import { useAccountData } from "@/hooks/useAccountData";
import { NavBar } from "@/components/nav-bar";
import { AddToFarcasterDialog } from "@/components/add-to-farcaster-dialog";

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
  donutPrice: bigint;
  miner: Address;
  uri: string;
  ethBalance: bigint;
  wethBalance: bigint;
  donutBalance: bigint;
};

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
  const [customMessage, setCustomMessage] = useState("");
  const [ethUsdPrice, setEthUsdPrice] = useState<number>(3500);
  const [glazeResult, setGlazeResult] = useState<"success" | "failure" | null>(
    null,
  );
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const glazeResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const resetGlazeResult = useCallback(() => {
    if (glazeResultTimeoutRef.current) {
      clearTimeout(glazeResultTimeoutRef.current);
      glazeResultTimeoutRef.current = null;
    }
    setGlazeResult(null);
  }, []);
  const showGlazeResult = useCallback(
    (result: "success" | "failure") => {
      if (glazeResultTimeoutRef.current) {
        clearTimeout(glazeResultTimeoutRef.current);
      }
      setGlazeResult(result);
      glazeResultTimeoutRef.current = setTimeout(() => {
        setGlazeResult(null);
        glazeResultTimeoutRef.current = null;
      }, 3000);
    },
    [],
  );

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
      if (glazeResultTimeoutRef.current) {
        clearTimeout(glazeResultTimeoutRef.current);
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

  // Ensure video is muted on mount for autoplay to work in all WebViews
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
    }
  }, []);

  // Fetch ETH price on mount and every minute
  useEffect(() => {
    const fetchPrice = async () => {
      const price = await getEthPrice();
      setEthUsdPrice(price);
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000); // Update every minute

    return () => clearInterval(interval);
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
      refetchInterval: 3_000,
    },
  });

  const minerState = useMemo(() => {
    if (!rawMinerState) return undefined;
    return rawMinerState as unknown as MinerState;
  }, [rawMinerState]);

  const { data: accountData } = useAccountData(address);

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
      showGlazeResult(
        receipt.status === "success" ? "success" : "failure",
      );
      refetchMinerState();
      const resetTimer = setTimeout(() => {
        resetWrite();
      }, 500);
      return () => clearTimeout(resetTimer);
    }
    return;
  }, [receipt, refetchMinerState, resetWrite, showGlazeResult]);

  const minerAddress = minerState?.miner ?? zeroAddress;
  const hasMiner = minerAddress !== zeroAddress;

  const claimedHandleParam = (minerState?.uri ?? "").trim();

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
    resetGlazeResult();
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
        account: targetAddress as Address,
        address: CONTRACT_ADDRESSES.multicall as Address,
        abi: MULTICALL_ABI,
        functionName: "mine",
        args: [
          targetAddress as Address, // Miner gets the 5% provider fee as a rebate
          epochId,
          deadline,
          maxPrice,
          customMessage.trim() || "We Glaze The World",
        ],
        value: price,
        chainId: base.id,
      });
    } catch (error) {
      console.error("Failed to glaze:", error);
      showGlazeResult("failure");
      resetWrite();
    }
  }, [
    address,
    connectAsync,
    customMessage,
    minerState,
    primaryConnector,
    resetGlazeResult,
    resetWrite,
    showGlazeResult,
    writeContract,
  ]);

  // Local state for smooth glazed counter interpolation
  const [interpolatedGlazed, setInterpolatedGlazed] = useState<bigint | null>(null);

  // Local state for glaze time tracking
  const [glazeElapsedSeconds, setGlazeElapsedSeconds] = useState<number>(0);

  // Update interpolated glazed amount smoothly between fetches
  useEffect(() => {
    if (!minerState) {
      setInterpolatedGlazed(null);
      return;
    }

    // Start with the fetched value
    setInterpolatedGlazed(minerState.glazed);

    // Update every second with interpolated value
    const interval = setInterval(() => {
      if (minerState.nextDps > 0n) {
        setInterpolatedGlazed((prev) => {
          if (!prev) return minerState.glazed;
          return prev + minerState.nextDps;
        });
      }
    }, 1_000);

    return () => clearInterval(interval);
  }, [minerState]);

  // Update glaze elapsed time every second
  useEffect(() => {
    if (!minerState) {
      setGlazeElapsedSeconds(0);
      return;
    }

    // Calculate initial elapsed time
    const startTimeSeconds = Number(minerState.startTime);
    const initialElapsed = Math.floor(Date.now() / 1000) - startTimeSeconds;
    setGlazeElapsedSeconds(initialElapsed);

    // Update every second
    const interval = setInterval(() => {
      const currentElapsed = Math.floor(Date.now() / 1000) - startTimeSeconds;
      setGlazeElapsedSeconds(currentElapsed);
    }, 1_000);

    return () => clearInterval(interval);
  }, [minerState]);

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

    const fallbackAvatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(
      minerAddr.toLowerCase(),
    )}`;

    const profile = neynarUser?.user ?? null;
    const profileUsername = profile?.username
      ? `@${profile.username}`
      : null;
    const profileDisplayName = profile?.displayName ?? null;

    const contextProfile = context?.user ?? null;
    const contextHandle = contextProfile?.username
      ? `@${contextProfile.username}`
      : null;
    const contextDisplayName = contextProfile?.displayName ?? null;

    const claimedHandle = claimedHandleParam
      ? claimedHandleParam.startsWith("@")
        ? claimedHandleParam
        : `@${claimedHandleParam}`
      : null;

    const addressLabel = fallback;

    const labelCandidates = [
      profileDisplayName,
      profileUsername,
      isYou ? contextDisplayName : null,
      isYou ? contextHandle : null,
      addressLabel,
    ].filter((label): label is string => !!label);

    const seenLabels = new Set<string>();
    const uniqueLabels = labelCandidates.filter((label) => {
      const key = label.toLowerCase();
      if (seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    });

    const primary = uniqueLabels[0] ?? addressLabel;

    const secondary =
      uniqueLabels.find(
        (label) => label !== primary && label.startsWith("@"),
      ) ?? "";

    const avatarUrl =
      profile?.pfpUrl ??
      (isYou ? contextProfile?.pfpUrl ?? null : null) ??
      fallbackAvatarUrl;

    const isUnknown =
      !profile && !claimedHandle && !(isYou && (contextHandle || contextDisplayName));

    return {
      primary,
      secondary,
      isYou,
      avatarUrl,
      isUnknown,
      addressLabel,
    };
  }, [
    address,
    claimedHandleParam,
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
  const glazeNetPriceDisplay = minerState
    ? `Ξ${formatEth((minerState.price * 95n) / 100n, minerState.price === 0n ? 0 : 5)}`
    : "Ξ—";
  const glazedDisplay = minerState && interpolatedGlazed !== null
    ? `🍩${formatTokenAmount(interpolatedGlazed, DONUT_DECIMALS, 2)}`
    : "🍩—";

  // Format glaze elapsed time with units
  const formatGlazeTime = (seconds: number): string => {
    if (seconds < 0) return "0s";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const glazeTimeDisplay = minerState
    ? formatGlazeTime(glazeElapsedSeconds)
    : "—";

  // Calculate USD values for donuts
  const glazedUsdValue = minerState && minerState.donutPrice > 0n && interpolatedGlazed !== null
    ? (Number(formatEther(interpolatedGlazed)) * Number(formatEther(minerState.donutPrice)) * ethUsdPrice).toFixed(2)
    : "0.00";

  const glazeRateUsdValue = minerState && minerState.donutPrice > 0n
    ? (Number(formatUnits(minerState.nextDps, DONUT_DECIMALS)) * Number(formatEther(minerState.donutPrice)) * ethUsdPrice).toFixed(4)
    : "0.0000";

  // Calculate PNL in USD
  const pnlUsdValue = minerState
    ? (() => {
        const pnl = (minerState.price * 80n) / 100n - minerState.initPrice / 2n;
        const pnlEth = Number(formatEther(pnl >= 0n ? pnl : -pnl));
        const pnlUsd = pnlEth * ethUsdPrice;
        const sign = pnl >= 0n ? "+" : "-";
        return `${sign}$${pnlUsd.toFixed(2)}`;
      })()
    : "$0.00";

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
    if (glazeResult === "success") return "SUCCESS";
    if (glazeResult === "failure") return "FAILURE";
    if (isWriting || isConfirming) {
      return "GLAZING…";
    }
    return "GLAZE";
  }, [glazeResult, isConfirming, isWriting, minerState]);

  const isGlazeDisabled =
    !minerState || isWriting || isConfirming || glazeResult !== null;

  const handleViewKingGlazerProfile = useCallback(() => {
    const fid = neynarUser?.user?.fid;
    const username = neynarUser?.user?.username;
    console.log("King Glazer clicked, FID:", fid, "Username:", username);

    if (username) {
      // Open Farcaster profile URL using username (cleaner URL)
      window.open(`https://warpcast.com/${username}`, "_blank", "noopener,noreferrer");
    } else if (fid) {
      // Fallback to FID-based URL if username not available
      window.open(`https://warpcast.com/~/profiles/${fid}`, "_blank", "noopener,noreferrer");
    } else {
      console.log("No FID or username available for King Glazer");
    }
  }, [neynarUser?.user?.fid, neynarUser?.user?.username]);

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
      {/* Add to Farcaster Dialog - shows on first visit */}
      <AddToFarcasterDialog showOnFirstVisit={true} />

      <div
        className="relative flex h-full w-full max-w-[520px] flex-1 flex-col overflow-hidden rounded-[28px] bg-black px-2 pb-4 shadow-inner"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-wide">GLAZERY</h1>
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

          <Card
            className={cn(
              "mt-1 border-zinc-800 bg-gradient-to-br from-zinc-950 to-black transition-shadow rounded-xl",
              occupantDisplay.isYou &&
                "border-pink-500 shadow-[inset_0_0_24px_rgba(236,72,153,0.55)] animate-glow",
            )}
          >
            <div className="px-2 py-1.5 flex items-center justify-between gap-2">
              {/* Left Section: Title + Profile */}
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                {/* King Glazer Title */}
                <div
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-[0.1em]",
                    occupantDisplay.isYou
                      ? "text-pink-400"
                      : "text-gray-400",
                  )}
                >
                  KING GLAZER
                </div>

                {/* Profile Section */}
                <div
                  className={cn(
                    "flex items-center gap-2 min-w-0",
                    neynarUser?.user?.fid && "cursor-pointer hover:opacity-80 transition-opacity"
                  )}
                  onClick={neynarUser?.user?.fid ? handleViewKingGlazerProfile : undefined}
                >
                <Avatar className="h-7 w-7 flex-shrink-0 ring-2 ring-zinc-800">
                  <AvatarImage
                    src={occupantDisplay.avatarUrl || undefined}
                    alt={occupantDisplay.primary}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-zinc-800 text-white text-xs uppercase">
                    {minerState ? (
                      occupantFallbackInitials
                    ) : (
                      <CircleUserRound className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight text-left min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-white truncate">
                    <span className="truncate">{occupantDisplay.primary}</span>
                  </div>
                  {occupantDisplay.secondary ? (
                    <div className="text-[9px] text-gray-400 truncate">
                      {occupantDisplay.secondary}
                    </div>
                  ) : null}
                </div>
                </div>
              </div>

              {/* Stats Section - Glazed and PNL stacked */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                {/* Time Row */}
                <div className="flex items-center gap-1">
                  <div className="text-[7px] font-bold uppercase tracking-[0.08em] text-gray-400 w-9 text-right">
                    TIME
                  </div>
                  <div className="text-[10px] font-semibold text-white">
                    {glazeTimeDisplay}
                  </div>
                </div>

                {/* Glazed Row */}
                <div className="flex items-center gap-1">
                  <div className="text-[7px] font-bold uppercase tracking-[0.08em] text-gray-400 w-9 text-right">
                    GLAZED
                  </div>
                  <div className="text-[10px] font-semibold text-white">
                    +{glazedDisplay}
                  </div>
                  <div className="text-[8px] text-gray-400">
                    +${glazedUsdValue}
                  </div>
                </div>

                {/* PNL Row */}
                <div className="flex items-center gap-1">
                  <div className="text-[7px] font-bold uppercase tracking-[0.08em] text-gray-400 w-9 text-right">
                    PNL
                  </div>
                  <div className="text-[10px] font-semibold text-white">
                    {minerState
                      ? (() => {
                          const pnl = (minerState.price * 80n) / 100n - minerState.initPrice / 2n;
                          const sign = pnl >= 0n ? "+" : "-";
                          const absolutePnl = pnl >= 0n ? pnl : -pnl;
                          return `${sign}Ξ${formatEth(absolutePnl, 5)}`;
                        })()
                      : "Ξ—"}
                  </div>
                  <div className="text-[8px] text-gray-400">
                    {pnlUsdValue}
                  </div>
                </div>

                {/* Total Row */}
                <div className="flex items-center gap-1">
                  <div className="text-[7px] font-bold uppercase tracking-[0.08em] text-gray-400 w-9 text-right">
                    TOTAL
                  </div>
                  <div className={cn(
                    "text-[10px] font-semibold",
                    minerState && (() => {
                      const pnl = (minerState.price * 80n) / 100n - minerState.initPrice / 2n;
                      const pnlEth = Number(formatEther(pnl >= 0n ? pnl : -pnl));
                      const pnlUsd = pnlEth * ethUsdPrice * (pnl >= 0n ? 1 : -1);
                      const glazedUsd = Number(glazedUsdValue);
                      return (glazedUsd + pnlUsd) >= 0;
                    })()
                      ? "text-green-400"
                      : "text-red-400"
                  )}>
                    {minerState
                      ? (() => {
                          const pnl = (minerState.price * 80n) / 100n - minerState.initPrice / 2n;
                          const pnlEth = Number(formatEther(pnl >= 0n ? pnl : -pnl));
                          const pnlUsd = pnlEth * ethUsdPrice * (pnl >= 0n ? 1 : -1);
                          const glazedUsd = Number(glazedUsdValue);
                          const total = glazedUsd + pnlUsd;
                          const sign = total >= 0 ? "+" : "-";
                          return `${sign}$${Math.abs(total).toFixed(2)}`;
                        })()
                      : "$—"}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="relative mt-1 overflow-hidden bg-black">
            <div className="flex animate-scroll whitespace-nowrap py-1 text-sm font-bold text-pink-500">
              {Array.from({ length: 1000 }).map((_, i) => (
                <span key={i} className="inline-block px-8">
                  {minerState?.uri && minerState.uri.trim() !== ""
                    ? minerState.uri
                    : "We Glaze The World"}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-1 -mx-2 w-[calc(100%+1rem)] overflow-hidden relative">
            <video
              ref={videoRef}
              className="w-full object-contain"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              src="/media/donut-loop.mp4"
            />
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !videoRef.current.muted;
                }
                setIsMuted(!isMuted);
              }}
              className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeOff className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
          </div>

          <div className="mt-1 flex flex-col gap-1.5 pb-1">
            <div className="grid grid-cols-2 gap-1.5">
              <Card className="border-zinc-800 bg-black">
                <CardContent className="grid gap-0.5 p-2">
                  <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-gray-400">
                    GLAZE RATE
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-base leading-none">🍩</span>
                    <span className="text-xl font-semibold text-white">{glazeRateDisplay}</span>
                    <span className="text-[10px] text-gray-400">/s</span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    ${glazeRateUsdValue}/s
                  </div>
                </CardContent>
              </Card>

              <Card className="border-zinc-800 bg-black">
                <CardContent className="grid gap-0.5 p-2">
                  <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-gray-400">
                    GLAZE PRICE <span className="text-green-400">(5% REBATE)</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-semibold text-pink-400">{glazeNetPriceDisplay}</span>
                    <span className="text-xs text-gray-500 line-through">{glazePriceDisplay}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    $
                    {minerState
                      ? (
                          Number(formatEther((minerState.price * 95n) / 100n)) * ethUsdPrice
                        ).toFixed(2)
                      : "0.00"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a message (optional)"
              maxLength={100}
              className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isGlazeDisabled}
            />

            <Button
              className="w-full rounded-2xl bg-pink-500 py-2 text-sm font-bold text-black shadow-lg transition-colors hover:bg-pink-400 disabled:cursor-not-allowed disabled:bg-pink-500/40"
              onClick={handleGlaze}
              disabled={isGlazeDisabled}
            >
              {buttonLabel}
            </Button>
          </div>

          <div className="mt-auto px-2 pb-1">
            <div className="mb-0.5 text-[11px] uppercase tracking-wide text-gray-400">
              Your Balances
            </div>

            <div className="flex justify-between">
              {/* Left Column - Donut Balance & Mined */}
              <div className="flex flex-col gap-0.5 items-start">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span>🍩</span>
                  <span>{donutBalanceDisplay}</span>
                </div>
                <div className="flex flex-col items-start text-[11px]">
                  <span className="text-gray-400 mb-0">Mined</span>
                  <div className="flex items-center gap-1">
                    <span>🍩</span>
                    <span className="font-semibold">
                      {address && accountData?.mined
                        ? Number(accountData.mined).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : "0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle Column - ETH Balance & Spent */}
              <div className="flex flex-col gap-0.5 items-start">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span>Ξ</span>
                  <span>{ethBalanceDisplay}</span>
                </div>
                <div className="flex flex-col items-start text-[11px]">
                  <span className="text-gray-400 mb-0">Spent</span>
                  <div className="flex items-center gap-1">
                    <span>Ξ</span>
                    <span className="font-semibold">
                      {address && accountData?.spent
                        ? Number(accountData.spent).toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })
                        : "0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column - WETH Balance & Earned */}
              <div className="flex flex-col gap-0.5 items-start">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span>wΞ</span>
                  <span>
                    {minerState && minerState.wethBalance !== undefined
                      ? formatEth(minerState.wethBalance, 4)
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-col items-start text-[11px]">
                  <span className="text-gray-400 mb-0">Earned</span>
                  <div className="flex items-center gap-1">
                    <span>wΞ</span>
                    <span className="font-semibold">
                      {address && accountData?.earned
                        ? Number(accountData.earned).toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })
                        : "0"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <NavBar />
    </main>
  );
}
