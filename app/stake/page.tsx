"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { ArrowDownUp, Clock, Lock, RotateCcw, Unlock, Users, Zap } from "lucide-react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { formatEther, formatUnits, parseUnits, zeroAddress, type Address } from "viem";
import { useBatchedTransaction, encodeApproveCall, encodeContractCall } from "@/hooks/useBatchedTransaction";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CONTRACT_ADDRESSES,
  LSG_MULTICALL_ABI,
  GOVERNANCE_TOKEN_ABI,
  ERC20_ABI,
  VOTER_ABI,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";
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

type TabMode = "stake" | "unstake" | "delegate";

const DONUT_DECIMALS = 18;
const EPOCH_DURATION = 7 * 24 * 60 * 60;

const canResetThisEpoch = (lastVoted: bigint): boolean => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const epochStart = (now / BigInt(EPOCH_DURATION)) * BigInt(EPOCH_DURATION);
  return lastVoted < epochStart;
};

const formatTimeUntilNextEpoch = (lastVoted: bigint): string => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const epochStart = (now / BigInt(EPOCH_DURATION)) * BigInt(EPOCH_DURATION);
  const nextEpoch = epochStart + BigInt(EPOCH_DURATION);

  if (lastVoted < epochStart) {
    return "Ready";
  }

  const remaining = Number(nextEpoch - now);
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

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

const formatAddress = (addr?: string) => {
  if (!addr) return "—";
  const normalized = addr.toLowerCase();
  if (normalized === zeroAddress) return "None";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};

