import { NextRequest, NextResponse } from "next/server";

const apiKey = process.env.NEYNAR_API_KEY;

type NeynarUser = {
  fid?: number | null;
  username?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  pfp?: { url?: string | null } | null;
  pfp_url?: string | null;
  profile?: {
    pfp?: { url?: string | null } | null;
    picture_url?: string | null;
    pictureUrl?: string | null;
  } | null;
};

const resolvePfp = (user: NeynarUser | null | undefined) => {
  if (!user) return null;
  const profile = user.profile ?? null;
  return (
    user.pfp?.url ??
    profile?.pfp?.url ??
    profile?.picture_url ??
    profile?.pictureUrl ??
    user.pfp_url ??
    null
  );
};

const buildHeaders = () => ({
  accept: "application/json",
  "x-api-key": apiKey ?? "",
  api_key: apiKey ?? "",
});

const fetchHandleUser = async (handle: string) => {
  if (!handle) return null;
  const lookupUrl = new URL(
    "https://api.neynar.com/v2/farcaster/user/by-username",
  );
  lookupUrl.searchParams.set("username", handle.toLowerCase());
  const res = await fetch(lookupUrl, {
    headers: buildHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`handle lookup failed with ${res.status}`);
  }
  const data = (await res.json()) as {
    result?: { user?: NeynarUser | null };
  };
  return data.result?.user ?? null;
};

const fetchAddressUser = async (address: string) => {
  if (!address) return null;
  const url = new URL(
    "https://api.neynar.com/v2/farcaster/user/bulk-by-address",
  );
  url.searchParams.set("addresses", address);
  url.searchParams.set("address_types", "custody_address,verified_address");

  const res = await fetch(url, {
    headers: buildHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`address lookup failed with ${res.status}`);
  }

  const data = (await res.json()) as {
    result?: {
      user?: NeynarUser | null;
      users?:
        | NeynarUser[]
        | Record<string, NeynarUser | null | undefined>
        | null;
    };
  };

  const candidates: (NeynarUser | null | undefined)[] = [];
  if (data.result?.user) {
    candidates.push(data.result.user);
  }
  const usersField = data.result?.users;
  if (Array.isArray(usersField)) {
    candidates.push(...usersField);
  } else if (usersField && typeof usersField === "object") {
    candidates.push(...Object.values(usersField));
  }

  return (
    candidates.find((candidate) => !!candidate && resolvePfp(candidate)) ??
    candidates.find((candidate) => !!candidate) ??
    null
  );
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

    let handleUser: NeynarUser | null = null;
    if (sanitizedHandle) {
      try {
        handleUser = await fetchHandleUser(sanitizedHandle);
      } catch (error) {
        console.error("[neynar:user] handle lookup failed", error);
      }
    }

    if (handleUser && resolvePfp(handleUser)) {
      return NextResponse.json({
        user: {
          fid: handleUser.fid ?? null,
          username: handleUser.username ?? sanitizedHandle ?? null,
          displayName:
            handleUser.display_name ?? handleUser.displayName ?? null,
          pfpUrl: resolvePfp(handleUser),
        },
      });
    }

    let addressUser: NeynarUser | null = null;
    try {
      addressUser = await fetchAddressUser(normalizedAddress);
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
