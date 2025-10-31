import { NextRequest, NextResponse } from "next/server";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const apiKey = process.env.NEYNAR_API_KEY;
const neynarClient = apiKey ? new NeynarAPIClient(apiKey) : null;

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

  if (!apiKey || !neynarClient) {
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

    let user = null;
    let pfpUrl = null;

    // Try fetching by username first if provided
    if (sanitizedHandle) {
      try {
        const response = await neynarClient.fetchBulkUsers([sanitizedHandle], { viewerFid: undefined });
        if (response?.users?.[0]) {
          user = response.users[0];
          pfpUrl = user.pfp_url || user.pfp?.url || null;
        }
      } catch (error) {
        // Username lookup failed, will try address lookup
      }
    }

    // If no user found by username or no pfp, try by address
    if (!user || !pfpUrl) {
      try {
        const response = await neynarClient.fetchBulkUsersByEthereumAddress([normalizedAddress], { addressTypes: ["custody_address", "verified_address"] });

        // The response format is an object with addresses as keys
        const addressKey = Object.keys(response).find(
          key => key.toLowerCase() === normalizedAddress
        );

        if (addressKey && response[addressKey]?.[0]) {
          const addressUser = response[addressKey][0];
          if (!user || !pfpUrl) {
            user = addressUser;
            pfpUrl = addressUser.pfp_url || addressUser.pfp?.url || null;
          }
        }
      } catch (error) {
        // Address lookup failed
      }
    }

    // Return user data
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        fid: user.fid ?? null,
        username: user.username ?? sanitizedHandle ?? null,
        displayName: user.display_name ?? user.displayName ?? null,
        pfpUrl: pfpUrl,
      },
    });
  } catch (error) {
    console.error("[neynar:user] Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch Neynar user." },
      { status: 500 },
    );
  }
}
