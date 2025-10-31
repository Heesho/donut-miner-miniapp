import { NextRequest, NextResponse } from "next/server";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const apiKey = process.env.NEYNAR_API_KEY;
const neynarClient = apiKey ? new NeynarAPIClient(apiKey) : null;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Missing address parameter." },
      { status: 400 },
    );
  }

  if (!apiKey || !neynarClient) {
    return NextResponse.json(
      { error: "Neynar API key not configured." },
      { status: 503 },
    );
  }

  try {
    const normalizedAddress = address.trim().toLowerCase();
    if (!normalizedAddress) {
      return NextResponse.json(
        { error: "Address parameter is empty." },
        { status: 400 },
      );
    }

    const response = await neynarClient.fetchBulkUsersByEthereumAddress(
      [normalizedAddress]
    );

    const addressKey = Object.keys(response).find(
      key => key.toLowerCase() === normalizedAddress
    );

    const user = addressKey && response[addressKey]?.[0] ? response[addressKey][0] : null;

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        fid: user.fid ?? null,
        username: user.username ?? null,
        displayName: user.display_name ?? null,
        pfpUrl: user.pfp_url ?? null,
      },
    });
  } catch (error) {
    console.error("[neynar:user] Error fetching user:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch Neynar user.",
        details: errorMessage
      },
      { status: 500 },
    );
  }
}
