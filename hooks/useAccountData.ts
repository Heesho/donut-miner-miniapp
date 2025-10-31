import { useQuery } from "@tanstack/react-query";
import {
  subgraphClient,
  GET_ACCOUNT_QUERY,
  type AccountResponse,
  type AccountData,
} from "@/lib/subgraph";

export function useAccountData(address: string | undefined) {
  return useQuery<AccountData | null>({
    queryKey: ["account-data", address?.toLowerCase()],
    queryFn: async () => {
      if (!address) return null;

      try {
        const response = await subgraphClient.request<AccountResponse>(
          GET_ACCOUNT_QUERY,
          {
            id: address.toLowerCase(),
          },
        );

        console.log("Subgraph response:", response);
        return response.account;
      } catch (error) {
        console.error("Error fetching subgraph data:", error);
        return null;
      }
    },
    enabled: !!address,
    staleTime: 10_000, // Cache for 10 seconds
    retry: 1,
  });
}
