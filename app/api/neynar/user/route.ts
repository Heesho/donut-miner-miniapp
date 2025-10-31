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

type NeynarUserEnvelope = {
  user?: NeynarUser | null;
  address?: string | null;
  custody_address?: string | null;
  fid?: number | null;
  username?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  pfp?: { url?: string | null } | null;
  pfp_url?: string | null;
  profile?: NeynarUser["profile"];
};

type NeynarAddressResult = {
  user?: NeynarUserEnvelope | NeynarUser | null;
  users?:
    | (NeynarUserEnvelope | NeynarUser | null | undefined)[]
    | Record<string, NeynarUserEnvelope | NeynarUser | null | undefined>
    | null;
};

type NeynarAddressUsersRecord = Record<
  string,
  NeynarUserEnvelope | NeynarUser | NeynarUser[] | null | undefined
>;

type NeynarAddressResponse =
  | { result?: NeynarAddressResult }
  | NeynarAddressUsersRecord
  | null
  | undefined;

const normalizeUser = (
  value: NeynarUser | NeynarUserEnvelope | null | undefined,
): NeynarUser | null => {
  if (!value) return null;
  const envelope = value as NeynarUserEnvelope;
  const base =
    (envelope.user as NeynarUser | null | undefined) ??
    (value as NeynarUser | null | undefined);

  if (!base) {
    return {
      fid: envelope.fid ?? null,
      username: envelope.username ?? null,
      display_name: envelope.display_name ?? null,
      displayName: envelope.displayName ?? null,
      pfp: envelope.pfp ?? null,
      pfp_url: envelope.pfp_url ?? null,
      profile: envelope.profile ?? null,
    };
  }

  return {
    fid: base.fid ?? envelope.fid ?? null,
    username: base.username ?? envelope.username ?? null,
    display_name: base.display_name ?? envelope.display_name ?? null,
    displayName: base.displayName ?? envelope.displayName ?? null,
    pfp: base.pfp ?? envelope.pfp ?? null,
    pfp_url: base.pfp_url ?? envelope.pfp_url ?? null,
    profile: base.profile ?? envelope.profile ?? null,
  };
};

const resolvePfp = (
  value: NeynarUser | NeynarUserEnvelope | null | undefined,
) => {
  const user = normalizeUser(value);
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

const hasResult = (
  value: NeynarAddressResponse,
): value is { result?: NeynarAddressResult } =>
  !!value &&
  !Array.isArray(value) &&
  typeof value === "object" &&
  "result" in value;

const isUsersRecord = (
  value: NeynarAddressResponse,
): value is NeynarAddressUsersRecord =>
  !!value &&
  !Array.isArray(value) &&
  typeof value === "object" &&
  !("result" in value);

const buildHeaders = () => {
  if (!apiKey) {
    throw new Error("Neynar API key not configured.");
  }
  return {
    accept: "application/json",
    "x-api-key": apiKey,
    api_key: apiKey,
  };
};

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
  const data = (await res.json()) as
    | {
        result?: { user?: NeynarUser | null };
        user?: NeynarUser | null;
      }
    | NeynarUser
    | null
    | undefined;

  if (!data) return null;
  if ("result" in data && data.result) {
    return data.result.user ?? null;
  }
  if ("user" in data) {
    return (data as { user?: NeynarUser | null }).user ?? null;
  }
  return (data as NeynarUser) ?? null;
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

  const rawData = (await res.json()) as NeynarAddressResponse;

  const candidates: (NeynarUserEnvelope | NeynarUser | null | undefined)[] = [];

  if (hasResult(rawData)) {
    const data = rawData.result;
    if (data?.user) {
      candidates.push(data.user);
    }
    const usersField = data?.users;
    if (Array.isArray(usersField)) {
      candidates.push(...usersField);
    } else if (usersField && typeof usersField === "object") {
      candidates.push(...Object.values(usersField));
    }
  } else if (isUsersRecord(rawData)) {
    const values = Object.values(rawData);
    for (const value of values) {
      if (!value) continue;
      if (Array.isArray(value)) {
        candidates.push(...value);
      } else {
        candidates.push(value);
      }
    }
  }

  if (candidates.length === 0) return null;

  const preferred =
    candidates.find((candidate) => !!resolvePfp(candidate)) ?? candidates[0];

  return normalizeUser(preferred);
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
