"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "@farcaster/miniapp-sdk";
import { CircleUserRound, Volume2, VolumeOff, Pickaxe, Zap } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_ADDRESSES, MINER_MULTICALL_ABI } from "@/lib/contracts";
import { cn, getEthPrice } from "@/lib/utils";
import { useAccountData } from "@/hooks/useAccountData";
import { NavBar } from "@/components/nav-bar";
import { TokenIcon } from "@/components/token-icon";
import { TOKEN_ADDRESSES } from "@/lib/tokens";

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
  return asNumber.toLocaleString(undefined, { maximumFractionDigits });
};

const formatEth = (value: bigint, maximumFractionDigits = 4) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatEther(value));
  if (!Number.isFinite(asNumber)) {
    return formatEther(value);
  }
  return asNumber.toLocaleString(undefined, { maximumFractionDigits });
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

const formatGlazeTime = (seconds: number): string => {
  if (seconds < 0) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

export default function HomePage() {
  const readyRef = useRef(false);
  const autoConnectAttempted = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [ethUsdPrice, setEthUsdPrice] = useState<number>(3500);
  const [glazeResult, setGlazeResult] = useState<"success" | "failure" | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const glazeResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetGlazeResult = useCallback(() => {
    if (glazeResultTimeoutRef.current) {
      clearTimeout(glazeResultTimeoutRef.current);
      glazeResultTimeoutRef.current = null;
    }
    setGlazeResult(null);
  }, []);

  const showGlazeResult = useCallback((result: "success" | "failure") => {
    if (glazeResultTimeoutRef.current) {
      clearTimeout(glazeResultTimeoutRef.current);
    }
    setGlazeResult(result);
    glazeResultTimeoutRef.current = setTimeout(() => {
      setGlazeResult(null);
      glazeResultTimeoutRef.current = null;
    }, 3000);
  }, []);

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
    return () => {
      if (glazeResultTimeoutRef.current) {
        clearTimeout(glazeResultTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      sdk.actions.ready().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const fetchPrice = async () => {
      const price = await getEthPrice();
      setEthUsdPrice(price);
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000);
    return () => clearInterval(interval);
  }, []);

  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const primaryConnector = connectors[0];

  useEffect(() => {
    if (autoConnectAttempted.current || isConnected || !primaryConnector || isConnecting) return;
    autoConnectAttempted.current = true;
    connectAsync({ connector: primaryConnector, chainId: base.id }).catch(() => {});
  }, [connectAsync, isConnected, isConnecting, primaryConnector]);

  const { data: rawMinerState, refetch: refetchMinerState } = useReadContract({
    address: CONTRACT_ADDRESSES.minerMulticall,
    abi: MINER_MULTICALL_ABI,
    functionName: "getMiner",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: { refetchInterval: 3_000 },
  });

  const minerState = useMemo(() => {
    if (!rawMinerState) return undefined;
    return rawMinerState as unknown as MinerState;
  }, [rawMinerState]);

  const { data: accountData } = useAccountData(address);

  const {
    data: txHash,
    writeContract,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: base.id,
  });

  useEffect(() => {
    if (!receipt) return;
    if (receipt.status === "success" || receipt.status === "reverted") {
      showGlazeResult(receipt.status === "success" ? "success" : "failure");
      refetchMinerState();
      const resetTimer = setTimeout(() => resetWrite(), 500);
      return () => clearTimeout(resetTimer);
    }
  }, [receipt, refetchMinerState, resetWrite, showGlazeResult]);

  const minerAddress = minerState?.miner ?? zeroAddress;
  const hasMiner = minerAddress !== zeroAddress;
  const claimedHandleParam = (minerState?.uri ?? "").trim();

  const { data: neynarUser } = useQuery<{
    user: { fid: number | null; username: string | null; displayName: string | null; pfpUrl: string | null } | null;
  }>({
    queryKey: ["neynar-user", minerAddress],
    queryFn: async () => {
      const res = await fetch(`/api/neynar/user?address=${encodeURIComponent(minerAddress)}`);
      if (!res.ok) throw new Error("Failed to load Farcaster profile.");
      return res.json();
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
        if (!primaryConnector) throw new Error("Wallet connector not available yet.");
        const result = await connectAsync({ connector: primaryConnector, chainId: base.id });
        targetAddress = result.accounts[0];
      }
      if (!targetAddress) throw new Error("Unable to determine wallet address.");

      const price = minerState.price;
      const epochId = toBigInt(minerState.epochId);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_SECONDS);

      // 5% rebate when using own address as provider
      const discountedPrice = (price * 95n) / 100n;
      const maxPrice = discountedPrice === 0n ? 0n : (discountedPrice * 105n) / 100n;

      await writeContract({
        account: targetAddress as Address,
        address: CONTRACT_ADDRESSES.minerMulticall as Address,
        abi: MINER_MULTICALL_ABI,
        functionName: "mine",
        args: [targetAddress as Address, epochId, deadline, maxPrice, customMessage.trim() || "We Glaze The World"],
        value: discountedPrice,
        chainId: base.id,
      });
    } catch (error) {
      console.error("Failed to glaze:", error);
      showGlazeResult("failure");
      resetWrite();
    }
  }, [address, connectAsync, customMessage, minerState, primaryConnector, resetGlazeResult, resetWrite, showGlazeResult, writeContract]);

  const [interpolatedGlazed, setInterpolatedGlazed] = useState<bigint | null>(null);
  const [glazeElapsedSeconds, setGlazeElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (!minerState) {
      setInterpolatedGlazed(null);
      return;
    }
    setInterpolatedGlazed(minerState.glazed);
    const interval = setInterval(() => {
      if (minerState.nextDps > 0n) {
        setInterpolatedGlazed((prev) => (prev ? prev + minerState.nextDps : minerState.glazed));
      }
    }, 1_000);
    return () => clearInterval(interval);
  }, [minerState]);

  useEffect(() => {
    if (!minerState) {
      setGlazeElapsedSeconds(0);
      return;
    }
    const startTimeSeconds = Number(minerState.startTime);
    const initialElapsed = Math.floor(Date.now() / 1000) - startTimeSeconds;
    setGlazeElapsedSeconds(initialElapsed);
    const interval = setInterval(() => {
      setGlazeElapsedSeconds(Math.floor(Date.now() / 1000) - startTimeSeconds);
    }, 1_000);
    return () => clearInterval(interval);
  }, [minerState]);

  const occupantDisplay = useMemo(() => {
    if (!minerState) {
      return { primary: "—", secondary: "", isYou: false, avatarUrl: null as string | null, isUnknown: true, addressLabel: "—" };
    }
    const minerAddr = minerState.miner;
    const fallback = formatAddress(minerAddr);
    const isYou = !!address && minerAddr.toLowerCase() === (address as string).toLowerCase();
    const fallbackAvatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(minerAddr.toLowerCase())}`;
    const profile = neynarUser?.user ?? null;
    const profileUsername = profile?.username ? `@${profile.username}` : null;
    const profileDisplayName = profile?.displayName ?? null;
    const contextProfile = context?.user ?? null;
    const contextHandle = contextProfile?.username ? `@${contextProfile.username}` : null;
    const contextDisplayName = contextProfile?.displayName ?? null;
    const claimedHandle = claimedHandleParam ? (claimedHandleParam.startsWith("@") ? claimedHandleParam : `@${claimedHandleParam}`) : null;
    const addressLabel = fallback;
    const labelCandidates = [profileDisplayName, profileUsername, isYou ? contextDisplayName : null, isYou ? contextHandle : null, addressLabel].filter((label): label is string => !!label);
    const seenLabels = new Set<string>();
    const uniqueLabels = labelCandidates.filter((label) => {
      const key = label.toLowerCase();
      if (seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    });
    const primary = uniqueLabels[0] ?? addressLabel;
    const secondary = uniqueLabels.find((label) => label !== primary && label.startsWith("@")) ?? "";
    const avatarUrl = profile?.pfpUrl ?? (isYou ? contextProfile?.pfpUrl ?? null : null) ?? fallbackAvatarUrl;
    const isUnknown = !profile && !claimedHandle && !(isYou && (contextHandle || contextDisplayName));
    return { primary, secondary, isYou, avatarUrl, isUnknown, addressLabel };
  }, [address, claimedHandleParam, context?.user, minerState, neynarUser?.user]);

  const glazeRateDisplay = minerState ? formatTokenAmount(minerState.nextDps, DONUT_DECIMALS, 4) : "—";
  const discountedPrice = minerState ? (minerState.price * 95n) / 100n : 0n;
  const glazePriceDisplay = minerState ? `Ξ${formatEth(discountedPrice, discountedPrice === 0n ? 0 : 5)}` : "Ξ—";
  const glazedDisplay = minerState && interpolatedGlazed !== null ? formatTokenAmount(interpolatedGlazed, DONUT_DECIMALS, 2) : "—";
  const glazeTimeDisplay = minerState ? formatGlazeTime(glazeElapsedSeconds) : "—";

  const glazedUsdValue = minerState && minerState.donutPrice > 0n && interpolatedGlazed !== null
    ? (Number(formatEther(interpolatedGlazed)) * Number(formatEther(minerState.donutPrice)) * ethUsdPrice).toFixed(2)
    : "0.00";

  const glazeRateUsdValue = minerState && minerState.donutPrice > 0n
    ? (Number(formatUnits(minerState.nextDps, DONUT_DECIMALS)) * Number(formatEther(minerState.donutPrice)) * ethUsdPrice).toFixed(4)
    : "0.0000";

  const pnlData = useMemo(() => {
    if (!minerState) return { pnlEth: "Ξ0", pnlUsd: "$0.00", totalUsd: "$0.00", isPositive: true };
    const pnl = (minerState.price * 80n) / 100n - minerState.initPrice / 2n;
    const isPositive = pnl >= 0n;
    const absolutePnl = isPositive ? pnl : -pnl;
    const pnlEth = `${isPositive ? "+" : "-"}Ξ${formatEth(absolutePnl, 5)}`;
    const pnlEthNum = Number(formatEther(absolutePnl)) * (isPositive ? 1 : -1);
    const pnlUsdNum = pnlEthNum * ethUsdPrice;
    const pnlUsd = `${pnlUsdNum >= 0 ? "+" : ""}$${Math.abs(pnlUsdNum).toFixed(2)}`;
    const glazedUsd = Number(glazedUsdValue);
    const totalNum = glazedUsd + pnlUsdNum;
    const totalUsd = `${totalNum >= 0 ? "+" : ""}$${Math.abs(totalNum).toFixed(2)}`;
    return { pnlEth, pnlUsd, totalUsd, isPositive: totalNum >= 0 };
  }, [minerState, ethUsdPrice, glazedUsdValue]);

  const occupantInitialsSource = occupantDisplay.isUnknown ? occupantDisplay.addressLabel : occupantDisplay.primary || occupantDisplay.addressLabel;
  const occupantFallbackInitials = occupantDisplay.isUnknown ? (occupantInitialsSource?.slice(-2) ?? "??").toUpperCase() : initialsFrom(occupantInitialsSource);

  const donutBalanceDisplay = minerState?.donutBalance !== undefined ? formatTokenAmount(minerState.donutBalance, DONUT_DECIMALS, 2) : "—";
  const ethBalanceDisplay = minerState?.ethBalance !== undefined ? formatEth(minerState.ethBalance, 4) : "—";

  const handleViewKingGlazerProfile = useCallback(() => {
    const username = neynarUser?.user?.username;
    const fid = neynarUser?.user?.fid;
    if (username) window.open(`https://warpcast.com/${username}`, "_blank", "noopener,noreferrer");
    else if (fid) window.open(`https://warpcast.com/~/profiles/${fid}`, "_blank", "noopener,noreferrer");
  }, [neynarUser?.user?.fid, neynarUser?.user?.username]);

  const userDisplayName = context?.user?.displayName ?? context?.user?.username ?? "User";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;
  const isGlazeDisabled = !minerState || isWriting || isConfirming || glazeResult !== null;

  return (
    <main className="flex min-h-screen w-full max-w-[430px] mx-auto flex-col bg-background font-mono text-foreground">
      <div
        className="flex flex-1 flex-col px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Mine</h1>
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

          {/* King Glazer Card */}
          <Card className={cn(
            "overflow-hidden",
            occupantDisplay.isYou && "border-primary/50 animate-border-glow"
          )}>
            <CardContent className="p-2">
              <div className="flex items-center justify-between gap-2">
                {/* Left: Profile */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={cn(
                      "cursor-pointer hover:opacity-80 transition-opacity",
                      !neynarUser?.user?.fid && "cursor-default"
                    )}
                    onClick={neynarUser?.user?.fid ? handleViewKingGlazerProfile : undefined}
                  >
                    <Avatar className="h-9 w-9 ring-2 ring-primary/30">
                      <AvatarImage src={occupantDisplay.avatarUrl || undefined} alt={occupantDisplay.primary} />
                      <AvatarFallback>
                        {minerState ? occupantFallbackInitials : <CircleUserRound className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={occupantDisplay.isYou ? "default" : "secondary"} className="text-[10px]">
                        King Glazer
                      </Badge>
                    </div>
                    <div className="text-sm font-semibold truncate">{occupantDisplay.primary}</div>
                    {occupantDisplay.secondary && (
                      <div className="text-[10px] text-muted-foreground truncate">{occupantDisplay.secondary}</div>
                    )}
                  </div>
                </div>

                {/* Right: Stats */}
                <div className="flex flex-col text-right shrink-0">
                  <div className="text-[9px] text-muted-foreground">
                    <span className="mr-1">TIME</span>
                    <span className="font-medium text-foreground">{glazeTimeDisplay}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground flex items-center justify-end gap-0.5">
                    <span>GLAZED</span>
                    <TokenIcon address={TOKEN_ADDRESSES.donut} size={9} />
                    <span className="font-medium text-foreground">{glazedDisplay}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    <span className="mr-1">PNL</span>
                    <span className="font-medium text-foreground">{pnlData.pnlEth}</span>
                  </div>
                  <div className={cn("text-[11px] font-bold", pnlData.isPositive ? "text-green-500" : "text-red-500")}>
                    {pnlData.totalUsd}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scrolling Message */}
          <div className="relative overflow-hidden bg-secondary/30 rounded py-0.5">
            <div className="flex animate-scroll whitespace-nowrap text-[10px] font-medium text-primary">
              {Array.from({ length: 100 }).map((_, i) => (
                <span key={i} className="inline-block px-6">
                  {minerState?.uri?.trim() || "We Glaze The World"}
                </span>
              ))}
            </div>
          </div>

          {/* Video */}
          <div className="relative overflow-hidden rounded-lg">
            <video
              ref={videoRef}
              className="w-full object-cover"
              autoPlay
              loop
              muted={isMuted}
              playsInline
              preload="auto"
              src="/media/donut-loop.mp4"
            />
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="absolute bottom-2 right-2 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeOff className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardContent className="p-2">
                <div className="text-[10px] font-medium uppercase text-muted-foreground">Glaze Rate</div>
                <div className="flex items-center gap-1">
                  <TokenIcon address={TOKEN_ADDRESSES.donut} size={16} />
                  <span className="text-base font-bold text-primary">{glazeRateDisplay}</span>
                  <span className="text-[9px] text-muted-foreground">/s</span>
                </div>
                <div className="text-[9px] text-muted-foreground">${glazeRateUsdValue}/s</div>
              </CardContent>
            </Card>
            <Card className="border-primary/30">
              <CardContent className="p-2">
                <div className="text-[10px] font-medium uppercase text-muted-foreground">
                  Glaze Price <span className="text-green-500">(5% Rebate)</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-primary">{glazePriceDisplay}</span>
                  <span className="text-xs text-muted-foreground line-through">
                    Ξ{minerState ? formatEth(minerState.price, minerState.price === 0n ? 0 : 5) : "—"}
                  </span>
                </div>
                <div className="text-[9px] text-muted-foreground">
                  ${minerState ? (Number(formatEther(discountedPrice)) * ethUsdPrice).toFixed(2) : "0.00"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Message Input */}
          <Input
            type="text"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add a message (optional)"
            maxLength={100}
            disabled={isGlazeDisabled}
          />

          {/* Mine Button */}
          <Button
            size="default"
            className={cn(
              "w-full",
              glazeResult === "success" && "bg-green-600 hover:bg-green-600",
              glazeResult === "failure" && "bg-destructive hover:bg-destructive"
            )}
            onClick={handleGlaze}
            disabled={isGlazeDisabled}
          >
            {glazeResult === "success" ? (
              <><Zap className="w-4 h-4" /> Success!</>
            ) : glazeResult === "failure" ? (
              "Failed"
            ) : isWriting || isConfirming ? (
              "Mining..."
            ) : (
              <><Pickaxe className="w-4 h-4" /> Mine</>
            )}
          </Button>

          {/* Balances */}
          <Card>
            <CardContent className="p-2">
              <div className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Your Balances</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="flex items-center gap-1 text-xs font-medium">
                    <TokenIcon address={TOKEN_ADDRESSES.donut} size={12} />
                    <span>{donutBalanceDisplay}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">Mined: {accountData?.mined ? Number(accountData.mined).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium">Ξ {ethBalanceDisplay}</div>
                  <div className="text-[10px] text-muted-foreground">Spent: {accountData?.spent ? Number(accountData.spent).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium">
                    wΞ {minerState?.wethBalance !== undefined ? formatEth(minerState.wethBalance, 4) : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Earned: {accountData?.earned ? Number(accountData.earned).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <NavBar />
    </main>
  );
}