export default function StakePage() {
  const readyRef = useRef(false);
  const autoConnectAttempted = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [mode, setMode] = useState<TabMode>("stake");
  const [amount, setAmount] = useState("");
  const [txResult, setTxResult] = useState<"success" | "failure" | null>(null);
  const [txStep, setTxStep] = useState<"idle" | "approving" | "staking" | "unstaking" | "delegating" | "resetting">("idle");
  const [delegateAddress, setDelegateAddress] = useState("");
  const [delegateMode, setDelegateMode] = useState<"self" | "other">("self");

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

  const { data: donutAllowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.donut as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address ?? zeroAddress, CONTRACT_ADDRESSES.governanceToken as Address],
    chainId: base.id,
    query: { enabled: !!address },
  });

  const { data: currentDelegate, refetch: refetchDelegate } = useReadContract({
    address: CONTRACT_ADDRESSES.governanceToken as Address,
    abi: GOVERNANCE_TOKEN_ABI,
    functionName: "delegates",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: { enabled: !!address },
  });

  const { data: votingPower } = useReadContract({
    address: CONTRACT_ADDRESSES.governanceToken as Address,
    abi: GOVERNANCE_TOKEN_ABI,
    functionName: "getVotes",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: { enabled: !!address },
  });

  const parsedAmount = useMemo(() => {
    try {
      if (!amount || amount === "") return 0n;
      return parseUnits(amount, DONUT_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApproval = useMemo(() => {
    if (mode !== "stake" || donutAllowance === undefined || parsedAmount === 0n) return false;
    return (donutAllowance as bigint) < parsedAmount;
  }, [mode, donutAllowance, parsedAmount]);

  const canUnstake = useMemo(() => {
    if (!voterData) return false;
    return voterData.accountUsedWeights === 0n;
  }, [voterData]);

  const {
    execute: executeStakeBatch,
    state: stakeBatchState,
    reset: resetStakeBatch,
  } = useBatchedTransaction();

  const {
    data: unstakeTxHash,
    writeContract: writeUnstake,
    isPending: isUnstakePending,
    reset: resetUnstake,
  } = useWriteContract();

  const {
    data: delegateTxHash,
    writeContract: writeDelegate,
    isPending: isDelegatePending,
    reset: resetDelegate,
  } = useWriteContract();

  const {
    data: resetVotesTxHash,
    writeContract: writeResetVotes,
    isPending: isResetVotesPending,
    reset: resetResetVotes,
  } = useWriteContract();

  const { data: unstakeReceipt, isLoading: isUnstakeConfirming } = useWaitForTransactionReceipt({
    hash: unstakeTxHash,
    chainId: base.id,
  });

  const { data: delegateReceipt, isLoading: isDelegateConfirming } = useWaitForTransactionReceipt({
    hash: delegateTxHash,
    chainId: base.id,
  });

  const { data: resetVotesReceipt, isLoading: isResetVotesConfirming } = useWaitForTransactionReceipt({
    hash: resetVotesTxHash,
    chainId: base.id,
  });

  useEffect(() => {
    if (stakeBatchState === "success") {
      showTxResult("success");
      refetchVoterData();
      refetchAllowance();
      setAmount("");
      setTxStep("idle");
      resetStakeBatch();
    } else if (stakeBatchState === "error") {
      showTxResult("failure");
      setTxStep("idle");
      resetStakeBatch();
    }
  }, [stakeBatchState, refetchVoterData, refetchAllowance, resetStakeBatch, showTxResult]);

  useEffect(() => {
    if (unstakeReceipt?.status === "success") {
      showTxResult("success");
      refetchVoterData();
      refetchAllowance();
      setAmount("");
      setTxStep("idle");
      resetUnstake();
    } else if (unstakeReceipt?.status === "reverted") {
      showTxResult("failure");
      setTxStep("idle");
      resetUnstake();
    }
  }, [unstakeReceipt, refetchVoterData, refetchAllowance, resetUnstake, showTxResult]);

  useEffect(() => {
    if (delegateReceipt?.status === "success") {
      showTxResult("success");
      refetchDelegate();
      setDelegateAddress("");
      setTxStep("idle");
      resetDelegate();
    } else if (delegateReceipt?.status === "reverted") {
      showTxResult("failure");
      setTxStep("idle");
      resetDelegate();
    }
  }, [delegateReceipt, refetchDelegate, resetDelegate, showTxResult]);

  useEffect(() => {
    if (resetVotesReceipt?.status === "success") {
      showTxResult("success");
      refetchVoterData();
      setTxStep("idle");
      resetResetVotes();
    } else if (resetVotesReceipt?.status === "reverted") {
      showTxResult("failure");
      setTxStep("idle");
      resetResetVotes();
    }
  }, [resetVotesReceipt, refetchVoterData, resetResetVotes, showTxResult]);

  const handleStake = useCallback(async () => {
    if (!address || parsedAmount === 0n) return;
    setTxStep("staking");

    const calls = [];
    if (needsApproval) {
      calls.push(
        encodeApproveCall(
          CONTRACT_ADDRESSES.donut as Address,
          CONTRACT_ADDRESSES.governanceToken as Address,
          parsedAmount
        )
      );
    }
    calls.push(
      encodeContractCall(
        CONTRACT_ADDRESSES.governanceToken as Address,
        GOVERNANCE_TOKEN_ABI,
        "stake",
        [parsedAmount]
      )
    );
    await executeStakeBatch(calls);
  }, [address, parsedAmount, needsApproval, executeStakeBatch]);

  const handleUnstake = useCallback(async () => {
    if (!address || parsedAmount === 0n) return;
    setTxStep("unstaking");
    try {
      writeUnstake({
        account: address,
        address: CONTRACT_ADDRESSES.governanceToken as Address,
        abi: GOVERNANCE_TOKEN_ABI,
        functionName: "unstake",
        args: [parsedAmount],
        chainId: base.id,
      });
    } catch (error) {
      console.error("Unstake failed:", error);
      showTxResult("failure");
      setTxStep("idle");
    }
  }, [address, parsedAmount, showTxResult, writeUnstake]);

  const handleDelegate = useCallback(async (targetAddress: Address) => {
    if (!address) return;
    setTxStep("delegating");
    try {
      writeDelegate({
        account: address,
        address: CONTRACT_ADDRESSES.governanceToken as Address,
        abi: GOVERNANCE_TOKEN_ABI,
        functionName: "delegate",
        args: [targetAddress],
        chainId: base.id,
      });
    } catch (error) {
      console.error("Delegate failed:", error);
      showTxResult("failure");
      setTxStep("idle");
    }
  }, [address, showTxResult, writeDelegate]);

  const handleResetVotes = useCallback(async () => {
    if (!address) return;
    setTxStep("resetting");
    try {
      writeResetVotes({
        account: address,
        address: CONTRACT_ADDRESSES.voter as Address,
        abi: VOTER_ABI,
        functionName: "reset",
        args: [],
        chainId: base.id,
      });
    } catch (error) {
      console.error("Reset votes failed:", error);
      showTxResult("failure");
      setTxStep("idle");
    }
  }, [address, showTxResult, writeResetVotes]);

  const setMaxAmount = useCallback(() => {
    if (!voterData) return;
    const balance = mode === "stake"
      ? voterData.accountUnderlyingTokenBalance
      : voterData.accountGovernanceTokenBalance;
    setAmount(formatEther(balance));
  }, [mode, voterData]);

  const userDisplayName = context?.user?.displayName ?? context?.user?.username ?? "User";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;

  const isStaking = stakeBatchState === "pending" || stakeBatchState === "confirming";
  const isBusy = txStep !== "idle" || isStaking || isUnstakePending || isDelegatePending || isResetVotesPending || isUnstakeConfirming || isDelegateConfirming || isResetVotesConfirming;

  const maxBalance = mode === "stake"
    ? voterData?.accountUnderlyingTokenBalance ?? 0n
    : voterData?.accountGovernanceTokenBalance ?? 0n;

  const insufficientBalance = parsedAmount > maxBalance;
  const hasActiveVotes = voterData && voterData.accountUsedWeights > 0n;
  const canReset = voterData && canResetThisEpoch(voterData.accountLastVoted);

  const isDelegatedToSelf = currentDelegate && address &&
    (currentDelegate as Address).toLowerCase() === address.toLowerCase();

  const isValidDelegateAddress = delegateAddress.length === 42 && delegateAddress.startsWith("0x");

  return (
    <main className="flex min-h-screen w-full max-w-[430px] mx-auto flex-col bg-background font-mono text-foreground">
      <div
        className="flex flex-1 flex-col px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto scrollbar-hide pb-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Governance</h1>
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

          {/* Balance Overview */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TokenIcon address={TOKEN_ADDRESSES.donut} size={16} />
                  <span className="text-[10px] font-medium uppercase text-muted-foreground">DONUT</span>
                </div>
                <div className="text-lg font-bold">
                  {voterData ? formatTokenAmount(voterData.accountUnderlyingTokenBalance, DONUT_DECIMALS, 2) : "—"}
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/30">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TokenIcon address={TOKEN_ADDRESSES.gDonut} size={16} />
                  <span className="text-[10px] font-medium uppercase text-primary">gDONUT</span>
                </div>
                <div className="text-lg font-bold">
                  {voterData ? formatTokenAmount(voterData.accountGovernanceTokenBalance, DONUT_DECIMALS, 2) : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 bg-secondary rounded-lg">
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all",
                mode === "stake"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => { setMode("stake"); setAmount(""); }}
            >
              <Lock className="w-3.5 h-3.5" />
              Stake
            </button>
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all",
                mode === "unstake"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => { setMode("unstake"); setAmount(""); }}
            >
              <Unlock className="w-3.5 h-3.5" />
              Unstake
            </button>
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all",
                mode === "delegate"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode("delegate")}
            >
              <Users className="w-3.5 h-3.5" />
              Delegate
            </button>
          </div>

          {/* Stake Tab */}
          {mode === "stake" && (
            <div className="flex flex-col gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground">Amount to stake</span>
                    <button
                      className="text-xs font-medium text-primary hover:text-primary/80"
                      onClick={setMaxAmount}
                    >
                      MAX
                    </button>
                  </div>
                  <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
                    <TokenIcon address={TOKEN_ADDRESSES.donut} size={28} />
                    <Input
                      type="text"
                      value={amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*\.?\d*$/.test(val)) setAmount(val);
                      }}
                      placeholder="0.00"
                      className="flex-1 border-0 bg-transparent text-xl font-bold p-0 h-auto focus-visible:ring-0"
                    />
                    <span className="text-sm text-muted-foreground">DONUT</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <ArrowDownUp className="w-3 h-3" />
                      <span className="text-[10px]">1:1 for gDONUT</span>
                    </div>
                    <span className="text-[10px]">
                      Available: {formatTokenAmount(voterData?.accountUnderlyingTokenBalance ?? 0n, DONUT_DECIMALS, 4)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {insufficientBalance && parsedAmount > 0n && (
                <div className="py-2 px-4 bg-destructive/10 border border-destructive/30 rounded-lg text-center">
                  <span className="text-xs text-destructive">Insufficient DONUT balance</span>
                </div>
              )}

              <Button
                size="lg"
                className={cn(
                  "w-full",
                  txResult === "success" && "bg-green-600 hover:bg-green-600",
                  txResult === "failure" && "bg-destructive hover:bg-destructive"
                )}
                onClick={handleStake}
                disabled={isBusy || parsedAmount === 0n || insufficientBalance}
              >
                {txResult === "success" ? (
                  <><Zap className="w-4 h-4" /> Success!</>
                ) : txResult === "failure" ? (
                  "Failed"
                ) : txStep === "staking" || isStaking ? (
                  "Staking..."
                ) : (
                  <><Lock className="w-4 h-4" /> Stake DONUT</>
                )}
              </Button>
            </div>
          )}

          {/* Unstake Tab */}
          {mode === "unstake" && (
            <div className="flex flex-col gap-4">
              {hasActiveVotes && (
                <Card className="border-destructive/50 bg-destructive/10">
                  <CardContent className="p-4">
                    <p className="text-xs text-destructive text-center mb-3">
                      Reset your votes to unstake
                    </p>
                    {canReset ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={handleResetVotes}
                        disabled={isBusy}
                      >
                        <RotateCcw className="w-4 h-4" />
                        {txStep === "resetting" || isResetVotesConfirming ? "Resetting..." : "Reset Votes"}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-2 text-amber-500">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">
                          {voterData ? formatTimeUntilNextEpoch(voterData.accountLastVoted) : "—"}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground">Amount to unstake</span>
                    <button
                      className="text-xs font-medium text-primary hover:text-primary/80"
                      onClick={setMaxAmount}
                    >
                      MAX
                    </button>
                  </div>
                  <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
                    <TokenIcon address={TOKEN_ADDRESSES.gDonut} size={28} />
                    <Input
                      type="text"
                      value={amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*\.?\d*$/.test(val)) setAmount(val);
                      }}
                      placeholder="0.00"
                      className="flex-1 border-0 bg-transparent text-xl font-bold p-0 h-auto focus-visible:ring-0"
                    />
                    <span className="text-sm text-muted-foreground">gDONUT</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <ArrowDownUp className="w-3 h-3" />
                      <span className="text-[10px]">1:1 for DONUT</span>
                    </div>
                    <span className="text-[10px]">
                      Available: {formatTokenAmount(voterData?.accountGovernanceTokenBalance ?? 0n, DONUT_DECIMALS, 4)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {insufficientBalance && parsedAmount > 0n && (
                <div className="py-2 px-4 bg-destructive/10 border border-destructive/30 rounded-lg text-center">
                  <span className="text-xs text-destructive">Insufficient gDONUT balance</span>
                </div>
              )}

              <Button
                size="lg"
                className={cn(
                  "w-full",
                  txResult === "success" && "bg-green-600 hover:bg-green-600",
                  txResult === "failure" && "bg-destructive hover:bg-destructive"
                )}
                onClick={handleUnstake}
                disabled={isBusy || parsedAmount === 0n || insufficientBalance || !canUnstake}
              >
                {txResult === "success" ? (
                  <><Zap className="w-4 h-4" /> Success!</>
                ) : txResult === "failure" ? (
                  "Failed"
                ) : txStep === "unstaking" || isUnstakeConfirming ? (
                  "Unstaking..."
                ) : (
                  <><Unlock className="w-4 h-4" /> Unstake gDONUT</>
                )}
              </Button>
            </div>
          )}

          {/* Delegate Tab */}
          {mode === "delegate" && (
            <div className="flex flex-col gap-4">
              <Card>
                <CardContent className="p-4">
                  {/* Current Status */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-muted-foreground">Current Delegate</span>
                    <Badge variant={isDelegatedToSelf ? "default" : currentDelegate && (currentDelegate as Address) !== zeroAddress ? "secondary" : "outline"}>
                      {currentDelegate && (currentDelegate as Address) !== zeroAddress
                        ? isDelegatedToSelf ? "Yourself" : formatAddress(currentDelegate as string)
                        : "Nobody"}
                    </Badge>
                  </div>

                  {/* Voting Power */}
                  <div className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-md mb-4">
                    <span className="text-xs text-muted-foreground">Voting Power</span>
                    <span className="text-sm font-bold">
                      {votingPower ? formatTokenAmount(votingPower as bigint, DONUT_DECIMALS, 2) : "0"}
                    </span>
                  </div>

                  {/* Self / Other Toggle */}
                  <div className="flex gap-1 p-1 bg-secondary rounded-lg mb-4">
                    <button
                      className={cn(
                        "flex-1 rounded-md py-2 text-xs font-medium transition-all",
                        delegateMode === "self"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setDelegateMode("self")}
                    >
                      Self
                    </button>
                    <button
                      className={cn(
                        "flex-1 rounded-md py-2 text-xs font-medium transition-all",
                        delegateMode === "other"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setDelegateMode("other")}
                    >
                      Other
                    </button>
                  </div>

                  {/* Address Input (only for other) */}
                  {delegateMode === "other" && (
                    <Input
                      type="text"
                      value={delegateAddress}
                      onChange={(e) => setDelegateAddress(e.target.value)}
                      placeholder="0x..."
                      className="mb-4"
                    />
                  )}
                </CardContent>
              </Card>

              <Button
                size="lg"
                className={cn(
                  "w-full",
                  txResult === "success" && "bg-green-600 hover:bg-green-600",
                  txResult === "failure" && "bg-destructive hover:bg-destructive"
                )}
                onClick={() => {
                  if (delegateMode === "self" && address) {
                    handleDelegate(address);
                  } else if (delegateMode === "other" && isValidDelegateAddress) {
                    handleDelegate(delegateAddress as Address);
                  }
                }}
                disabled={
                  isBusy ||
                  (delegateMode === "self" && !address) ||
                  (delegateMode === "other" && !isValidDelegateAddress)
                }
              >
                {txResult === "success" ? (
                  <><Zap className="w-4 h-4" /> Success!</>
                ) : txResult === "failure" ? (
                  "Failed"
                ) : txStep === "delegating" || isDelegateConfirming ? (
                  "Delegating..."
                ) : (
                  "Delegate"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      <NavBar />
    </main>
  );
}
