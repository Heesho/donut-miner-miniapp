"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Zap, ExternalLink } from "lucide-react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { base } from "wagmi/chains";
import { formatEther, formatUnits, zeroAddress, type Address } from "viem";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CONTRACT_ADDRESSES,
  LSG_MULTICALL_ABI,
  ERC20_ABI,
  PAYMENT_TOKEN_SYMBOLS,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { NavBar } from "@/components/nav-bar";
import { TokenIcon } from "@/components/token-icon";
import { useEthPrice, useLpTokenPrice, useTokenPrice } from "@/hooks/useTokenPrices";
import { TOKEN_ADDRESSES } from "@/lib/tokens";

type MiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
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

const DEADLINE_BUFFER_SECONDS = 15 * 60;

const formatTokenAmount = (value: bigint, decimals: number, maximumFractionDigits = 2) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatUnits(value, decimals));
  if (!Number.isFinite(asNumber)) return formatUnits(value, decimals);
  return asNumber.toLocaleString(undefined, { maximumFractionDigits });
};

const formatEth = (value: bigint, maximumFractionDigits = 4) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatEther(value));
  if (!Number.isFinite(asNumber)) return formatEther(value);
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

const getPaymentTokenUsdValue = (
  amount: bigint,
  decimals: number,
  paymentToken: Address,
  ethPrice: number,
  lpPrice: number,
  donutPrice: number,
  cbbtcPrice: number
): number => {
  const tokenAmount = Number(formatUnits(amount, decimals));
  const tokenLower = paymentToken.toLowerCase();
  if (tokenLower === TOKEN_ADDRESSES.usdc.toLowerCase()) return tokenAmount;
  if (tokenLower === TOKEN_ADDRESSES.donutEthLp.toLowerCase()) return tokenAmount * lpPrice;
  if (tokenLower === TOKEN_ADDRESSES.donut.toLowerCase()) return tokenAmount * donutPrice;
  if (tokenLower === TOKEN_ADDRESSES.cbbtc.toLowerCase()) return tokenAmount * cbbtcPrice;
  return 0;
};

