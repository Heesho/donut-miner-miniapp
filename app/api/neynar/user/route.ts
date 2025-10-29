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
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,
      {
        headers: {
          accept: "application/json",
          "api_key": apiKey,
        },
        cache: "no-store",
      },
    );

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

    const data = (await res.json()) as {
      result?: {
        users?: Array<{
          user?: NeynarUser | null;
          address?: string;
        }>;
      };
    };

    const user = data.result?.users?.[0]?.user ?? null;

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
