import { NextRequest, NextResponse } from "next/server";
const apiKey = process.env.NEYNAR_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");
  const handleParam = searchParams.get("handle");

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
    const cleanedHandle = handleParam?.trim() ?? "";
    const sanitizedHandle = cleanedHandle.replace(/^@+/, "");

    const neynarUrl = new URL(
      "https://api.neynar.com/v2/farcaster/user/bulk-by-address",
    );
    neynarUrl.searchParams.set("addresses", normalizedAddress);
    neynarUrl.searchParams.set(
      "address_types",
      "custody_address,verified_address",
    );

    const headers = {
      accept: "application/json",
      "x-api-key": apiKey,
      api_key: apiKey,
    };

    const res = await fetch(neynarUrl, {
      headers,
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

    const resolvePfp = (value: NeynarUser | null | undefined) => {
      if (!value) return null;
      return (
        value.pfp?.url ??
        value.profile?.pfp?.url ??
        value.pfp_url ??
        null
      );
    };

    const fetchByHandle = async (
      handle: string,
    ): Promise<RawUserEnvelope | null> => {
      if (!handle) return null;
      const normalized = handle.toLowerCase();
      const handleUrl = new URL(
        "https://api.neynar.com/v2/farcaster/user/by-username",
      );
      handleUrl.searchParams.set("username", normalized);
      const handleRes = await fetch(handleUrl, {
        headers,
        cache: "no-store",
      });
      if (!handleRes.ok) {
        if (handleRes.status === 404) {
          return null;
        }
        throw new Error(`Neynar username lookup failed with ${handleRes.status}`);
      }
      const handleData = (await handleRes.json()) as {
        result?: { user?: NeynarUser | null };
      };
      const handleUser = handleData.result?.user ?? null;
      return handleUser ? ({ user: handleUser } as RawUserEnvelope) : null;
    };

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

    let envelope =
      candidates.find((candidate) =>
        collectAddresses(candidate).has(normalizedAddress),
      ) ?? candidates[0];

    let user = envelope?.user ?? envelope ?? null;

    let handleEnvelope: RawUserEnvelope | null = null;
    if ((!user || !resolvePfp(user)) && sanitizedHandle) {
      handleEnvelope = await fetchByHandle(sanitizedHandle);
      if (!envelope && handleEnvelope) {
        envelope = handleEnvelope;
      }
      if (!user && handleEnvelope) {
        user = handleEnvelope.user ?? handleEnvelope ?? null;
      }
    }

    const handleUser = handleEnvelope?.user ?? handleEnvelope ?? null;

    if (!user && !handleUser) {
      return NextResponse.json({ user: null });
    }

    const primary = user ?? handleUser ?? null;
    const secondary = user ? handleUser : null;

    return NextResponse.json({
      user: {
        fid: primary?.fid ?? secondary?.fid ?? null,
        username: primary?.username ?? secondary?.username ?? null,
        displayName:
          primary?.display_name ??
          primary?.displayName ??
          secondary?.display_name ??
          secondary?.displayName ??
          null,
        pfpUrl:
          resolvePfp(primary) ??
          resolvePfp(secondary) ??
          resolvePfp(envelope ?? null),
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
