import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk";
import { NextRequest, NextResponse } from "next/server";
const apiKey = process.env.NEYNAR_API_KEY;

type NeynarApiVerifiedAddresses = {
  eth_addresses?: string[] | null;
  sol_addresses?: string[] | null;
};

type NeynarApiProfile = {
  pfp?: {
    url?: string | null;
  } | null;
  picture_url?: string | null;
  pictureUrl?: string | null;
} | null;

type NeynarApiUser = {
  fid?: number | null;
  username?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  pfp?: { url?: string | null } | null;
  pfp_url?: string | null;
  profile?: NeynarApiProfile;
  verifications?: string[] | null;
  verified_addresses?: NeynarApiVerifiedAddresses | null;
  custody_address?: string | null;
  address?: string | null;
};

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

    const client = new NeynarAPIClient(
      new Configuration({
        apiKey,
      }),
    );

    const resolvePfp = (value: NeynarApiUser | null | undefined) => {
      if (!value) return null;
      const maybeProfile = value.profile as
        | (NeynarApiProfile & {
            picture_url?: string | null;
            pictureUrl?: string | null;
          })
        | null
        | undefined;

      return (
        value.pfp?.url ??
        maybeProfile?.pfp?.url ??
        maybeProfile?.picture_url ??
        maybeProfile?.pictureUrl ??
        value.pfp_url ??
        null
      );
    };

    let handleUser: NeynarApiUser | null = null;
    if (sanitizedHandle) {
      try {
        const { result } = await client.lookupUserByUsername(sanitizedHandle);
        handleUser = result?.user ?? null;
      } catch (error) {
        console.error("[neynar:user] handle lookup failed", error);
      }
    }

    if (handleUser && resolvePfp(handleUser)) {
      return NextResponse.json({
        user: {
          fid: handleUser.fid ?? null,
          username: handleUser.username ?? null,
          displayName:
            handleUser.display_name ?? handleUser.displayName ?? null,
          pfpUrl: resolvePfp(handleUser),
        },
      });
    }

    let addressUser: NeynarApiUser | null = null;
    try {
      const { result } = await client.fetchBulkUsersByEthOrSolAddress({
        addresses: [normalizedAddress],
      });
      let candidate: NeynarApiUser | null = null;
      if (result?.user) {
        candidate = result.user as NeynarApiUser;
      } else if (Array.isArray(result?.users)) {
        candidate = (result?.users?.[0] as NeynarApiUser | undefined) ?? null;
      } else if (result?.users && typeof result.users === "object") {
        const first = Object.values(result.users)[0] as
          | NeynarApiUser
          | undefined
          | null;
        candidate = first ?? null;
      }
      addressUser = candidate ?? null;
    } catch (error) {
      console.error("[neynar:user] address lookup failed", error);
    }

    if (!addressUser && !handleUser) {
      return NextResponse.json({ user: null });
    }

    const primary = addressUser ?? handleUser ?? null;
    const secondary = addressUser ? handleUser : null;

    return NextResponse.json({
      user: {
        fid: primary?.fid ?? secondary?.fid ?? null,
        username:
          primary?.username ??
          secondary?.username ??
          (sanitizedHandle || null),
        displayName:
          primary?.display_name ??
          primary?.displayName ??
          secondary?.display_name ??
          secondary?.displayName ??
          null,
        pfpUrl: resolvePfp(primary) ?? resolvePfp(secondary),
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
