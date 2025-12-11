import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import { type Address } from "viem";
import {
  getTokenPrice,
  getLpTokenPrice,
  getTokenInfo,
  lpTokenAbi,
  TOKEN_ADDRESSES,
} from "@/lib/tokens";

// Hook to get a single token price (non-LP tokens)
export function useTokenPrice(address: Address | string | undefined) {
  return useQuery({
    queryKey: ["token-price", address?.toLowerCase()],
    queryFn: async () => {
      if (!address) return 0;
      return getTokenPrice(address);
    },
    enabled: !!address,
    staleTime: 60_000, // 1 minute
    refetchInterval: 60_000,
  });
}

// Hook to get ETH price
export function useEthPrice() {
  return useTokenPrice(TOKEN_ADDRESSES.weth);
}

// Hook to get LP token price
export function useLpTokenPrice(lpAddress: Address | undefined) {
  // Read LP contract data
  const { data: lpData, isLoading: isLoadingLpData } = useReadContracts({
    contracts: lpAddress
      ? [
          {
            address: lpAddress,
            abi: lpTokenAbi,
            functionName: "totalSupply",
          },
          {
            address: lpAddress,
            abi: lpTokenAbi,
            functionName: "getReserves",
          },
          {
            address: lpAddress,
            abi: lpTokenAbi,
            functionName: "token0",
          },
          {
            address: lpAddress,
            abi: lpTokenAbi,
            functionName: "token1",
          },
        ]
      : [],
    query: {
      enabled: !!lpAddress,
      staleTime: 30_000, // 30 seconds for on-chain data
    },
  });

  // Calculate LP price from the contract data
  const { data: lpPrice, isLoading: isLoadingPrice } = useQuery({
    queryKey: [
      "lp-token-price",
      lpAddress?.toLowerCase(),
      lpData?.[0]?.result?.toString(),
      lpData?.[1]?.result?.[0]?.toString(),
      lpData?.[1]?.result?.[1]?.toString(),
    ],
    queryFn: async () => {
      if (!lpAddress || !lpData) return 0;

      const totalSupply = lpData[0]?.result as bigint | undefined;
      const reserves = lpData[1]?.result as
        | [bigint, bigint, number]
        | undefined;
      const token0 = lpData[2]?.result as Address | undefined;
      const token1 = lpData[3]?.result as Address | undefined;

      if (!totalSupply || !reserves || !token0 || !token1) return 0;

      return getLpTokenPrice(
        lpAddress,
        totalSupply,
        { reserve0: reserves[0], reserve1: reserves[1] },
        token0,
        token1
      );
    },
    enabled: !!lpAddress && !!lpData && lpData.every((d) => d.status === "success"),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return {
    price: lpPrice ?? 0,
    isLoading: isLoadingLpData || isLoadingPrice,
    // Also expose the raw LP data in case it's useful
    totalSupply: lpData?.[0]?.result as bigint | undefined,
    reserves: lpData?.[1]?.result as [bigint, bigint, number] | undefined,
    token0: lpData?.[2]?.result as Address | undefined,
    token1: lpData?.[3]?.result as Address | undefined,
  };
}

// Hook to get any token price (auto-detects LP tokens)
export function useAnyTokenPrice(address: Address | string | undefined) {
  const tokenInfo = address ? getTokenInfo(address) : undefined;
  const isLp = tokenInfo?.isLp ?? false;

  // Use LP price hook if it's an LP token
  const lpPrice = useLpTokenPrice(isLp ? (address as Address) : undefined);

  // Use regular price hook if it's not an LP token
  const regularPrice = useTokenPrice(!isLp ? address : undefined);

  if (isLp) {
    return {
      price: lpPrice.price,
      isLoading: lpPrice.isLoading,
    };
  }

  return {
    price: regularPrice.data ?? 0,
    isLoading: regularPrice.isLoading,
  };
}

// Hook to get DONUT-ETH LP price specifically
export function useDonutEthLpPrice() {
  return useLpTokenPrice(TOKEN_ADDRESSES.donutEthLp);
}
