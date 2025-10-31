import { NextRequest, NextResponse } from "next/server";
import { GraphQLClient } from "graphql-request";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL ||
  "https://gateway.thegraph.com/api/subgraphs/id/8LAXZsz9xTzGMH2HB1F78AkoXD9yvxm2epLGr48wDhrK";

const GET_ACCOUNT_QUERY = `
  query GetAccount($id: ID!) {
    account(id: $id) {
      id
      spent
      earned
      mined
    }
  }
`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Address parameter is required" },
      { status: 400 },
    );
  }

  try {
    const client = new GraphQLClient(SUBGRAPH_URL, {
      headers: process.env.GRAPH_API_KEY
        ? {
            Authorization: `Bearer ${process.env.GRAPH_API_KEY}`,
          }
        : {},
    });

    const response = await client.request<{
      account: {
        id: string;
        spent: string;
        earned: string;
        mined: string;
      } | null;
    }>(GET_ACCOUNT_QUERY, {
      id: address.toLowerCase(),
    });

    return NextResponse.json(response.account);
  } catch (error) {
    console.error("Error fetching subgraph data:", error);
    return NextResponse.json(null);
  }
}
