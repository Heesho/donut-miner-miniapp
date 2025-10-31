import { useQuery } from "@tanstack/react-query";

export interface AccountData {
  id: string;
  spent: string;
  earned: string;
  mined: string;
}

export function useAccountData(address: string | undefined) {
  return useQuery<AccountData | null>({
    queryKey: ["account-data", address?.toLowerCase()],
    queryFn: async () => {
      if (!address) return null;

      try {
        const response = await fetch(
          `/api/subgraph/account?address=${encodeURIComponent(address)}`,
        );

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data;
      } catch (error) {
        return null;
      }
    },
    enabled: !!address,
    staleTime: 10_000, // Cache for 10 seconds
    retry: 1,
  });
}
