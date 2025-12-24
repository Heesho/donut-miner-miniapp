import { useCallback, useState, useEffect, useRef } from "react";
import {
  useCallsStatus,
} from "wagmi/experimental";
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useAccount,
  useConfig,
} from "wagmi";
import { getConnectorClient } from "@wagmi/core";
import type { Address } from "viem";
import { encodeFunctionData, numberToHex } from "viem";
import { base } from "wagmi/chains";

const DEFAULT_CHAIN_ID = base.id;

export type Call = {
  to: Address;
  data?: `0x${string}`;
  value?: bigint;
};

type BatchedTransactionState = "idle" | "pending" | "confirming" | "success" | "error";

type UseBatchedTransactionReturn = {
  execute: (calls: Call[]) => Promise<void>;
  state: BatchedTransactionState;
  error: Error | null;
  reset: () => void;
  reportsCapability: boolean;
};

/**
 * Hook for executing batched transactions using EIP-5792 when available,
 * with fallback to sequential transactions.
 * Uses provider.request directly to ensure proper atomic batch parameters.
 */
export function useBatchedTransaction(): UseBatchedTransactionReturn {
  const [state, setState] = useState<BatchedTransactionState>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [pendingCalls, setPendingCalls] = useState<Call[] | null>(null);
  const [currentCallIndex, setCurrentCallIndex] = useState(0);
  const [batchId, setBatchId] = useState<string | null>(null);

  const { address } = useAccount();
  const config = useConfig();

  const { data: callsStatus } = useCallsStatus({
    id: batchId ?? "",
    query: {
      enabled: !!batchId,
      refetchInterval: (query) =>
        query.state.data?.status === "success" || query.state.data?.status === "failure" ? false : 1000,
    },
  });

  // Sequential fallback
  const {
    sendTransaction,
    data: seqTxHash,
    isPending: isSeqPending,
    error: seqError,
    reset: resetSeq,
  } = useSendTransaction();

  const { isLoading: isSeqConfirming, isSuccess: isSeqSuccess, isError: isSeqTxError } =
    useWaitForTransactionReceipt({
      hash: seqTxHash,
      chainId: DEFAULT_CHAIN_ID,
    });

  // Track batch pending state
  const [isBatchPending, setIsBatchPending] = useState(false);

  // Always report capability as true since we'll try batch first
  const reportsCapability = true;

  // Track if we're in sequential mode
  const isSequentialMode = useRef(false);
  const lastProcessedIndex = useRef(-1);

  // Handle batch status changes
  useEffect(() => {
    if (!batchId) return;

    if (callsStatus?.status === "success") {
      setState("success");
      setPendingCalls(null);
      setBatchId(null);
    } else if (callsStatus?.status === "failure") {
      // Batch failed on-chain, fall back to sequential
      if (pendingCalls && pendingCalls.length > 0) {
        isSequentialMode.current = true;
        const firstCall = pendingCalls[0];
        setCurrentCallIndex(0);
        lastProcessedIndex.current = -1;
        setBatchId(null);
        sendTransaction({
          to: firstCall.to,
          data: firstCall.data,
          value: firstCall.value ?? 0n,
          chainId: DEFAULT_CHAIN_ID,
        });
      } else {
        setError(new Error("Batch transaction failed"));
        setState("error");
        setBatchId(null);
      }
    }
  }, [batchId, callsStatus, pendingCalls, sendTransaction]);

  // Handle sequential transaction completion
  useEffect(() => {
    if (!isSequentialMode.current || !pendingCalls) return;

    console.log("[BatchTx] Sequential mode check - isSeqSuccess:", isSeqSuccess, "currentCallIndex:", currentCallIndex, "lastProcessedIndex:", lastProcessedIndex.current);

    if (isSeqSuccess && currentCallIndex !== lastProcessedIndex.current) {
      lastProcessedIndex.current = currentCallIndex;
      const nextIndex = currentCallIndex + 1;

      if (nextIndex >= pendingCalls.length) {
        // All calls completed
        console.log("[BatchTx] All sequential calls completed!");
        setState("success");
        setPendingCalls(null);
        isSequentialMode.current = false;
      } else {
        // Execute next call
        console.log("[BatchTx] Executing next call:", nextIndex);
        setCurrentCallIndex(nextIndex);
        const nextCall = pendingCalls[nextIndex];
        resetSeq();

        setTimeout(() => {
          sendTransaction({
            to: nextCall.to,
            data: nextCall.data,
            value: nextCall.value ?? 0n,
            chainId: DEFAULT_CHAIN_ID,
          });
        }, 100);
      }
    }
  }, [isSeqSuccess, currentCallIndex, pendingCalls, sendTransaction, resetSeq]);

  // Handle sequential errors
  useEffect(() => {
    if (seqError || isSeqTxError) {
      console.error("[BatchTx] Sequential error:", seqError, "isSeqTxError:", isSeqTxError);
      setError(seqError || new Error("Transaction failed"));
      setState("error");
      setPendingCalls(null);
      isSequentialMode.current = false;
    }
  }, [seqError, isSeqTxError]);

  // Update state based on pending status
  useEffect(() => {
    if (isBatchPending || isSeqPending) {
      setState("pending");
    } else if (isSeqConfirming) {
      setState("confirming");
    }
  }, [isBatchPending, isSeqPending, isSeqConfirming]);

  const execute = useCallback(
    async (calls: Call[]) => {
      if (calls.length === 0 || !address) return;

      setError(null);
      setState("pending");
      setPendingCalls(calls);
      setCurrentCallIndex(0);
      lastProcessedIndex.current = -1;
      isSequentialMode.current = false;
      setIsBatchPending(true);

      try {
        // Get the wallet client/provider
        console.log("[BatchTx] Getting connector client...");
        const client = await getConnectorClient(config);
        console.log("[BatchTx] Got client:", client);

        const batchParams = {
          version: "2.0.0",
          from: address,
          chainId: numberToHex(DEFAULT_CHAIN_ID),
          atomicRequired: true,
          calls: calls.map((call) => ({
            to: call.to,
            data: call.data ?? "0x",
            value: call.value ? numberToHex(call.value) : undefined,
          })),
        };
        console.log("[BatchTx] Sending wallet_sendCalls with params:", JSON.stringify(batchParams, null, 2));

        // Use wallet_sendCalls directly with proper EIP-5792 parameters
        // This matches the Base Account SDK docs exactly
        const result = await client.request({
          method: "wallet_sendCalls",
          params: [batchParams],
        } as any);

        console.log("[BatchTx] wallet_sendCalls result:", result);
        setIsBatchPending(false);

        // Result should be the batch ID for tracking
        if (typeof result === "string") {
          setBatchId(result);
        } else if (result && typeof result === "object" && "id" in result) {
          setBatchId((result as { id: string }).id);
        }
      } catch (err: any) {
        console.error("[BatchTx] Error:", err);
        console.error("[BatchTx] Error message:", err?.message);
        setIsBatchPending(false);

        // Always fall back to sequential for any error
        // This ensures we try individual transactions if batching fails for any reason
        if (calls.length > 0) {
          console.log("[BatchTx] Falling back to sequential, sending first call...");
          isSequentialMode.current = true;
          const firstCall = calls[0];
          sendTransaction({
            to: firstCall.to,
            data: firstCall.data,
            value: firstCall.value ?? 0n,
            chainId: DEFAULT_CHAIN_ID,
          });
        } else {
          console.log("[BatchTx] No calls to fallback to, setting error state");
          setError(err);
          setState("error");
          setPendingCalls(null);
        }
      }
    },
    [address, config, sendTransaction]
  );

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setPendingCalls(null);
    setCurrentCallIndex(0);
    lastProcessedIndex.current = -1;
    isSequentialMode.current = false;
    setBatchId(null);
    setIsBatchPending(false);
    resetSeq();
  }, [resetSeq]);

  return {
    execute,
    state,
    error,
    reset,
    reportsCapability,
  };
}

/**
 * Helper to encode an ERC20 approve call
 */
export function encodeApproveCall(
  tokenAddress: Address,
  spender: Address,
  amount: bigint
): Call {
  const data = encodeFunctionData({
    abi: [
      {
        name: "approve",
        type: "function",
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
      },
    ],
    functionName: "approve",
    args: [spender, amount],
  });

  return {
    to: tokenAddress,
    data,
    value: 0n,
  };
}

/**
 * Helper to encode a contract call
 */
export function encodeContractCall(
  contractAddress: Address,
  abi: readonly unknown[],
  functionName: string,
  args: unknown[],
  value?: bigint
): Call {
  const data = encodeFunctionData({
    abi: abi as any,
    functionName,
    args,
  });

  return {
    to: contractAddress,
    data,
    value: value ?? 0n,
  };
}
