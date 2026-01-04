"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Gift, RotateCcw, Vote as VoteIcon, Zap } from "lucide-react";
import {
  useAccount,
  useConnect,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { formatUnits, zeroAddress, type Address } from "viem";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CONTRACT_ADDRESSES,
  LSG_MULTICALL_ABI,
  VOTER_ABI,
  PAYMENT_TOKEN_SYMBOLS,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { NavBar } from "@/components/nav-bar";
import { TokenIcon } from "@/components/token-icon";
import { TOKEN_ADDRESSES } from "@/lib/tokens";
import { useEthPrice, useLpTokenPrice, useTokenPrice } from "@/hooks/useTokenPrices";

type MiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

type VoterData = {
  governanceToken: Address;
  revenueToken: Address;
  treasury: Address;
  underlyingToken: Address;
  underlyingTokenDecimals: number;
  totalWeight: bigint;
  strategyCount: bigint;
  governanceTokenTotalSupply: bigint;
  accountGovernanceTokenBalance: bigint;
  accountUnderlyingTokenBalance: bigint;
  accountUsedWeights: bigint;
  accountLastVoted: bigint;
};

type BribeData = {
  strategy: Address;
  bribe: Address;
  isAlive: boolean;
  rewardTokens: Address[];
  rewardTokenDecimals: number[];
  rewardsPerToken: bigint[];
  accountRewardsEarned: bigint[];
  rewardsLeft: bigint[];
  voteWeight: bigint;
  votePercent: bigint;
  totalSupply: bigint;
  accountVote: bigint;
};

type StrategyData = {
  strategy: Address;
  bribe: Address;
  bribeRouter: Address;
  paymentToken: Address;
  paymentReceiver: Address;
  isAlive: boolean;
  paymentTokenDecimals: number;
  strategyWeight: bigint;
  votePercent: bigint;
  claimable: bigint;
  pendingRevenue: bigint;
  routerRevenue: bigint;
  totalPotentialRevenue: bigint;
  epochPeriod: bigint;
  priceMultiplier: bigint;
  minInitPrice: bigint;
  epochId: bigint;
  initPrice: bigint;
  startTime: bigint;
  currentPrice: bigint;
  revenueBalance: bigint;
  accountVotes: bigint;
  accountPaymentTokenBalance: bigint;
};

const DONUT_DECIMALS = 18;
const EPOCH_DURATION = 7 * 24 * 60 * 60;

const formatTokenAmount = (value: bigint, decimals: number, maximumFractionDigits = 2) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatUnits(value, decimals));
  if (!Number.isFinite(asNumber)) return formatUnits(value, decimals);
  return asNumber.toLocaleString(undefined, { maximumFractionDigits });
};

const initialsFrom = (label?: string) => {
  if (!label) return "";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
};

const getPaymentTokenSymbol = (address: Address): string => {
  return PAYMENT_TOKEN_SYMBOLS[address.toLowerCase()] || "TOKEN";
};

const formatTimeUntilNextEpoch = (lastVoted: bigint): string => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const epochStart = (now / BigInt(EPOCH_DURATION)) * BigInt(EPOCH_DURATION);
  const nextEpoch = epochStart + BigInt(EPOCH_DURATION);
  if (lastVoted < epochStart) return "Ready";
  const remaining = Number(nextEpoch - now);
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const canVoteThisEpoch = (lastVoted: bigint): boolean => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const epochStart = (now / BigInt(EPOCH_DURATION)) * BigInt(EPOCH_DURATION);
  return lastVoted < epochStart;
};

