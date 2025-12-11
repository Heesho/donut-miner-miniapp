"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Check, Gift, RotateCcw, Vote as VoteIcon } from "lucide-react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { formatUnits, zeroAddress, type Address } from "viem";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CONTRACT_ADDRESSES,
  LSG_MULTICALL_ABI,
  VOTER_ABI,
  PAYMENT_TOKEN_SYMBOLS,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { NavBar } from "@/components/nav-bar";

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
const EPOCH_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

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

const initialsFrom = (label?: string) => {
  if (!label) return "";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
};

// Get payment token symbol
const getPaymentTokenSymbol = (address: Address): string => {
  return PAYMENT_TOKEN_SYMBOLS[address.toLowerCase()] || "TOKEN";
};

// Get token icon path
const getTokenIcon = (address: Address): string => {
  const symbol = getPaymentTokenSymbol(address).toLowerCase();
  if (symbol === "donut") return "/tokens/donut.svg";
  if (symbol === "donut-eth lp") return "/tokens/donut-eth-lp.svg";
  if (symbol === "usdc") return "/tokens/usdc.svg";
  return "/tokens/unknown.svg";
};

// Get strategy action and destination from payment token
const getStrategyInfo = (paymentToken: Address): { action: string; destination: string } => {
  const symbol = getPaymentTokenSymbol(paymentToken);
  return {
    action: `Buy ${symbol}`,
    destination: "DAO",
  };
};

