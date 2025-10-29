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
    const neynarUrl = new URL(
      "https://api.neynar.com/v2/farcaster/user/bulk-by-address",
    );
    neynarUrl.searchParams.set("addresses", address.toLowerCase());
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

    type NeynarUser = {
      fid?: number;
      username?: string;
      display_name?: string;
      displayName?: string;
      pfp?: { url?: string | null } | null;
      pfp_url?: string | null;
    };

    type RawUserEnvelope = {
      user?: NeynarUser | null;
      address?: string | null;
      custody_address?: string | null;
    } & Partial<NeynarUser>;

    const data = (await res.json()) as {
      result?: {
        users?: RawUserEnvelope[];
      };
    };

    const lowerAddress = address.toLowerCase();

    const envelope =
      data.result?.users?.find((candidate) => {
        const candidateAddresses = [
          candidate.address,
          candidate.custody_address,
        ]
          .filter((entry): entry is string => !!entry)
          .map((entry) => entry.toLowerCase());
        return candidateAddresses.includes(lowerAddress);
      }) ?? data.result?.users?.[0];

    const user = envelope?.user ?? envelope ?? null;

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        fid: user.fid ?? null,
        username: user.username ?? null,
        displayName: user.display_name ?? user.displayName ?? null,
        pfpUrl: user.pfp?.url ?? user.pfp_url ?? null,
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
