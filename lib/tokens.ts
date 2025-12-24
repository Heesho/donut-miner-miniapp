import { type Address, erc20Abi } from "viem";

export type TokenInfo = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  icon: string; // Path to icon in /public/tokens/
  coingeckoId?: string; // For fetching price from CoinGecko
  isLp?: boolean; // Is this an LP token?
  token0?: Address; // For LP tokens - first token
  token1?: Address; // For LP tokens - second token
};

// Token addresses on Base
export const TOKEN_ADDRESSES = {
  donut: "0xae4a37d554c6d6f3e398546d8566b25052e0169c" as Address,
  weth: "0x4200000000000000000000000000000000000006" as Address,
  usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as Address,
  cbbtc: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as Address,
  donutEthLp: "0xD1DbB2E56533C55C3A637D13C53aeEf65c5D5703" as Address,
  gDonut: "0xC78B6e362cB0f48b59E573dfe7C99d92153a16d3" as Address,
} as const;

// Token metadata registry
export const TOKENS: Record<string, TokenInfo> = {
  [TOKEN_ADDRESSES.donut.toLowerCase()]: {
    address: TOKEN_ADDRESSES.donut,
    name: "Donut",
    symbol: "DONUT",
    decimals: 18,
    icon: "/tokens/donut.svg",
    coingeckoId: "donut-2",
  },
  [TOKEN_ADDRESSES.weth.toLowerCase()]: {
    address: TOKEN_ADDRESSES.weth,
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png?1696501628",
    coingeckoId: "ethereum",
  },
  [TOKEN_ADDRESSES.usdc.toLowerCase()]: {
    address: TOKEN_ADDRESSES.usdc,
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png?1696506694",
    coingeckoId: "usd-coin",
  },
  [TOKEN_ADDRESSES.cbbtc.toLowerCase()]: {
    address: TOKEN_ADDRESSES.cbbtc,
    name: "Coinbase Wrapped BTC",
    symbol: "cbBTC",
    decimals: 8,
    icon: "https://coin-images.coingecko.com/coins/images/40143/small/cbbtc.webp?1726136727",
    coingeckoId: "coinbase-wrapped-btc",
  },
  [TOKEN_ADDRESSES.donutEthLp.toLowerCase()]: {
    address: TOKEN_ADDRESSES.donutEthLp,
    name: "DONUT-ETH LP",
    symbol: "DONUT-ETH",
    decimals: 18,
    icon: "/tokens/donut-eth-lp.svg", // We'll create a combined icon
    isLp: true,
    token0: TOKEN_ADDRESSES.donut,
    token1: TOKEN_ADDRESSES.weth,
  },
  [TOKEN_ADDRESSES.gDonut.toLowerCase()]: {
    address: TOKEN_ADDRESSES.gDonut,
    name: "Governance Donut",
    symbol: "gDONUT",
    decimals: 18,
    icon: "/tokens/gdonut.svg",
  },
};

// Helper to get token info by address
export function getTokenInfo(address: Address | string): TokenInfo | undefined {
  return TOKENS[address.toLowerCase()];
}

// Helper to get token symbol
export function getTokenSymbol(address: Address | string): string {
  return TOKENS[address.toLowerCase()]?.symbol ?? "TOKEN";
}

// Helper to get token decimals
export function getTokenDecimals(address: Address | string): number {
  return TOKENS[address.toLowerCase()]?.decimals ?? 18;
}

// Helper to get token icon path
export function getTokenIcon(address: Address | string): string {
  return TOKENS[address.toLowerCase()]?.icon ?? "/tokens/unknown.svg";
}

// Get LP token pair icons
export function getLpTokenIcons(address: Address | string): [string, string] | null {
  const token = TOKENS[address.toLowerCase()];
  if (!token?.isLp || !token.token0 || !token.token1) return null;

  const token0Icon = TOKENS[token.token0.toLowerCase()]?.icon ?? "/tokens/unknown.svg";
  const token1Icon = TOKENS[token.token1.toLowerCase()]?.icon ?? "/tokens/unknown.svg";

  return [token0Icon, token1Icon];
}

// Price cache with TTL
type PriceCache = {
  [key: string]: {
    price: number;
    timestamp: number;
  };
};

const priceCache: PriceCache = {};
const PRICE_CACHE_TTL = 60_000; // 1 minute