// Format time until next epoch
const formatTimeUntilNextEpoch = (lastVoted: bigint): string => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const epochStart = (now / BigInt(EPOCH_DURATION)) * BigInt(EPOCH_DURATION);
  const nextEpoch = epochStart + BigInt(EPOCH_DURATION);

  if (lastVoted < epochStart) {
    return "Can vote now";
  }

  const remaining = Number(nextEpoch - now);
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h until next epoch`;
  if (hours > 0) return `${hours}h ${minutes}m until next epoch`;
  return `${minutes}m until next epoch`;
};

// Check if user can vote this epoch
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
    if (txResultTimeoutRef.current) {
      clearTimeout(txResultTimeoutRef.current);
    }
    setTxResult(result);
    txResultTimeoutRef.current = setTimeout(() => {
      setTxResult(null);
      txResultTimeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (txResultTimeoutRef.current) {
        clearTimeout(txResultTimeoutRef.current);
      }
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

  // Fetch voter data
  const { data: rawVoterData, refetch: refetchVoterData } = useReadContract({
    address: CONTRACT_ADDRESSES.lsgMulticall as Address,
    abi: LSG_MULTICALL_ABI,
    functionName: "getVoterData",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: { refetchInterval: 5_000 },
  });

  const voterData = useMemo(() => {
    if (!rawVoterData) return null;
    return rawVoterData as unknown as VoterData;
  }, [rawVoterData]);

  // Fetch all bribes data
  const { data: rawBribesData, refetch: refetchBribesData } = useReadContract({
    address: CONTRACT_ADDRESSES.lsgMulticall as Address,
    abi: LSG_MULTICALL_ABI,
    functionName: "getAllBribesData",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: { refetchInterval: 5_000 },
  });

  const bribesData = useMemo(() => {
    if (!rawBribesData) return [];
    return (rawBribesData as unknown as BribeData[]).filter(b => b.isAlive);
  }, [rawBribesData]);

  // Fetch all strategies data (to get payment tokens for dynamic naming)
  const { data: rawStrategiesData } = useReadContract({
    address: CONTRACT_ADDRESSES.lsgMulticall as Address,
    abi: LSG_MULTICALL_ABI,
    functionName: "getAllStrategiesData",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: { refetchInterval: 5_000 },
  });

  // Create a map from strategy address to strategy data
  const strategyDataMap = useMemo(() => {
    if (!rawStrategiesData) return new Map<string, StrategyData>();
    const strategies = rawStrategiesData as unknown as StrategyData[];
    const map = new Map<string, StrategyData>();
    strategies.forEach(s => {
      map.set(s.strategy.toLowerCase(), s);
    });
    return map;
  }, [rawStrategiesData]);

  // Get strategy info using payment token from map
  const getStrategyDisplayInfo = useCallback((strategyAddress: Address): { action: string; destination: string } => {
    const strategyData = strategyDataMap.get(strategyAddress.toLowerCase());
    if (strategyData) {
      return getStrategyInfo(strategyData.paymentToken);
    }
    return { action: `Strategy ${strategyAddress.slice(0, 6)}...`, destination: "Unknown" };
  }, [strategyDataMap]);

  // Calculate total pending rewards
  const totalPendingRewards = useMemo(() => {
    if (!bribesData.length) return [];
    const rewardMap = new Map<string, { token: Address; decimals: number; amount: bigint }>();

    bribesData.forEach(bribe => {
      bribe.rewardTokens.forEach((token, i) => {
        const earned = bribe.accountRewardsEarned[i] ?? 0n;
        if (earned > 0n) {
          const key = token.toLowerCase();
          const existing = rewardMap.get(key);
          if (existing) {
            existing.amount += earned;
          } else {
            rewardMap.set(key, {
              token,
              decimals: bribe.rewardTokenDecimals[i] ?? 18,
              amount: earned,
            });
          }
        }
      });
    });

    return Array.from(rewardMap.values());
  }, [bribesData]);

  // Get all bribe addresses for claiming
  const allBribeAddresses = useMemo(() => {
    return bribesData.map(b => b.bribe);
  }, [bribesData]);

  // Total weight of vote inputs
  const totalVoteWeight = useMemo(() => {
    return Object.values(voteWeights).reduce((sum, w) => sum + w, 0);
  }, [voteWeights]);

  // Write contract hooks
  const {
    data: voteTxHash,
    writeContract: writeVote,
    isPending: isVotePending,
    reset: resetVote,
  } = useWriteContract();

  const {
    data: resetTxHash,
    writeContract: writeReset,
    isPending: isResetPending,
    reset: resetResetTx,
  } = useWriteContract();

  const {
    data: claimTxHash,
    writeContract: writeClaim,
    isPending: isClaimPending,
    reset: resetClaim,
  } = useWriteContract();

  // Wait for receipts
  const { data: voteReceipt, isLoading: isVoteConfirming } = useWaitForTransactionReceipt({
    hash: voteTxHash,
    chainId: base.id,
  });

  const { data: resetReceipt, isLoading: isResetConfirming } = useWaitForTransactionReceipt({
    hash: resetTxHash,
    chainId: base.id,
  });

  const { data: claimReceipt, isLoading: isClaimConfirming } = useWaitForTransactionReceipt({
    hash: claimTxHash,
    chainId: base.id,
  });

  // Handle vote completion
  useEffect(() => {
    if (voteReceipt?.status === "success") {
      showTxResult("success");
      refetchVoterData();
      refetchBribesData();
      setVoteWeights({});
      setTxStep("idle");
      resetVote();
    } else if (voteReceipt?.status === "reverted") {
      showTxResult("failure");
      setTxStep("idle");
      resetVote();
    }
  }, [voteReceipt, refetchVoterData, refetchBribesData, resetVote, showTxResult]);

  // Handle reset completion
  useEffect(() => {
    if (resetReceipt?.status === "success") {
      showTxResult("success");
      refetchVoterData();
      refetchBribesData();
      setTxStep("idle");
      resetResetTx();
    } else if (resetReceipt?.status === "reverted") {
      showTxResult("failure");
      setTxStep("idle");
      resetResetTx();
    }
  }, [resetReceipt, refetchVoterData, refetchBribesData, resetResetTx, showTxResult]);

  // Handle claim completion
  useEffect(() => {
    if (claimReceipt?.status === "success") {
      showTxResult("success");
      refetchBribesData();
      setTxStep("idle");
      resetClaim();
    } else if (claimReceipt?.status === "reverted") {
      showTxResult("failure");
      setTxStep("idle");
      resetClaim();
    }
  }, [claimReceipt, refetchBribesData, resetClaim, showTxResult]);

  // Handle vote
  const handleVote = useCallback(async () => {
    if (!address || totalVoteWeight === 0) return;
    setTxStep("voting");
    try {
      const strategies = Object.keys(voteWeights).filter(s => voteWeights[s] > 0) as Address[];
      const weights = strategies.map(s => BigInt(voteWeights[s]));

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

  // Handle reset
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

  // Handle claim bribes
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

  const userDisplayName = context?.user?.displayName ?? context?.user?.username ?? "Farcaster user";
  const userHandle = context?.user?.username ? `@${context.user.username}` : context?.user?.fid ? `fid ${context.user.fid}` : "";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;

  const isBusy = txStep !== "idle" || isVotePending || isResetPending || isClaimPending || isVoteConfirming || isResetConfirming || isClaimConfirming;

  const hasVotingPower = voterData && voterData.accountGovernanceTokenBalance > 0n;
  const hasActiveVotes = voterData && voterData.accountUsedWeights > 0n;
  const canVote = voterData && canVoteThisEpoch(voterData.accountLastVoted);
  const hasPendingRewards = totalPendingRewards.length > 0;

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
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-wide">VOTE</h1>
            {context?.user ? (
              <div className="flex items-center gap-2 rounded-full bg-black px-3 py-1">
                <Avatar className="h-8 w-8 border border-zinc-800">
                  <AvatarImage src={userAvatarUrl || undefined} alt={userDisplayName} className="object-cover" />
                  <AvatarFallback className="bg-zinc-800 text-white">{initialsFrom(userDisplayName)}</AvatarFallback>
                </Avatar>
                <div className="leading-tight text-left">
                  <div className="text-sm font-bold">{userDisplayName}</div>
                  {userHandle ? <div className="text-xs text-gray-400">{userHandle}</div> : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Voting Power Info */}
          <Card className="mt-3 border-zinc-800 bg-gradient-to-br from-zinc-950 to-black">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Your Voting Power</div>
                  <div className="flex items-center gap-1.5">
                    <img src="/tokens/gdonut.svg" alt="gDONUT" className="w-5 h-5" />
                    <span className="text-xl font-bold text-pink-400">
                      {voterData ? formatTokenAmount(voterData.accountGovernanceTokenBalance, DONUT_DECIMALS, 2) : "—"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Status</div>
                  <div className={cn(
                    "text-sm font-bold",
                    canVote ? "text-green-400" : "text-yellow-400"
                  )}>
                    {voterData ? (canVote ? "Ready to vote" : "Already voted") : "—"}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {voterData ? formatTimeUntilNextEpoch(voterData.accountLastVoted) : "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Rewards */}
          {hasPendingRewards && (
            <Card className="mt-2 border-green-500/30 bg-green-500/5">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-green-400" />
                    <div>
                      <div className="text-[10px] font-bold text-green-400">PENDING REWARDS</div>
                      <div className="text-xs text-gray-400">
                        {totalPendingRewards.map((r, i) => (
                          <span key={r.token}>
                            {i > 0 && ", "}
                            {formatTokenAmount(r.amount, r.decimals, 4)} {getPaymentTokenSymbol(r.token)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button
                    className="rounded-lg bg-green-500 px-3 py-1 text-xs font-bold text-black hover:bg-green-400"
                    onClick={handleClaimBribes}
                    disabled={isBusy}
                  >
                    {txStep === "claiming" || isClaimConfirming ? "..." : "CLAIM"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Strategies List */}
          <div className="mt-3 flex-1 overflow-y-auto space-y-2 pb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Vote on Strategies
              </div>
              {canVote && (
                <div className="flex items-center gap-2">
                  {totalVoteWeight > 0 && (
                    <button
                      onClick={() => setVoteWeights({})}
                      className="text-[9px] text-gray-500 hover:text-white"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>

            {bribesData.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-400">Loading strategies...</div>
              </div>
            ) : (
              bribesData.map((bribe) => {
                const strategyInfo = getStrategyDisplayInfo(bribe.strategy);
                const strategyData = strategyDataMap.get(bribe.strategy.toLowerCase());
                const votePercent = Number(bribe.votePercent) / 1e18;
                const currentWeight = voteWeights[bribe.strategy] ?? 0;

                // Get user's earned rewards for this strategy's payment token
                const paymentTokenIndex = bribe.rewardTokens.findIndex(
                  t => strategyData && t.toLowerCase() === strategyData.paymentToken.toLowerCase()
                );
                const userEarned = paymentTokenIndex >= 0 ? bribe.accountRewardsEarned[paymentTokenIndex] : 0n;
                const earnedDecimals = paymentTokenIndex >= 0 ? bribe.rewardTokenDecimals[paymentTokenIndex] : 18;
                const paymentTokenSymbol = strategyData ? getPaymentTokenSymbol(strategyData.paymentToken) : "TOKEN";

                // Calculate APR: (rewardsLeft / totalSupply) * (52 weeks) * 100
                // This is a simplified APR assuming weekly rewards distribution
                const totalRewardsLeft = paymentTokenIndex >= 0 ? bribe.rewardsLeft[paymentTokenIndex] : 0n;
                const apr = bribe.totalSupply > 0n && totalRewardsLeft > 0n
                  ? (Number(totalRewardsLeft) / Number(bribe.totalSupply)) * 52 * 100
                  : 0;

                // User's vote as percentage of their total voting power
                const userVotePercent = voterData && voterData.accountGovernanceTokenBalance > 0n
                  ? (Number(bribe.accountVote) / Number(voterData.accountGovernanceTokenBalance)) * 100
                  : 0;

                return (
                  <Card key={bribe.strategy} className="border-zinc-800 bg-gradient-to-br from-zinc-950 to-black">
                    <CardContent className="p-2">
                      <div className="flex items-center gap-4">
                        {/* Left: Strategy Info */}
                        <div className="space-y-0 w-[130px] flex-shrink-0">
                          <div className="text-sm font-bold text-pink-400 mb-1">{votePercent.toFixed(1)}%</div>
                          <div className="text-[7px] text-gray-500 uppercase">Strategy</div>
                          <div className="text-[10px] font-bold text-white">{strategyInfo.action}</div>
                          <div className="text-[7px] text-gray-500 uppercase mt-0.5">Target</div>
                          <div className="text-[10px] font-bold text-white">{strategyInfo.destination}</div>
                        </div>

                        {/* Middle: APR & Earnings */}
                        <div className="text-center space-y-0 w-16 flex-shrink-0">
                          <div className="text-[8px] text-gray-500 uppercase">APR</div>
                          <div className="text-xs font-bold text-green-400">{apr > 0 ? `${apr.toFixed(1)}%` : "—"}</div>
                          <div className="text-[8px] text-gray-500 uppercase mt-1">Earned</div>
                          <div className="flex items-center justify-center gap-1">
                            {strategyData && (
                              <img src={getTokenIcon(strategyData.paymentToken)} alt={paymentTokenSymbol} className="w-3 h-3" />
                            )}
                            <span className="text-xs font-bold text-white">
                              {userEarned > 0n ? formatTokenAmount(userEarned, earnedDecimals, 4) : "0"}
                            </span>
                          </div>
                        </div>

                        {/* Right: User Vote & Input */}
                        <div className="flex-1 text-right space-y-0">
                          <div className="text-[8px] text-gray-500 uppercase">Your Vote</div>
                          {bribe.accountVote > 0n ? (
                            <div className="flex items-center justify-end gap-1">
                              <Check className="w-2.5 h-2.5 text-pink-400" />
                              <span className="text-[10px] font-bold text-pink-400">{userVotePercent.toFixed(0)}%</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-gray-500">—</div>
                          )}
                          {canVote && (
                            <div className="mt-0.5">
                              <input
                                type="number"
                                min="0"
                                value={currentWeight}
                                onChange={(e) => {
                                  const newWeight = Math.max(0, parseInt(e.target.value) || 0);
                                  setVoteWeights(prev => ({
                                    ...prev,
                                    [bribe.strategy]: newWeight,
                                  }));
                                }}
                                className="w-10 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-white text-center focus:outline-none focus:border-pink-500"
                              />
                              {totalVoteWeight > 0 && (
                                <div className="text-[9px] text-gray-400 mt-0.5">
                                  {((currentWeight / totalVoteWeight) * 100).toFixed(0)}%
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-3 space-y-2">
            {/* Vote Button */}
            {canVote && hasVotingPower && (
              <Button
                className={cn(
                  "w-full rounded-xl py-3 text-sm font-bold shadow-lg transition-colors text-white",
                  txResult === "success" && "bg-green-500 hover:bg-green-400",
                  txResult === "failure" && "bg-red-500 hover:bg-red-400",
                  !txResult && totalVoteWeight > 0 && "bg-pink-500 hover:bg-pink-400",
                  !txResult && totalVoteWeight === 0 && "bg-zinc-700 cursor-not-allowed"
                )}
                onClick={handleVote}
                disabled={isBusy || totalVoteWeight === 0}
              >
                <VoteIcon className="w-4 h-4 mr-2" />
                {txResult === "success" ? "SUCCESS!" :
                 txResult === "failure" ? "FAILED" :
                 txStep === "voting" || isVoteConfirming ? "VOTING..." :
                 totalVoteWeight === 0 ? "SET WEIGHTS TO VOTE" : "VOTE"}
              </Button>
            )}

            {/* Reset Button */}
            {hasActiveVotes && canVote && (
              <Button
                variant="outline"
                className="w-full rounded-xl py-2.5 text-sm font-bold border-zinc-700"
                onClick={handleReset}
                disabled={isBusy}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {txStep === "resetting" || isResetConfirming ? "RESETTING..." : "RESET VOTES"}
              </Button>
            )}

            {/* No Voting Power Message */}
            {!hasVotingPower && (
              <div className="bg-zinc-900 rounded-lg p-3 text-center">
                <div className="text-sm text-gray-400">
                  You need gDONUT to vote.
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  Go to the Stake page to stake DONUT for gDONUT.
                </div>
              </div>
            )}

            {/* Already Voted Message */}
            {hasVotingPower && !canVote && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                <div className="text-sm text-yellow-400">
                  Already voted this epoch
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {voterData ? formatTimeUntilNextEpoch(voterData.accountLastVoted) : ""}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <NavBar />
    </main>
  );
}
