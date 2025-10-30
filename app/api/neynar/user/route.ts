import { NextRequest, NextResponse } from "next/server";
const apiKey = process.env.NEYNAR_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Missing address parameter." },
      { status: 400 },
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Neynar API key not configured." },
      { status: 503 },
    );
  }

  try {
    const cleanedAddress = address.trim();
    if (!cleanedAddress) {
      return NextResponse.json(
        { error: "Address parameter is empty." },
        { status: 400 },
      );
    }
    const normalizedAddress = cleanedAddress.toLowerCase();

    const neynarUrl = new URL(
      "https://api.neynar.com/v2/farcaster/user/bulk-by-address",
    );
    neynarUrl.searchParams.set("addresses", normalizedAddress);
    neynarUrl.searchParams.set(
      "address_types",
      "custody_address,verified_address",
    );

    const res = await fetch(neynarUrl, {
      headers: {
        accept: "application/json",
        "x-api-key": apiKey,
        "api_key": apiKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ user: null });
      }
      throw new Error(`Neynar request failed with ${res.status}`);
    }

    type VerifiedAddressList = {
      eth_addresses?: string[] | null;
      sol_addresses?: string[] | null;
    };

    type NeynarProfile = {
      pfp?: {
        url?: string | null;
      } | null;
    } | null;

    type NeynarUser = {
      fid?: number;
      username?: string;
      display_name?: string;
      displayName?: string;
      pfp?: { url?: string | null } | null;
      pfp_url?: string | null;
      profile?: NeynarProfile;
      verifications?: string[] | null;
      verified_addresses?: VerifiedAddressList | null;
      custody_address?: string | null;
      address?: string | null;
    };

    type RawUserEnvelope = NeynarUser & {
      user?: NeynarUser | null;
      address?: string | null;
      custody_address?: string | null;
    };

    type NeynarResponse = {
      result?: {
        user?: RawUserEnvelope | null;
        users?:
          | RawUserEnvelope[]
          | Record<string, RawUserEnvelope | null>
          | null;
      };
    };

    const data = (await res.json()) as NeynarResponse;

    const normaliseList = (
      input:
        | RawUserEnvelope[]
        | Record<string, RawUserEnvelope | null>
        | null
        | undefined,
    ): RawUserEnvelope[] => {
      if (!input) return [];
      if (Array.isArray(input)) return input;
      return Object.values(input).filter(
        (candidate): candidate is RawUserEnvelope => !!candidate,
      );
    };

    const candidates = [
      ...(data.result?.user ? [data.result.user] : []),
      ...normaliseList(data.result?.users),
    ];

    const collectAddresses = (candidate: RawUserEnvelope) => {
      const collected = new Set<string>();
      const push = (value?: string | null) => {
        if (value) {
          collected.add(value.toLowerCase());
        }
      };

      push(candidate.address);
      push(candidate.custody_address);
      candidate.verifications?.forEach(push);
      candidate.verified_addresses?.eth_addresses?.forEach(push);
      candidate.verified_addresses?.sol_addresses?.forEach(push);

      const user = candidate.user;
      if (user) {
        push(user.address);
        push(user.custody_address);
        user.verifications?.forEach(push);
        user.verified_addresses?.eth_addresses?.forEach(push);
        user.verified_addresses?.sol_addresses?.forEach(push);
      }

      return collected;
    };

    const envelope =
      candidates.find((candidate) =>
        collectAddresses(candidate).has(normalizedAddress),
      ) ?? candidates[0];

    const user = envelope?.user ?? envelope ?? null;

    if (!user) {
      return NextResponse.json({ user: null });
    }

    const resolvePfp = (value: NeynarUser | null | undefined) => {
      if (!value) return null;
      return (
        value.pfp?.url ??
        value.profile?.pfp?.url ??
        value.pfp_url ??
        null
      );
    };

    return NextResponse.json({
      user: {
        fid: user.fid ?? null,
        username: user.username ?? null,
        displayName: user.display_name ?? user.displayName ?? null,
        pfpUrl: resolvePfp(user) ?? resolvePfp(envelope ?? null),
      },
    });
  } catch (error) {
    console.error("[neynar:user] failed", error);
    return NextResponse.json(
      { error: "Failed to fetch Neynar user." },
      { status: 500 },
    );
  }
}