// Fetch token price from CoinGecko
export async function getTokenPrice(address: Address | string): Promise<number> {
  const token = TOKENS[address.toLowerCase()];

  // USDC is always ~$1
  if (token?.symbol === "USDC") return 1;

  // Check cache first
  const cached = priceCache[address.toLowerCase()];
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.price;
  }

  // If it has a coingecko ID, fetch from there
  if (token?.coingeckoId) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${token.coingeckoId}&vs_currencies=usd`
      );
      if (res.ok) {
        const data = await res.json();
        const price = data[token.coingeckoId]?.usd ?? 0;
        priceCache[address.toLowerCase()] = { price, timestamp: Date.now() };
        return price;
      }
    } catch (e) {
      console.error("Failed to fetch price from CoinGecko:", e);
    }
  }

  // Return cached price if available (even if stale), otherwise 0
  return cached?.price ?? 0;
}

// Fetch ETH price (convenience function)
export async function getEthPrice(): Promise<number> {
  return getTokenPrice(TOKEN_ADDRESSES.weth);
}

// Batch fetch multiple token prices
export async function getTokenPrices(addresses: (Address | string)[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};

  // Group by coingecko ID for batch fetching
  const coingeckoIds: string[] = [];
  const addressToId: Record<string, string> = {};

  for (const addr of addresses) {
    const token = TOKENS[addr.toLowerCase()];
    if (token?.coingeckoId) {
      coingeckoIds.push(token.coingeckoId);
      addressToId[addr.toLowerCase()] = token.coingeckoId;
    } else if (token?.symbol === "USDC") {
      prices[addr.toLowerCase()] = 1;
    }
  }

  if (coingeckoIds.length > 0) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds.join(",")}&vs_currencies=usd`
      );
      if (res.ok) {
        const data = await res.json();
        for (const [addr, id] of Object.entries(addressToId)) {
          const price = data[id]?.usd ?? 0;
          prices[addr] = price;
          priceCache[addr] = { price, timestamp: Date.now() };
        }
      }
    } catch (e) {
      console.error("Failed to batch fetch prices:", e);
    }
  }

  return prices;
}

// UniV2 LP token ABI for price calculation
export const lpTokenAbi = [
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getReserves",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
  {
    name: "token0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "token1",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

// Calculate LP token price using the formula:
// LP Price = (priceableTokenReserve * 2 * priceableTokenPrice) / totalSupply
// This works for UniV2 50/50 pools because the value of both sides is always equal
export async function getLpTokenPrice(
  lpAddress: Address,
  totalSupply: bigint,
  reserves: { reserve0: bigint; reserve1: bigint },
  token0Address: Address,
  token1Address: Address
): Promise<number> {
  // Check cache first
  const cached = priceCache[lpAddress.toLowerCase()];
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.price;
  }

  const token0 = getTokenInfo(token0Address);
  const token1 = getTokenInfo(token1Address);

  // Find which token to use for pricing
  // Priority: WETH > USDC > other tokens with coingecko IDs
  let priceableReserve: bigint;
  let priceableDecimals: number;
  let priceablePrice: number;

  const token0IsWeth = token0Address.toLowerCase() === TOKEN_ADDRESSES.weth.toLowerCase();
  const token1IsWeth = token1Address.toLowerCase() === TOKEN_ADDRESSES.weth.toLowerCase();
  const token0IsUsdc = token0?.symbol === "USDC";
  const token1IsUsdc = token1?.symbol === "USDC";

  if (token0IsWeth) {
    // Prefer WETH in token0
    priceableReserve = reserves.reserve0;
    priceableDecimals = token0!.decimals;
    priceablePrice = await getTokenPrice(token0Address);
  } else if (token1IsWeth) {
    // Prefer WETH in token1
    priceableReserve = reserves.reserve1;
    priceableDecimals = token1!.decimals;
    priceablePrice = await getTokenPrice(token1Address);
  } else if (token0IsUsdc) {
    // Then prefer USDC in token0
    priceableReserve = reserves.reserve0;
    priceableDecimals = token0!.decimals;
    priceablePrice = 1;
  } else if (token1IsUsdc) {
    // Then prefer USDC in token1
    priceableReserve = reserves.reserve1;
    priceableDecimals = token1!.decimals;
    priceablePrice = 1;
  } else if (token0?.coingeckoId) {
    // Fall back to any token with coingecko ID
    priceableReserve = reserves.reserve0;
    priceableDecimals = token0.decimals;
    priceablePrice = await getTokenPrice(token0Address);
  } else if (token1?.coingeckoId) {
    priceableReserve = reserves.reserve1;
    priceableDecimals = token1.decimals;
    priceablePrice = await getTokenPrice(token1Address);
  } else {
    // Can't price this LP
    return 0;
  }

  if (totalSupply === 0n || priceablePrice === 0) return 0;

  // Convert reserves to decimal
  const reserveValue = Number(priceableReserve) / 10 ** priceableDecimals;
  const supplyValue = Number(totalSupply) / 10 ** 18; // LP tokens are always 18 decimals

  // LP Price = (reserve * 2 * price) / totalSupply
  const lpPrice = (reserveValue * 2 * priceablePrice) / supplyValue;

  // Cache the result
  priceCache[lpAddress.toLowerCase()] = { price: lpPrice, timestamp: Date.now() };

  return lpPrice;
}
