import { NextRequest, NextResponse } from "next/server";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const apiKey = process.env.NEYNAR_API_KEY;

const client =
  apiKey != null
    ? new NeynarAPIClient(apiKey)
    : null;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Missing address parameter." },
      { status: 400 },
    );
  }

  if (!client) {
    return NextResponse.json(
      { error: "Neynar API key not configured." },
      { status: 503 },
    );
  }

  try {
    const response = await client.fetchBulkUsersByEthOrSolAddress({
      addresses: [address],
    });

    const resultUsers =
      (response as { result?: { users?: Array<Record<string, unknown>> } })
        .result?.users ??
      (response as { result?: { user?: Record<string, unknown> } }).result?.user
        ? [
            (response as { result?: { user?: Record<string, unknown> } }).result
              ?.user ?? null,
          ]
        : [];

    const user = resultUsers?.[0] as
      | {
          fid?: number;
          username?: string;
          displayName?: string;
          pfp?: { url?: string | null } | null;
          pfp_url?: string | null;
        }
      | null
      | undefined;

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        fid: user.fid ?? null,
        username: user.username ?? null,
        displayName: user.displayName ?? null,
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
