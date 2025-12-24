"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { ArrowDownUp, Clock, Lock, RotateCcw, Unlock, Users } from "lucide-react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { formatEther, formatUnits, parseUnits, zeroAddress, type Address } from "viem";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const DONUT_DECIMALS = 18;
const EPOCH_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

// Check if user can reset this epoch (haven't voted this epoch)
const canResetThisEpoch = (lastVoted: bigint): boolean => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const epochStart = (now / BigInt(EPOCH_DURATION)) * BigInt(EPOCH_DURATION);
  return lastVoted < epochStart;
};

// Format time until next epoch
const formatTimeUntilNextEpoch = (lastVoted: bigint): string => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const epochStart = (now / BigInt(EPOCH_DURATION)) * BigInt(EPOCH_DURATION);
  const nextEpoch = epochStart + BigInt(EPOCH_DURATION);

  if (lastVoted < epochStart) {
    return "Ready to reset";
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
  const [mode, setMode] = useState<"stake" | "unstake">("stake");
  const [amount, setAmount] = useState("");
  const [txResult, setTxResult] = useState<"success" | "failure" | null>(null);
  const [txStep, setTxStep] = useState<"idle" | "approving" | "staking" | "unstaking" | "delegating" | "resetting">("idle");
  const [delegateAddress, setDelegateAddress] = useState("");
  const [showDelegateInput, setShowDelegateInput] = useState(false);
  const [pendingStakeAmount, setPendingStakeAmount] = useState<bigint | null>(null);

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

  // Fetch voter data (includes balances)
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

  // Check DONUT allowance for governance token
  const { data: donutAllowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.donut as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address ?? zeroAddress, CONTRACT_ADDRESSES.governanceToken as Address],
    chainId: base.id,
    query: { enabled: !!address },
  });

  // Get current delegate
  const { data: currentDelegate, refetch: refetchDelegate } = useReadContract({
    address: CONTRACT_ADDRESSES.governanceToken as Address,
    abi: GOVERNANCE_TOKEN_ABI,
    functionName: "delegates",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: { enabled: !!address },
  });

  // Get voting power
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
    if (mode !== "stake" || !donutAllowance || parsedAmount === 0n) return false;
    return (donutAllowance as bigint) < parsedAmount;
  }, [mode, donutAllowance, parsedAmount]);

  const canUnstake = useMemo(() => {
    if (!voterData) return false;
    return voterData.accountUsedWeights === 0n;
  }, [voterData]);

  // Regular write hooks for approve and stake (sequential)
  const {
    data: approveTxHash,
    writeContract: writeApprove,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const {
    data: stakeTxHash,
    writeContract: writeStake,
    isPending: isStakePending,
    error: stakeError,
    reset: resetStake,
  } = useWriteContract();

  // Regular write hooks for unstake
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

  // Wait for receipts
  const { data: approveReceipt, isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    chainId: base.id,
  });

  const { data: stakeReceipt, isLoading: isStakeConfirming } = useWaitForTransactionReceipt({
    hash: stakeTxHash,
    chainId: base.id,
  });

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

  // Handle approve completion - trigger stake
  useEffect(() => {
    if (approveReceipt?.status === "success" && pendingStakeAmount !== null && txStep === "approving") {
      // Approval succeeded, now stake
      console.log("[Stake] Approval confirmed, now staking...");
      setTxStep("staking");
      resetApprove();
      writeStake({
        address: CONTRACT_ADDRESSES.governanceToken as Address,
        abi: GOVERNANCE_TOKEN_ABI,
        functionName: "stake",
        args: [pendingStakeAmount],
        chainId: base.id,
      });
    } else if (approveReceipt?.status === "reverted") {
      console.error("[Stake] Approval reverted");
      showTxResult("failure");
      setTxStep("idle");
      setPendingStakeAmount(null);
      resetApprove();
    }
  }, [approveReceipt, pendingStakeAmount, txStep, resetApprove, writeStake, showTxResult]);

  // Handle approve error
  useEffect(() => {
    if (approveError && txStep === "approving") {
      console.error("[Stake] Approval error:", approveError);
      showTxResult("failure");
      setTxStep("idle");
      setPendingStakeAmount(null);
      resetApprove();
    }
  }, [approveError, txStep, showTxResult, resetApprove]);

  // Handle stake completion
  useEffect(() => {
    if (stakeReceipt?.status === "success") {
      console.log("[Stake] Stake confirmed!");
      showTxResult("success");
      refetchVoterData();
      refetchAllowance();
      setAmount("");
      setTxStep("idle");
      setPendingStakeAmount(null);
      resetStake();
    } else if (stakeReceipt?.status === "reverted") {
      console.error("[Stake] Stake reverted");
      showTxResult("failure");
      setTxStep("idle");
      setPendingStakeAmount(null);
      resetStake();
    }
  }, [stakeReceipt, refetchVoterData, refetchAllowance, resetStake, showTxResult]);

  // Handle stake error
  useEffect(() => {
    if (stakeError && txStep === "staking") {
      console.error("[Stake] Stake error:", stakeError);
      showTxResult("failure");
      setTxStep("idle");
      setPendingStakeAmount(null);
      resetStake();
    }
  }, [stakeError, txStep, showTxResult, resetStake]);

  // Handle unstake completion
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

  // Handle delegate completion
  useEffect(() => {
    if (delegateReceipt?.status === "success") {
      showTxResult("success");
      refetchDelegate();
      setDelegateAddress("");
      setShowDelegateInput(false);
      setTxStep("idle");
      resetDelegate();
    } else if (delegateReceipt?.status === "reverted") {
      showTxResult("failure");
      setTxStep("idle");
      resetDelegate();
    }
  }, [delegateReceipt, refetchDelegate, resetDelegate, showTxResult]);

  // Handle reset votes completion
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

  // Handle stake - sequential transactions (approve first if needed, then stake)
  const handleStake = useCallback(async () => {
    if (!address || parsedAmount === 0n) return;

    if (needsApproval) {
      // Need approval first - approve then stake
      console.log("[Stake] Starting approval for amount:", parsedAmount.toString());
      setTxStep("approving");
      setPendingStakeAmount(parsedAmount);
      writeApprove({
        address: CONTRACT_ADDRESSES.donut as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.governanceToken as Address, parsedAmount],
        chainId: base.id,
      });
    } else {
      // No approval needed - stake directly
      console.log("[Stake] No approval needed, staking directly:", parsedAmount.toString());
      setTxStep("staking");
      writeStake({
        address: CONTRACT_ADDRESSES.governanceToken as Address,
        abi: GOVERNANCE_TOKEN_ABI,
        functionName: "stake",
        args: [parsedAmount],
        chainId: base.id,
      });
    }
  }, [address, parsedAmount, needsApproval, writeApprove, writeStake]);

  // Handle unstake
  const handleUnstake = useCallback(async () => {
    if (!address || parsedAmount === 0n) return;
    setTxStep("unstaking");
    try {
      await writeUnstake({
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

  // Handle delegate
  const handleDelegate = useCallback(async () => {
    if (!address || !delegateAddress) return;
    setTxStep("delegating");
    try {
      await writeDelegate({
        account: address,
        address: CONTRACT_ADDRESSES.governanceToken as Address,
        abi: GOVERNANCE_TOKEN_ABI,
        functionName: "delegate",
        args: [delegateAddress as Address],
        chainId: base.id,
      });
    } catch (error) {
      console.error("Delegate failed:", error);
      showTxResult("failure");
      setTxStep("idle");
    }
  }, [address, delegateAddress, showTxResult, writeDelegate]);

  // Handle self-delegate
  const handleSelfDelegate = useCallback(async () => {
    if (!address) return;
    setTxStep("delegating");
    try {
      await writeDelegate({
        account: address,
        address: CONTRACT_ADDRESSES.governanceToken as Address,
        abi: GOVERNANCE_TOKEN_ABI,
        functionName: "delegate",
        args: [address],
        chainId: base.id,
      });
    } catch (error) {
      console.error("Self-delegate failed:", error);
      showTxResult("failure");
      setTxStep("idle");
    }
  }, [address, showTxResult, writeDelegate]);

  // Handle reset votes
  const handleResetVotes = useCallback(async () => {
    if (!address) return;
    setTxStep("resetting");
    try {
      await writeResetVotes({
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

  const userDisplayName = context?.user?.displayName ?? context?.user?.username ?? "Farcaster user";
  const userHandle = context?.user?.username ? `@${context.user.username}` : context?.user?.fid ? `fid ${context.user.fid}` : "";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;

  const isStaking = isApprovePending || isApproveConfirming || isStakePending || isStakeConfirming;
  const isBusy = txStep !== "idle" || isStaking || isUnstakePending || isDelegatePending || isResetVotesPending || isUnstakeConfirming || isDelegateConfirming || isResetVotesConfirming;

  const maxBalance = mode === "stake"
    ? voterData?.accountUnderlyingTokenBalance ?? 0n
    : voterData?.accountGovernanceTokenBalance ?? 0n;

  const insufficientBalance = parsedAmount > maxBalance;
  const hasActiveVotes = voterData && voterData.accountUsedWeights > 0n;
  const canReset = voterData && canResetThisEpoch(voterData.accountLastVoted);

  // Check if user is delegated to self
  const isDelegatedToSelf = currentDelegate && address &&
    (currentDelegate as Address).toLowerCase() === address.toLowerCase();

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
            <h1 className="text-2xl font-bold tracking-wide">STAKE</h1>
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

          {/* Balance Cards */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Card className="border-zinc-800 bg-gradient-to-br from-zinc-950 to-black">
              <CardContent className="p-3">
                <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400">DONUT Balance</div>
                <div className="flex items-center gap-2">
                  <TokenIcon address={TOKEN_ADDRESSES.donut} size={20} />
                  <span className="text-xl font-bold text-white">
                    {voterData ? formatTokenAmount(voterData.accountUnderlyingTokenBalance, DONUT_DECIMALS, 2) : "—"}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500">Available to stake</div>
              </CardContent>
            </Card>
            <Card className="border-zinc-800 bg-gradient-to-br from-zinc-950 to-black">
              <CardContent className="p-3">
                <div className="text-[9px] font-bold tracking-wide text-gray-400">gDONUT BALANCE</div>
                <div className="flex items-center gap-2">
                  <TokenIcon address={TOKEN_ADDRESSES.gDonut} size={20} />
                  <span className="text-xl font-bold text-white">
                    {voterData ? formatTokenAmount(voterData.accountGovernanceTokenBalance, DONUT_DECIMALS, 2) : "—"}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500">Staked (voting power)</div>
              </CardContent>
            </Card>
          </div>

          {/* Stake/Unstake Toggle */}
          <div className="mt-4 flex gap-2">
            <Button
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-bold transition-colors",
                mode === "stake"
                  ? "bg-pink-500 text-black hover:bg-pink-400"
                  : "bg-zinc-800 text-white hover:bg-zinc-700"
              )}
              onClick={() => { setMode("stake"); setAmount(""); }}
            >
              <Lock className="w-4 h-4 mr-1" />
              STAKE
            </Button>
            <Button
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-bold transition-colors",
                mode === "unstake"
                  ? "bg-pink-500 text-black hover:bg-pink-400"
                  : "bg-zinc-800 text-white hover:bg-zinc-700"
              )}
              onClick={() => { setMode("unstake"); setAmount(""); }}
            >
              <Unlock className="w-4 h-4 mr-1" />
              UNSTAKE
            </Button>
          </div>

          {/* Amount Input */}
          <Card className="mt-3 border-zinc-800 bg-gradient-to-br from-zinc-950 to-black">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase text-gray-400">
                  {mode === "stake" ? "Amount to stake" : "Amount to unstake"}
                </span>
                <button
                  className="text-[10px] text-pink-400 hover:text-pink-300"
                  onClick={setMaxAmount}
                >
                  MAX
                </button>
              </div>
              <div className="flex items-center gap-2">
                <TokenIcon
                  address={mode === "stake" ? TOKEN_ADDRESSES.donut : TOKEN_ADDRESSES.gDonut}
                  size={28}
                />
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*\.?\d*$/.test(val)) setAmount(val);
                  }}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none"
                />
              </div>
              <div className="flex items-center mt-1">
                <ArrowDownUp className="w-3 h-3 text-gray-500 mr-1" />
                <span className="text-[10px] text-gray-500">
                  1:1 exchange rate
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Active Votes Warning with Reset */}
          {mode === "unstake" && hasActiveVotes && (
            <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="text-[10px] text-red-400 text-center mb-2">
                You must reset your votes before unstaking.
              </div>
              {canReset ? (
                <Button
                  className="w-full rounded-lg bg-red-500 py-2 text-xs font-bold text-white hover:bg-red-400"
                  onClick={handleResetVotes}
                  disabled={isBusy}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  {txStep === "resetting" || isResetVotesConfirming ? "RESETTING..." : "RESET VOTES"}
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-2 text-yellow-400">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px]">
                    {voterData ? formatTimeUntilNextEpoch(voterData.accountLastVoted) : "—"}
                  </span>
                </div>
              )}
            </div>
          )}

          {insufficientBalance && parsedAmount > 0n && (
            <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
              <div className="text-[10px] text-red-400">
                Insufficient {mode === "stake" ? "DONUT" : "gDONUT"} balance
              </div>
            </div>
          )}

          {/* Action Button */}
          <Button
            className={cn(
              "mt-4 w-full rounded-xl py-3 text-sm font-bold shadow-lg transition-colors",
              txResult === "success" && "bg-green-500 hover:bg-green-400",
              txResult === "failure" && "bg-red-500 hover:bg-red-400",
              !txResult && "bg-pink-500 hover:bg-pink-400"
            )}
            onClick={() => {
              if (mode === "stake") {
                handleStake();
              } else {
                handleUnstake();
              }
            }}
            disabled={
              isBusy ||
              parsedAmount === 0n ||
              insufficientBalance ||
              (mode === "unstake" && !canUnstake)
            }
          >
            {txResult === "success" ? "SUCCESS!" :
             txResult === "failure" ? "FAILED" :
             txStep === "approving" || isApproveConfirming ? "APPROVING..." :
             txStep === "staking" || isStakePending || isStakeConfirming ? "STAKING..." :
             txStep === "unstaking" || isUnstakeConfirming ? "UNSTAKING..." :
             mode === "stake" ? "STAKE DONUT" : "UNSTAKE gDONUT"}
          </Button>
        </div>
      </div>

      {/* Delegation Panel - Fixed above NavBar */}
      <div
        className="fixed left-0 right-0 px-4 py-3"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}
      >
        <div className="max-w-[520px] mx-auto space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-pink-400" />
              <span className="text-xs text-gray-400">Delegated to:</span>
              <span className="text-xs font-semibold text-white">
                {currentDelegate && (currentDelegate as Address) !== zeroAddress
                  ? isDelegatedToSelf ? "Yourself" : formatAddress(currentDelegate as string)
                  : "Nobody"}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Power: {votingPower ? formatTokenAmount(votingPower as bigint, DONUT_DECIMALS, 2) : "0"}
            </div>
          </div>

          {showDelegateInput ? (
            <div className="space-y-2">
              <input
                type="text"
                value={delegateAddress}
                onChange={(e) => setDelegateAddress(e.target.value)}
                placeholder="Enter address to delegate to..."
                className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1 rounded-lg bg-pink-500 py-2 text-xs font-bold hover:bg-pink-400"
                  onClick={handleDelegate}
                  disabled={isBusy || !delegateAddress}
                >
                  {txStep === "delegating" || isDelegateConfirming ? "DELEGATING..." : "DELEGATE"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-lg border-zinc-700 py-2 text-xs"
                  onClick={() => setShowDelegateInput(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {!isDelegatedToSelf && (
                <Button
                  className="flex-1 rounded-lg bg-zinc-800 py-2 text-xs font-bold hover:bg-zinc-700"
                  onClick={handleSelfDelegate}
                  disabled={isBusy}
                >
                  {txStep === "delegating" || isDelegateConfirming ? "..." : "DELEGATE TO SELF"}
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 rounded-lg border-zinc-700 py-2 text-xs"
                onClick={() => setShowDelegateInput(true)}
              >
                DELEGATE TO OTHER
              </Button>
            </div>
          )}
        </div>
      </div>

      <NavBar />
    </main>
  );
}
