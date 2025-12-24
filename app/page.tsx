"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import {
  useAccount,
  useConnect,
  useReadContract,
} from "wagmi";
import { useSendCalls, useCallsStatus } from "wagmi/experimental";
import { base } from "wagmi/chains";
import { encodeFunctionData, formatEther, formatUnits, zeroAddress, type Address } from "viem";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

// Get USD value for payment token amount
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

  // USDC is ~$1
  if (tokenLower === TOKEN_ADDRESSES.usdc.toLowerCase()) {
    return tokenAmount;
  }
  // DONUT-ETH LP
  if (tokenLower === TOKEN_ADDRESSES.donutEthLp.toLowerCase()) {
    return tokenAmount * lpPrice;
  }
  // DONUT
  if (tokenLower === TOKEN_ADDRESSES.donut.toLowerCase()) {
    return tokenAmount * donutPrice;
  }
  // cbBTC
  if (tokenLower === TOKEN_ADDRESSES.cbbtc.toLowerCase()) {
    return tokenAmount * cbbtcPrice;
  }
  return 0;
};

export default function AuctionsPage() {
  const readyRef = useRef(false);
  const autoConnectAttempted = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<Address | null>(null);
  const [buyResult, setBuyResult] = useState<"success" | "failure" | null>(null);
  const [txStep, setTxStep] = useState<"idle" | "approving" | "buying" | "confirming">("idle");

  // Token prices
  const { data: ethUsdPrice = 3500 } = useEthPrice();
  const { price: lpTokenPrice } = useLpTokenPrice(TOKEN_ADDRESSES.donutEthLp);
  const { data: donutPrice = 0 } = useTokenPrice(TOKEN_ADDRESSES.donut);
  const { data: cbbtcPrice = 0 } = useTokenPrice(TOKEN_ADDRESSES.cbbtc);

  const buyResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBuyResult = useCallback((result: "success" | "failure") => {
    if (buyResultTimeoutRef.current) {
      clearTimeout(buyResultTimeoutRef.current);
    }
    setBuyResult(result);
    buyResultTimeoutRef.current = setTimeout(() => {
      setBuyResult(null);
      buyResultTimeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (buyResultTimeoutRef.current) {
        clearTimeout(buyResultTimeoutRef.current);
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

  // Fetch all strategies data
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

  // Select first strategy by default when data loads
  useEffect(() => {
    if (strategiesData.length > 0 && !selectedStrategy) {
      setSelectedStrategy(strategiesData[0].strategy);
    }
  }, [strategiesData, selectedStrategy]);

  // Selected strategy details
  const selectedStrategyData = useMemo(() => {
    if (!selectedStrategy || !strategiesData.length) return null;
    return strategiesData.find(s => s.strategy.toLowerCase() === selectedStrategy.toLowerCase()) || null;
  }, [selectedStrategy, strategiesData]);

  // Check allowance for selected strategy
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

  // Batched transaction hooks for buy (approve + buy in one tx)
  const {
    data: buyCallsId,
    sendCalls: sendBuyCalls,
    isPending: isBuyCallsPending,
    reset: resetBuyCalls,
  } = useSendCalls();

  // Track batched buy transaction status
  const { data: buyCallsStatus } = useCallsStatus({
    id: buyCallsId?.id ?? "",
    query: {
      enabled: !!buyCallsId?.id,
      refetchInterval: (data) =>
        data.state.data?.status === "success" ? false : 1000,
    },
  });

  // Handle batched buy completion
  useEffect(() => {
    if (buyCallsStatus?.status === "success") {
      showBuyResult("success");
      refetchStrategies();
      refetchAllowance();
      setTxStep("idle");
      resetBuyCalls();
      setSelectedStrategy(null);
    } else if (buyCallsStatus?.status === "failure") {
      showBuyResult("failure");
      setTxStep("idle");
      resetBuyCalls();
    }
  }, [buyCallsStatus, refetchStrategies, refetchAllowance, resetBuyCalls, showBuyResult]);

  // Handle buy - batched approve + buy in single transaction
  const handleBuy = useCallback(async () => {
    if (!selectedStrategyData || !address) return;
    setTxStep("buying");
    try {
      // Build calls array - include approval if needed
      const calls: Array<{ to: Address; data: `0x${string}` }> = [];

      // Add approval call if needed
      if (needsApproval) {
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONTRACT_ADDRESSES.lsgMulticall as Address, selectedStrategyData.currentPrice * 2n],
        });
        calls.push({
          to: selectedStrategyData.paymentToken,
          data: approveData,
        });
      }

      // Add buy call
      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_SECONDS);
      const maxPayment = (selectedStrategyData.currentPrice * 105n) / 100n; // 5% slippage
      const buyData = encodeFunctionData({
        abi: LSG_MULTICALL_ABI,
        functionName: "distributeAndBuy",
        args: [selectedStrategyData.strategy, selectedStrategyData.epochId, deadline, maxPayment],
      });
      calls.push({
        to: CONTRACT_ADDRESSES.lsgMulticall as Address,
        data: buyData,
      });

      // Send batched transaction
      await sendBuyCalls({
        calls,
        chainId: base.id,
      });
    } catch (error) {
      console.error("Buy failed:", error);
      showBuyResult("failure");
      setTxStep("idle");
    }
  }, [address, selectedStrategyData, needsApproval, showBuyResult, sendBuyCalls]);

  const userDisplayName = context?.user?.displayName ?? context?.user?.username ?? "Farcaster user";
  const userHandle = context?.user?.username ? `@${context.user.username}` : context?.user?.fid ? `fid ${context.user.fid}` : "";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;

  const isLoading = !strategiesData.length;
  const isBuyConfirming = buyCallsStatus?.status === "pending";
  const isBusy = txStep !== "idle" || isBuyCallsPending || isBuyConfirming;

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
            <h1 className="text-2xl font-bold tracking-wide">AUCTIONS</h1>
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

          {/* Auctions List */}
          <div className="mt-3 flex-1 overflow-y-auto space-y-3 pb-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="text-gray-400">Loading auctions...</div>
              </div>
            ) : strategiesData.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <div className="text-gray-400">No active auctions</div>
              </div>
            ) : (
              strategiesData.map((strategy) => {
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
                      "border-zinc-800 bg-gradient-to-br from-zinc-950 to-black transition-all cursor-pointer",
                      isSelected && "border-pink-500 shadow-[inset_0_0_16px_rgba(236,72,153,0.3)]",
                      isProfitable && !isSelected && "border-green-500/50"
                    )}
                    onClick={() => setSelectedStrategy(isSelected ? null : strategy.strategy)}
                  >
                    <CardContent className="p-3">
                      {/* Price & Revenue Row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg p-2 bg-zinc-900/50">
                          <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400">You Pay</div>
                          <div className="flex items-center gap-2">
                            <TokenIcon address={strategy.paymentToken} size={20} />
                            <div className="text-lg font-bold text-pink-400">
                              {formatTokenAmount(strategy.currentPrice, strategy.paymentTokenDecimals, 4)}
                            </div>
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {paymentSymbol}{priceUsd > 0 ? ` (~$${priceUsd.toFixed(2)})` : ""}
                          </div>
                        </div>
                        <div className={cn(
                          "rounded-lg p-2",
                          isProfitable ? "bg-green-500/10" : "bg-zinc-900/50"
                        )}>
                          <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400">You Receive</div>
                          <div className="flex items-center gap-2">
                            <TokenIcon address={TOKEN_ADDRESSES.weth} size={20} />
                            <div className="text-lg font-bold text-white">
                              {formatEth(strategy.totalPotentialRevenue, 6)}
                            </div>
                          </div>
                          <div className={cn(
                            "text-[10px]",
                            isProfitable ? "text-green-400" : "text-gray-500"
                          )}>
                            WETH (~${receiveUsd.toFixed(2)})
                          </div>
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

        </div>
      </div>

      {/* Buy Panel - Fixed above NavBar */}
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

        return (
        <div
          className="fixed left-0 right-0 bg-zinc-950 px-4 py-3"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}
        >
          <div className="max-w-[520px] mx-auto space-y-3">
            {/* Profitability Message */}
            <div className={cn(
              "text-center text-xs py-2 px-3 rounded-lg",
              selectedIsProfitable ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
            )}>
              {selectedIsProfitable ? (
                <>
                  <span className="font-semibold">Profitable blaze!</span> You&apos;ll receive ${selectedReceiveUsd.toFixed(2)} in WETH for ${selectedPayUsd.toFixed(2)} in {selectedPaymentSymbol} (+${profitOrLoss.toFixed(2)})
                </>
              ) : (
                <>
                  <span className="font-semibold">Unprofitable blaze!</span> You&apos;ll receive ${selectedReceiveUsd.toFixed(2)} in WETH for ${selectedPayUsd.toFixed(2)} in {selectedPaymentSymbol} (-${Math.abs(profitOrLoss).toFixed(2)})
                </>
              )}
            </div>

            {/* Balance Row */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Your Balance:</span>
                <TokenIcon address={selectedStrategyData.paymentToken} size={16} />
                <span className="text-white font-semibold">
                  {formatTokenAmount(selectedStrategyData.accountPaymentTokenBalance, selectedStrategyData.paymentTokenDecimals, 4)}
                </span>
              </div>
              {selectedStrategyData.accountPaymentTokenBalance < selectedStrategyData.currentPrice && (
                <a
                  href={`https://app.uniswap.org/swap?outputCurrency=${selectedStrategyData.paymentToken}&chain=base`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-400 text-xs underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Get {selectedPaymentSymbol}
                </a>
              )}
            </div>

            {/* Buy Button */}
            <Button
              className={cn(
                "w-full rounded-xl py-3 text-sm font-bold shadow-lg transition-colors",
                buyResult === "success" && "bg-green-500 hover:bg-green-400",
                buyResult === "failure" && "bg-red-500 hover:bg-red-400",
                !buyResult && "bg-pink-500 hover:bg-pink-400"
              )}
              onClick={handleBuy}
              disabled={isBusy || selectedStrategyData.accountPaymentTokenBalance < selectedStrategyData.currentPrice}
            >
              {buyResult === "success" ? "SUCCESS!" :
               buyResult === "failure" ? "FAILED" :
               txStep === "buying" || isBuyConfirming ? "BUYING..." :
               "BUY AUCTION"}
            </Button>
          </div>
        </div>
        );
      })()}

      <NavBar />
    </main>
  );
}
