"use client";

import Image from "next/image";
import { type Address } from "viem";
import { getTokenInfo, getLpTokenIcons } from "@/lib/tokens";
import { cn } from "@/lib/utils";

type TokenIconProps = {
  address: Address | string;
  size?: number;
  className?: string;
};

export function TokenIcon({ address, size = 24, className }: TokenIconProps) {
  const token = getTokenInfo(address);
  const lpIcons = getLpTokenIcons(address);

  // For LP tokens, show both icons overlapping
  if (lpIcons) {
    const [icon0, icon1] = lpIcons;
    const iconSize = size * 0.75;
    const overlap = size * 0.35;

    return (
      <div
        className={cn("relative flex-shrink-0", className)}
        style={{ width: size + overlap, height: size }}
      >
        <Image
          src={icon0}
          alt=""
          width={iconSize}
          height={iconSize}
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
        />
        <Image
          src={icon1}
          alt=""
          width={iconSize}
          height={iconSize}
          className="absolute top-1/2 -translate-y-1/2 rounded-full"
          style={{ left: overlap + iconSize * 0.25 }}
        />
      </div>
    );
  }

  // Single token icon
  return (
    <Image
      src={token?.icon ?? "/tokens/unknown.svg"}
      alt={token?.symbol ?? "Token"}
      width={size}
      height={size}
      className={cn("rounded-full flex-shrink-0", className)}
    />
  );
}

type TokenIconPairProps = {
  address0: Address | string;
  address1: Address | string;
  size?: number;
  className?: string;
};

// Explicitly show two token icons side by side (for custom pairs)
export function TokenIconPair({ address0, address1, size = 24, className }: TokenIconPairProps) {
  const token0 = getTokenInfo(address0);
  const token1 = getTokenInfo(address1);
  const iconSize = size * 0.75;
  const overlap = size * 0.35;

  return (
    <div
      className={cn("relative flex-shrink-0", className)}
      style={{ width: size + overlap, height: size }}
    >
      <Image
        src={token0?.icon ?? "/tokens/unknown.svg"}
        alt={token0?.symbol ?? ""}
        width={iconSize}
        height={iconSize}
        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
      />
      <Image
        src={token1?.icon ?? "/tokens/unknown.svg"}
        alt={token1?.symbol ?? ""}
        width={iconSize}
        height={iconSize}
        className="absolute top-1/2 -translate-y-1/2 rounded-full"
        style={{ left: overlap + iconSize * 0.25 }}
      />
    </div>
  );
}

type TokenDisplayProps = {
  address: Address | string;
  amount?: string;
  size?: number;
  showSymbol?: boolean;
  className?: string;
};

// Token icon with optional amount and symbol
export function TokenDisplay({ address, amount, size = 20, showSymbol = true, className }: TokenDisplayProps) {
  const token = getTokenInfo(address);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <TokenIcon address={address} size={size} />
      {amount && <span className="font-semibold">{amount}</span>}
      {showSymbol && <span className="text-gray-400">{token?.symbol ?? "TOKEN"}</span>}
    </div>
  );
}