export default function AuctionsPage() {
  const readyRef = useRef(false);
  const autoConnectAttempted = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<Address | null>(null);
  const [buyResult, setBuyResult] = useState<"success" | "failure" | null>(null);
  const [txStep, setTxStep] = useState<"idle" | "approving" | "buying" | "confirming">("idle");

  const { data: ethUsdPrice = 3500 } = useEthPrice();
  const { price: lpTokenPrice = 0 } = useLpTokenPrice(TOKEN_ADDRESSES.donutEthLp);
  const { data: donutPrice = 0 } = useTokenPrice(TOKEN_ADDRESSES.donut);
  const { data: cbbtcPrice = 0 } = useTokenPrice(TOKEN_ADDRESSES.cbbtc);

  // Debug prices
  console.log("Prices:", { ethUsdPrice, lpTokenPrice, donutPrice, cbbtcPrice });

  const buyResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBuyResult = useCallback((result: "success" | "failure") => {
    if (buyResultTimeoutRef.current) clearTimeout(buyResultTimeoutRef.current);
    setBuyResult(result);
    buyResultTimeoutRef.current = setTimeout(() => {
      setBuyResult(null);
      buyResultTimeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (buyResultTimeoutRef.current) clearTimeout(buyResultTimeoutRef.current);
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

  const { data: rawStrategiesData, refetch: refetchStrategies } = useReadContract({
    address: CONTRACT_ADDRESSES.lsgMulticall as Address,
    abi: LSG_MULTICALL_ABI,
    functionName: "getAllStrategiesData",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: { refetchInterval: 5_000 },
  });

  const strategiesData = useMemo(() => {
    if (!rawStrategiesData) return [];
    return (rawStrategiesData as unknown as StrategyData[]).filter(s => s.isAlive);
  }, [rawStrategiesData]);

  // Sort strategies by profitability (most profitable first)
  const sortedStrategies = useMemo(() => {
    if (!strategiesData.length) return [];

    return [...strategiesData].sort((a, b) => {
      const priceUsdA = getPaymentTokenUsdValue(
        a.currentPrice,
        a.paymentTokenDecimals,
        a.paymentToken,
        ethUsdPrice,
        lpTokenPrice,
        donutPrice,
        cbbtcPrice
      );
      const receiveUsdA = Number(formatEther(a.totalPotentialRevenue)) * ethUsdPrice;
      const profitA = receiveUsdA - priceUsdA;

      const priceUsdB = getPaymentTokenUsdValue(
        b.currentPrice,
        b.paymentTokenDecimals,
        b.paymentToken,
        ethUsdPrice,
        lpTokenPrice,
        donutPrice,
        cbbtcPrice
      );
      const receiveUsdB = Number(formatEther(b.totalPotentialRevenue)) * ethUsdPrice;
      const profitB = receiveUsdB - priceUsdB;

      return profitB - profitA; // Descending order (most profitable first)
    });
  }, [strategiesData, ethUsdPrice, lpTokenPrice, donutPrice, cbbtcPrice]);

  useEffect(() => {
    if (sortedStrategies.length > 0 && !selectedStrategy) {
      setSelectedStrategy(sortedStrategies[0].strategy); // Auto-select most profitable
    }
  }, [sortedStrategies, selectedStrategy]);

  const selectedStrategyData = useMemo(() => {
    if (!selectedStrategy || !strategiesData.length) return null;
    return strategiesData.find(s => s.strategy.toLowerCase() === selectedStrategy.toLowerCase()) || null;
  }, [selectedStrategy, strategiesData]);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: selectedStrategyData?.paymentToken as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address ?? zeroAddress, CONTRACT_ADDRESSES.lsgMulticall as Address],
    chainId: base.id,
    query: { enabled: !!selectedStrategyData && !!address },
  });

  const needsApproval = useMemo(() => {
    if (!selectedStrategyData || !allowance) return true;
    return (allowance as bigint) < selectedStrategyData.currentPrice;
  }, [selectedStrategyData, allowance]);

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
    if (receipt.status === "success") {
      showBuyResult("success");
      refetchStrategies();
      refetchAllowance();
      setTxStep("idle");
      resetWrite();
      setSelectedStrategy(null);
    } else if (receipt.status === "reverted") {
      showBuyResult("failure");
      setTxStep("idle");
      resetWrite();
    }
  }, [receipt, refetchStrategies, refetchAllowance, resetWrite, showBuyResult]);

  const handleBuy = useCallback(async () => {
    if (!selectedStrategyData || !address) return;

    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_SECONDS);
    const maxPayment = (selectedStrategyData.currentPrice * 105n) / 100n;

    console.log("distributeAndBuy params:", {
      strategy: selectedStrategyData.strategy,
      epochId: selectedStrategyData.epochId.toString(),
      deadline: deadline.toString(),
      maxPayment: maxPayment.toString(),
      currentPrice: selectedStrategyData.currentPrice.toString(),
    });

    if (needsApproval) {
      setTxStep("approving");
      try {
        await writeContract({
          address: selectedStrategyData.paymentToken,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONTRACT_ADDRESSES.lsgMulticall as Address, selectedStrategyData.currentPrice * 2n],
          chainId: base.id,
        });
        // Wait for approval to complete before buying
        return;
      } catch (error) {
        console.error("Approval failed:", error);
        showBuyResult("failure");
        setTxStep("idle");
        return;
      }
    }

    setTxStep("buying");
    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.lsgMulticall as Address,
        abi: LSG_MULTICALL_ABI,
        functionName: "distributeAndBuy",
        args: [selectedStrategyData.strategy, selectedStrategyData.epochId, deadline, maxPayment],
        chainId: base.id,
      });
    } catch (error) {
      console.error("Buy failed:", error);
      showBuyResult("failure");
      setTxStep("idle");
    }
  }, [address, selectedStrategyData, needsApproval, writeContract, showBuyResult]);

  const userDisplayName = context?.user?.displayName ?? context?.user?.username ?? "User";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;

  const isLoading = !rawStrategiesData;
  const isBusy = txStep !== "idle" || isWriting || isConfirming;

  return (
    <main className="flex min-h-screen w-full max-w-[430px] mx-auto flex-col bg-background font-mono text-foreground">
      <div
        className="flex flex-1 flex-col px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Auctions</h1>
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

          {/* Auctions List */}
          <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-sm text-muted-foreground">Loading auctions...</span>
              </div>
            ) : sortedStrategies.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-sm text-muted-foreground">No active auctions</span>
              </div>
            ) : (
              sortedStrategies.map((strategy) => {
                const isSelected = selectedStrategy?.toLowerCase() === strategy.strategy.toLowerCase();
                const paymentSymbol = getPaymentTokenSymbol(strategy.paymentToken);
                const priceUsd = getPaymentTokenUsdValue(
                  strategy.currentPrice,
                  strategy.paymentTokenDecimals,
                  strategy.paymentToken,
                  ethUsdPrice,
                  lpTokenPrice,
                  donutPrice,
                  cbbtcPrice
                );
                const receiveUsd = Number(formatEther(strategy.totalPotentialRevenue)) * ethUsdPrice;
                const isProfitable = priceUsd > 0 && receiveUsd > priceUsd;

                return (
                  <Card
                    key={strategy.strategy}
                    className={cn(
                      "transition-all cursor-pointer",
                      isSelected && "border-primary ring-2 ring-primary/20",
                      isProfitable && !isSelected && "border-green-500/50"
                    )}
                    onClick={() => setSelectedStrategy(isSelected ? null : strategy.strategy)}
                  >
                    <CardContent className="p-2">
                      <div className="flex items-center gap-2">
                        {/* Pay */}
                        <div className="flex-1 bg-secondary/50 rounded p-1.5">
                          <div className="text-[9px] text-muted-foreground uppercase">Pay</div>
                          <div className="flex items-center gap-1">
                            <TokenIcon address={strategy.paymentToken} size={16} />
                            <span className="text-sm font-bold text-primary">
                              {formatTokenAmount(strategy.currentPrice, strategy.paymentTokenDecimals, 4)}
                            </span>
                          </div>
                          <div className="text-[9px] text-muted-foreground">${priceUsd.toFixed(2)}</div>
                        </div>
                        {/* Receive */}
                        <div className={cn(
                          "flex-1 rounded p-1.5",
                          isProfitable ? "bg-green-500/10" : "bg-secondary/50"
                        )}>
                          <div className="text-[9px] text-muted-foreground uppercase">Get</div>
                          <div className="flex items-center gap-1">
                            <TokenIcon address={TOKEN_ADDRESSES.weth} size={16} />
                            <span className="text-sm font-bold">
                              {formatEth(strategy.totalPotentialRevenue, 5)}
                            </span>
                          </div>
                          <div className={cn(
                            "text-[9px]",
                            isProfitable ? "text-green-500" : "text-muted-foreground"
                          )}>${receiveUsd.toFixed(2)}</div>
                        </div>
                        {/* Profit Badge */}
                        {isProfitable ? (
                          <Badge variant="default" className="bg-green-600 text-[9px] px-1.5">
                            +${(receiveUsd - priceUsd).toFixed(2)}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] text-red-400 px-1.5">
                            -${Math.abs(receiveUsd - priceUsd).toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Buy Panel - Outside scroll area */}
        {selectedStrategyData && (() => {
          const selectedPayUsd = getPaymentTokenUsdValue(
            selectedStrategyData.currentPrice,
            selectedStrategyData.paymentTokenDecimals,
            selectedStrategyData.paymentToken,
            ethUsdPrice,
            lpTokenPrice,
            donutPrice,
            cbbtcPrice
          );
          const selectedReceiveUsd = Number(formatEther(selectedStrategyData.totalPotentialRevenue)) * ethUsdPrice;
          const selectedIsProfitable = selectedPayUsd > 0 && selectedReceiveUsd > selectedPayUsd;
          const profitOrLoss = selectedReceiveUsd - selectedPayUsd;
          const selectedPaymentSymbol = getPaymentTokenSymbol(selectedStrategyData.paymentToken);
          const hasBalance = selectedStrategyData.accountPaymentTokenBalance >= selectedStrategyData.currentPrice;

          return (
            <div className="space-y-2 pt-2 border-t border-border">
              {/* Balance row */}
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Balance:</span>
                  <TokenIcon address={selectedStrategyData.paymentToken} size={12} />
                  <span className="font-medium">
                    {formatTokenAmount(selectedStrategyData.accountPaymentTokenBalance, selectedStrategyData.paymentTokenDecimals, 4)}
                  </span>
                </div>
                {!hasBalance && (
                  <a
                    href={`https://app.uniswap.org/swap?outputCurrency=${selectedStrategyData.paymentToken}&chain=base`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Get {selectedPaymentSymbol}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Buy Button */}
              <Button
                size="default"
                className={cn(
                  "w-full",
                  buyResult === "success" && "bg-green-600 hover:bg-green-600",
                  buyResult === "failure" && "bg-destructive hover:bg-destructive"
                )}
                onClick={handleBuy}
                disabled={isBusy || !hasBalance}
              >
                {buyResult === "success" ? (
                  <><Zap className="w-4 h-4" /> Success!</>
                ) : buyResult === "failure" ? (
                  "Failed"
                ) : txStep === "approving" ? (
                  "Approving..."
                ) : txStep === "buying" || isWriting || isConfirming ? (
                  "Buying..."
                ) : (
                  <>Buy for ${selectedPayUsd.toFixed(2)} {selectedIsProfitable ? <span className="text-green-300">(+${profitOrLoss.toFixed(2)})</span> : <span className="text-red-300">(-${Math.abs(profitOrLoss).toFixed(2)})</span>}</>
                )}
              </Button>
            </div>
          );
        })()}
      </div>

      <NavBar />
    </main>
  );
}
