"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfig, useConnection, useSwitchChain, useWriteContract } from "wagmi";
import { simulateContract, waitForTransactionReceipt } from "wagmi/actions";
import type { ContractFunctionArgs, ContractFunctionName, TransactionReceipt } from "viem";
import { partisAbi } from "@/lib/abi";
import { partisAddress, targetChain } from "@/lib/config";
import { explainError } from "@/lib/errors";
import { useToast } from "@/components/Toast";
import { TxLink } from "@/components/ExplorerLink";

type WriteName = ContractFunctionName<typeof partisAbi, "nonpayable" | "payable">;

interface TxRequest<F extends WriteName> {
  functionName: F;
  args: ContractFunctionArgs<typeof partisAbi, "nonpayable" | "payable", F>;
  value?: bigint;
  /** Toast shown once the transaction is confirmed on-chain. */
  success: string;
}

/**
 * Sends a PartisEventPass transaction: switch to the target chain if needed → simulate (so a
 * revert is explained before the wallet opens) → sign → wait for the receipt → refresh reads.
 */
export function usePartisTx() {
  const config = useConfig();
  const { address, chainId } = useConnection();
  const switchChain = useSwitchChain();
  const write = useWriteContract();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  async function send<F extends WriteName>(req: TxRequest<F>): Promise<TransactionReceipt | null> {
    if (!partisAddress) {
      toast.error("Partis is not deployed on this network yet.");
      return null;
    }
    if (!address) {
      toast.error("Connect your wallet first.");
      return null;
    }
    setPending(req.functionName);
    try {
      if (chainId !== targetChain.id) await switchChain.mutateAsync({ chainId: targetChain.id });

      const { request } = await simulateContract(config, {
        address: partisAddress,
        abi: partisAbi,
        functionName: req.functionName,
        args: req.args,
        value: req.value,
        account: address,
        chainId: targetChain.id,
      } as Parameters<typeof simulateContract>[1]);

      const hash = await write.mutateAsync(request as Parameters<typeof write.mutateAsync>[0]);
      toast.show("Transaction submitted. Waiting for BOT Chain…");
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: targetChain.id });
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain.");

      await queryClient.invalidateQueries({ queryKey: ["partis"] });
      toast.show(
        <>
          {req.success} <TxLink hash={hash} />
        </>,
      );
      return receipt;
    } catch (error) {
      toast.error(explainError(error));
      return null;
    } finally {
      setPending(null);
    }
  }

  return { send, pending };
}