export default function VotePage() {
  const readyRef = useRef(false);
  const autoConnectAttempted = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [voteWeights, setVoteWeights] = useState<Record<string, number>>({});
  const [txResult, setTxResult] = useState<"success" | "failure" | null>(null);
  const [txStep, setTxStep] = useState<"idle" | "voting" | "resetting" | "claiming">("idle");

  const txResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTxResult = useCallback((result: "success" | "failure") => {
    if (txResultTimeoutRef.current) clearTimeout(txResultTimeoutRef.current);
    setTxResult(result);
    txResultTimeoutRef.current = setTimeout(() => {
      setTxResult(null);
      txResultTimeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (txResultTimeoutRef.current) clearTimeout(txResultTimeoutRef.current);
    };
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
    if (!readyRef.current) {
      readyRef.current = true;
      sdk.actions.ready().catch(() => {});
    }
  }, []);

  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const primaryConnector = connectors[0];

  useEffect(() => {
    if (autoConnectAttempted.current || isConnected || !primaryConnector || isConnecting) return;
    autoConnectAttempted.current = true;
    connectAsync({ connector: primaryConnector, chainId: base.id }).catch(() => {});
  }, [connectAsync, isConnected, isConnecting, primaryConnector]);

  // Batch all 3 RPC calls into a single request (was 3 separate calls = 66% fewer RPC calls)
  const { data: batchedData, refetch: refetchAllData } = useReadContracts({
    contracts: [
      {
        address: CONTRACT_ADDRESSES.lsgMulticall as Address,
        abi: LSG_MULTICALL_ABI,
        functionName: "getVoterData",
        args: [address ?? zeroAddress],
        chainId: base.id,
      },
      {
        address: CONTRACT_ADDRESSES.lsgMulticall as Address,
        abi: LSG_MULTICALL_ABI,
        functionName: "getAllBribesData",
        args: [address ?? zeroAddress],
        chainId: base.id,
      },
      {
        address: CONTRACT_ADDRESSES.lsgMulticall as Address,
        abi: LSG_MULTICALL_ABI,
        functionName: "getAllStrategiesData",
        args: [address ?? zeroAddress],
        chainId: base.id,
      },
    ],
    query: { refetchInterval: 10_000 }, // Reduced from 5s to 10s
  });

  // Extract individual results from batched response
  const voterData = useMemo(() => {
    const result = batchedData?.[0];
    if (!result || result.status !== "success") return null;
    return result.result as unknown as VoterData;
  }, [batchedData]);

  const bribesData = useMemo(() => {
    const result = batchedData?.[1];
    if (!result || result.status !== "success") return [];
    return (result.result as unknown as BribeData[]).filter(b => b.isAlive);
  }, [batchedData]);

  const strategyDataMap = useMemo(() => {
    const result = batchedData?.[2];
    if (!result || result.status !== "success") return new Map<string, StrategyData>();
    const strategies = result.result as unknown as StrategyData[];
    const map = new Map<string, StrategyData>();
    strategies.forEach(s => map.set(s.strategy.toLowerCase(), s));
    return map;
  }, [batchedData]);

  // Convenience refetch functions for backwards compatibility
  const refetchVoterData = refetchAllData;
  const refetchBribesData = refetchAllData;

  // Price hooks for USD calculation
  const { data: ethUsdPrice = 3500 } = useEthPrice();
  const { price: lpTokenPrice } = useLpTokenPrice(TOKEN_ADDRESSES.donutEthLp);
  const { data: donutPrice = 0 } = useTokenPrice(TOKEN_ADDRESSES.donut);
  const { data: cbbtcPrice = 0 } = useTokenPrice(TOKEN_ADDRESSES.cbbtc);
  const { data: qrPrice = 0 } = useTokenPrice(TOKEN_ADDRESSES.qr);

  const getTokenUsdPrice = useCallback((tokenAddress: Address): number => {
    const tokenLower = tokenAddress.toLowerCase();
    if (tokenLower === TOKEN_ADDRESSES.usdc.toLowerCase()) return 1;
    if (tokenLower === TOKEN_ADDRESSES.donutEthLp.toLowerCase()) return lpTokenPrice;
    if (tokenLower === TOKEN_ADDRESSES.donut.toLowerCase()) return donutPrice;
    if (tokenLower === TOKEN_ADDRESSES.cbbtc.toLowerCase()) return cbbtcPrice;
    if (tokenLower === TOKEN_ADDRESSES.weth.toLowerCase()) return ethUsdPrice;
    if (tokenLower === TOKEN_ADDRESSES.qr.toLowerCase()) return qrPrice;
    return 0;
  }, [ethUsdPrice, lpTokenPrice, donutPrice, cbbtcPrice, qrPrice]);

  const totalPendingRewards = useMemo(() => {
    if (!bribesData.length) return { rewards: [], totalUsd: 0 };
    const rewardMap = new Map<string, { token: Address; decimals: number; amount: bigint }>();
    bribesData.forEach(bribe => {
      bribe.rewardTokens.forEach((token, i) => {
        const earned = bribe.accountRewardsEarned[i] ?? 0n;
        if (earned > 0n) {
          const key = token.toLowerCase();
          const existing = rewardMap.get(key);
          if (existing) existing.amount += earned;
          else rewardMap.set(key, { token, decimals: bribe.rewardTokenDecimals[i] ?? 18, amount: earned });
        }
      });
    });
    const rewards = Array.from(rewardMap.values());

    // Calculate total USD value
    let totalUsd = 0;
    rewards.forEach(r => {
      const tokenAmount = Number(formatUnits(r.amount, r.decimals));
      const usdPrice = getTokenUsdPrice(r.token);
      totalUsd += tokenAmount * usdPrice;
    });

    return { rewards, totalUsd };
  }, [bribesData, getTokenUsdPrice]);

  const allBribeAddresses = useMemo(() => bribesData.map(b => b.bribe), [bribesData]);
  const totalVoteWeight = useMemo(() => Object.values(voteWeights).reduce((sum, w) => sum + w, 0), [voteWeights]);

  const { data: voteTxHash, writeContract: writeVote, isPending: isVotePending, reset: resetVote } = useWriteContract();
  const { data: resetTxHash, writeContract: writeReset, isPending: isResetPending, reset: resetResetTx } = useWriteContract();
  const { data: claimTxHash, writeContract: writeClaim, isPending: isClaimPending, reset: resetClaim } = useWriteContract();

  const { data: voteReceipt, isLoading: isVoteConfirming } = useWaitForTransactionReceipt({ hash: voteTxHash, chainId: base.id });
  const { data: resetReceipt, isLoading: isResetConfirming } = useWaitForTransactionReceipt({ hash: resetTxHash, chainId: base.id });
  const { data: claimReceipt, isLoading: isClaimConfirming } = useWaitForTransactionReceipt({ hash: claimTxHash, chainId: base.id });

  useEffect(() => {
    if (voteReceipt?.status === "success") {
      showTxResult("success");
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sdk.actions as any).hapticFeedback?.({ type: "success" });
      } catch {}
      refetchVoterData();
      refetchBribesData();
      setVoteWeights({});
      setTxStep("idle");
      resetVote();
    } else if (voteReceipt?.status === "reverted") {
      showTxResult("failure");
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sdk.actions as any).hapticFeedback?.({ type: "error" });
      } catch {}
      setTxStep("idle");
      resetVote();
    }
  }, [voteReceipt, refetchVoterData, refetchBribesData, resetVote, showTxResult]);

  useEffect(() => {
    if (resetReceipt?.status === "success") {
      showTxResult("success");
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sdk.actions as any).hapticFeedback?.({ type: "success" });
      } catch {}
      refetchVoterData();
      refetchBribesData();
      setTxStep("idle");
      resetResetTx();
    } else if (resetReceipt?.status === "reverted") {
      showTxResult("failure");
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sdk.actions as any).hapticFeedback?.({ type: "error" });
      } catch {}
      setTxStep("idle");
      resetResetTx();
    }
  }, [resetReceipt, refetchVoterData, refetchBribesData, resetResetTx, showTxResult]);

  useEffect(() => {
    if (claimReceipt?.status === "success") {
      showTxResult("success");
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sdk.actions as any).hapticFeedback?.({ type: "success" });
      } catch {}
      refetchBribesData();
      setTxStep("idle");
      resetClaim();
    } else if (claimReceipt?.status === "reverted") {
      showTxResult("failure");
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sdk.actions as any).hapticFeedback?.({ type: "error" });
      } catch {}
      setTxStep("idle");
      resetClaim();
    }
  }, [claimReceipt, refetchBribesData, resetClaim, showTxResult]);

  const handleVote = useCallback(async () => {
    if (!address || totalVoteWeight === 0) return;
    setTxStep("voting");
    try {
      const strategies = Object.keys(voteWeights).filter(s => voteWeights[s] > 0) as Address[];
      // Multiply each percentage by 10000 (so 25% becomes 250000)
      const weights = strategies.map(s => BigInt(voteWeights[s] * 10000));
      await writeVote({
        account: address,
        address: CONTRACT_ADDRESSES.voter as Address,
        abi: VOTER_ABI,
        functionName: "vote",
        args: [strategies, weights],
        chainId: base.id,
      });
    } catch (error) {
      console.error("Vote failed:", error);
      showTxResult("failure");
      setTxStep("idle");
    }
  }, [address, totalVoteWeight, voteWeights, showTxResult, writeVote]);

  const handleReset = useCallback(async () => {
    if (!address) return;
    setTxStep("resetting");
    try {
      await writeReset({
        account: address,
        address: CONTRACT_ADDRESSES.voter as Address,
        abi: VOTER_ABI,
        functionName: "reset",
        args: [],
        chainId: base.id,
      });
    } catch (error) {
      console.error("Reset failed:", error);
      showTxResult("failure");
      setTxStep("idle");
    }
  }, [address, showTxResult, writeReset]);

  const handleClaimBribes = useCallback(async () => {
    if (!address || !allBribeAddresses.length) return;
    setTxStep("claiming");
    try {
      await writeClaim({
        account: address,
        address: CONTRACT_ADDRESSES.voter as Address,
        abi: VOTER_ABI,
        functionName: "claimBribes",
        args: [allBribeAddresses],
        chainId: base.id,
      });
    } catch (error) {
      console.error("Claim failed:", error);
      showTxResult("failure");
      setTxStep("idle");
    }
  }, [address, allBribeAddresses, showTxResult, writeClaim]);

  const userDisplayName = context?.user?.displayName ?? context?.user?.username ?? "User";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;

  const isBusy = txStep !== "idle" || isVotePending || isResetPending || isClaimPending || isVoteConfirming || isResetConfirming || isClaimConfirming;
  const hasVotingPower = voterData && voterData.accountGovernanceTokenBalance > 0n;
  const hasActiveVotes = voterData && voterData.accountUsedWeights > 0n;
  const canVote = voterData && canVoteThisEpoch(voterData.accountLastVoted);
  const hasPendingRewards = totalPendingRewards.rewards.length > 0;

  // Pie chart data for current vote breakdown
  const pieChartData = useMemo(() => {
    if (!bribesData.length) return [];
    const colors = ["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
    return bribesData.map((bribe, i) => {
      const strategyData = strategyDataMap.get(bribe.strategy.toLowerCase());
      const symbol = strategyData ? getPaymentTokenSymbol(strategyData.paymentToken) : "?";
      const percent = Number(bribe.votePercent) / 1e18;
      return { symbol, percent, color: colors[i % colors.length], strategy: bribe.strategy };
    }).filter(d => d.percent > 0);
  }, [bribesData, strategyDataMap]);

  // Memoized pie chart SVG slices - only recalculates when pieChartData changes
  const pieSlices = useMemo(() => {
    if (!pieChartData.length) return null;
    const slices: React.ReactNode[] = [];
    let currentAngle = -90; // Start from top

    pieChartData.forEach((slice, i) => {
      const angle = (slice.percent / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = 50 + 40 * Math.cos(startRad);
      const y1 = 50 + 40 * Math.sin(startRad);
      const x2 = 50 + 40 * Math.cos(endRad);
      const y2 = 50 + 40 * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;

      slices.push(
        <path
          key={i}
          d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
          fill={slice.color}
          stroke="hsl(var(--background))"
          strokeWidth="1"
        />
      );

      currentAngle = endAngle;
    });

    return slices;
  }, [pieChartData]);

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
          <h1 className="text-xl font-bold">Vote</h1>
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

        {/* Voting Power + Rewards Row */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card>
            <CardContent className="p-2">
              <div className="text-[10px] text-muted-foreground uppercase">Power</div>
              <div className="flex items-center gap-1 mt-0.5">
                <TokenIcon address={TOKEN_ADDRESSES.gDonut} size={14} />
                <span className="text-sm font-bold text-primary">
                  {voterData ? formatTokenAmount(voterData.accountGovernanceTokenBalance, DONUT_DECIMALS, 0) : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Rewards</div>
                  <div className="text-sm font-bold">
                    ${hasPendingRewards ? totalPendingRewards.totalUsd.toFixed(2) : "0.00"}
                  </div>
                </div>
                <Button
                  size="sm"
                  className={cn(
                    "h-6 text-[10px] px-2",
                    !hasPendingRewards && "opacity-50"
                  )}
                  onClick={handleClaimBribes}
                  disabled={isBusy || !hasPendingRewards}
                >
                  <Gift className="w-3 h-3 mr-1" />
                  {txStep === "claiming" ? "..." : "Claim"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pie Chart */}
        <Card className="mb-3">
          <CardContent className="p-3">
            <div className="flex items-center gap-4">
              {/* Pie Chart SVG */}
              <div className="w-20 h-20 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {pieSlices ?? (
                    <circle cx="50" cy="50" r="40" fill="hsl(var(--secondary))" />
                  )}
                </svg>
              </div>
              {/* Legend */}
              <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1">
                {pieChartData.map((slice) => (
                  <div key={slice.strategy} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
                    <span className="text-xs font-medium truncate">{slice.symbol}</span>
                    <span className="text-[10px] text-primary font-bold">{slice.percent.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strategies Box - Scrollable */}
        <Card className="flex-1 min-h-0 mb-3">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-medium uppercase text-muted-foreground">Strategies</span>
              {totalVoteWeight > 0 && (
                <button onClick={() => setVoteWeights({})} className="text-[10px] text-muted-foreground hover:text-foreground">
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {bribesData.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {bribesData.map((bribe) => {
                    const strategyData = strategyDataMap.get(bribe.strategy.toLowerCase());
                    const paymentSymbol = strategyData ? getPaymentTokenSymbol(strategyData.paymentToken) : "TOKEN";
                    const votePercent = Number(bribe.votePercent) / 1e18;
                    const currentWeight = voteWeights[bribe.strategy] ?? 0;
                    const pieColor = pieChartData.find(p => p.strategy === bribe.strategy)?.color;

                    const paymentTokenIndex = bribe.rewardTokens.findIndex(
                      t => strategyData && t.toLowerCase() === strategyData.paymentToken.toLowerCase()
                    );
                    const userEarned = paymentTokenIndex >= 0 ? bribe.accountRewardsEarned[paymentTokenIndex] : 0n;
                    const earnedDecimals = paymentTokenIndex >= 0 ? bribe.rewardTokenDecimals[paymentTokenIndex] : 18;

                    // Calculate APR using rewardsPerToken
                    // rewardsPerToken = (rewardRate * 604800) * 1e18 / bribeTotalSupply
                    // This is rewards in raw token units per 1e18 gDONUT staked per 7 days
                    let totalAnnualRewardsUsd = 0;
                    bribe.rewardTokens.forEach((token, i) => {
                      const rewardsPerToken = bribe.rewardsPerToken[i] ?? 0n;
                      const decimals = bribe.rewardTokenDecimals[i] ?? 18;
                      const tokenPrice = getTokenUsdPrice(token);

                      // Skip if no rewards or no price
                      if (rewardsPerToken === 0n || tokenPrice === 0) return;

                      // Annual rewards in raw token units per 1 gDONUT staked
                      // Multiply by 52 weeks BEFORE converting to human-readable to avoid precision loss
                      const annualRewardsRaw = rewardsPerToken * 52n;

                      // Convert to human-readable and USD
                      // For low-decimal tokens like cbBTC (8 decimals), rewardsPerToken may be very small (e.g., 2)
                      // but annualRewardsRaw = 2 * 52 = 104, which converts better
                      const annualRewardsHuman = Number(annualRewardsRaw) / Math.pow(10, decimals);
                      totalAnnualRewardsUsd += annualRewardsHuman * tokenPrice;
                    });
                    // APR = (annual rewards USD per gDONUT / gDONUT price) * 100
                    const apr = donutPrice > 0 ? (totalAnnualRewardsUsd / donutPrice) * 100 : 0;

                    const userVotePercent = voterData && voterData.accountGovernanceTokenBalance > 0n
                      ? (Number(bribe.accountVote) / Number(voterData.accountGovernanceTokenBalance)) * 100
                      : 0;

                    const hasCurrentVote = bribe.accountVote > 0n;

                    return (
                      <div
                        key={bribe.strategy}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2",
                          hasCurrentVote && "bg-primary/5"
                        )}
                      >
                        {/* Token */}
                        {strategyData && <TokenIcon address={strategyData.paymentToken} size={24} />}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{paymentSymbol}</span>
                            <span className="text-[10px] font-bold text-primary">{votePercent.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>APR: {apr > 0 ? `${apr.toFixed(0)}%` : "—"}</span>
                            <span>Earned: {userEarned > 0n ? formatTokenAmount(userEarned, earnedDecimals, 2) : "0"} {paymentSymbol}</span>
                          </div>
                        </div>

                        {/* Vote input or current vote */}
                        <div className="flex items-center gap-2">
                          {hasCurrentVote && (
                            <Badge variant="default" className="text-[10px] h-5">
                              {userVotePercent.toFixed(0)}%
                            </Badge>
                          )}
                          {canVote && (
                            <div className="flex items-center bg-secondary rounded">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={currentWeight || ""}
                                onChange={(e) => {
                                  const newWeight = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                  // Use startTransition for non-blocking update
                                  startTransition(() => {
                                    setVoteWeights(prev => ({ ...prev, [bribe.strategy]: newWeight }));
                                  });
                                }}
                                className="w-10 h-6 text-xs text-center p-0 border-0 bg-transparent no-spinners"
                                placeholder="0"
                              />
                              <span className="text-[10px] text-muted-foreground pr-1.5">%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Total Footer */}
            {canVote && (
              <div className="px-3 py-2 border-t border-border bg-secondary/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className={cn(
                    "text-sm font-bold",
                    totalVoteWeight === 0 ? "text-muted-foreground" :
                    totalVoteWeight === 100 ? "text-green-500" :
                    totalVoteWeight > 100 ? "text-destructive" : "text-primary"
                  )}>
                    {totalVoteWeight}%
                    {totalVoteWeight > 0 && totalVoteWeight !== 100 && (
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">
                        ({totalVoteWeight < 100 ? `${100 - totalVoteWeight}% left` : "exceeds 100%"})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vote Button - Always Visible */}
        <div className="space-y-2">
          {!hasVotingPower ? (
            <>
              <Button size="lg" className="w-full opacity-50 cursor-not-allowed" disabled>
                <VoteIcon className="w-4 h-4" /> Vote
              </Button>
              <div className="text-center text-xs text-muted-foreground">
                You need gDONUT to vote. <span className="text-primary">Stake DONUT</span> on the Stake page.
              </div>
            </>
          ) : !canVote ? (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-2 text-center">
                <div className="text-xs text-amber-500">Already voted • Next in {voterData ? formatTimeUntilNextEpoch(voterData.accountLastVoted) : ""}</div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Button
                size="lg"
                className={cn(
                  "w-full",
                  txResult === "success" && "bg-green-600 hover:bg-green-600",
                  txResult === "failure" && "bg-destructive hover:bg-destructive"
                )}
                onClick={handleVote}
                disabled={isBusy || totalVoteWeight === 0 || totalVoteWeight > 100}
              >
                {txResult === "success" ? (
                  <><Zap className="w-4 h-4" /> Success!</>
                ) : txResult === "failure" ? (
                  "Failed"
                ) : txStep === "voting" || isVoteConfirming ? (
                  "Voting..."
                ) : totalVoteWeight === 0 ? (
                  "Enter % to vote"
                ) : totalVoteWeight > 100 ? (
                  "Total exceeds 100%"
                ) : totalVoteWeight < 100 ? (
                  <><VoteIcon className="w-4 h-4" /> Vote ({totalVoteWeight}%)</>
                ) : (
                  <><VoteIcon className="w-4 h-4" /> Vote</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <NavBar />
    </main>
  );
}
