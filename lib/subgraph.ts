import { GraphQLClient } from "graphql-request";

export const SUBGRAPH_URL =
  "https://gateway.thegraph.com/api/subgraphs/id/8LAXZsz9xTzGMH2HB1F78AkoXD9yvxm2epLGr48wDhrK";

export const subgraphClient = new GraphQLClient(SUBGRAPH_URL);

export interface AccountData {
  id: string;
  spent: string; // ETH spent on mining
  earned: string; // WETH earned from mining
  mined: string; // DONUTS earned from mining
}

export interface AccountResponse {
  account: AccountData | null;
}

export const GET_ACCOUNT_QUERY = `
  query GetAccount($id: ID!) {
    account(id: $id) {
      id
      spent
      earned
      mined
    }
  }
`;
