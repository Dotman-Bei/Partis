"use client";

import { useState } from "react";
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { targetChain } from "@/lib/config";
import { explainError } from "@/lib/errors";
import { shortAddress } from "@/lib/format";
import { Modal } from "./Modal";
import { AddressLink } from "./ExplorerLink";
import { useToast } from "./Toast";

/** "Connect Wallet" → solid yellow short address once connected (§4, §6.2). */
export function WalletButton() {
  const { address, chainId, status } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  async function onConnect() {
    const connector = connectors[0];
    if (!connector || typeof window === "undefined" || !("ethereum" in window)) {
      toast.error("No wallet found. Install MetaMask or BO Wallet to continue.");
      return;
    }
    try {
      await connect.mutateAsync({ connector, chainId: targetChain.id });
      toast.show("Wallet connected.");
    } catch (error) {
      toast.error(explainError(error));
    }
  }

  async function onSwitch() {
    try {
      await switchChain.mutateAsync({ chainId: targetChain.id });
    } catch (error) {
      toast.error(explainError(error));
    }
  }

  if (!address) {
    return (
      <button
        type="button"
        className="btn wallet"
        onClick={onConnect}
        disabled={connect.isPending || status === "reconnecting"}
      >
        {connect.isPending ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  const wrongChain = chainId !== targetChain.id;

  return (
    <>
      {wrongChain ? (
        <button type="button" className="btn tint-red" onClick={onSwitch} disabled={switchChain.isPending}>
          Switch network
        </button>
      ) : (
        <button type="button" className="btn wallet connected" onClick={() => setOpen(true)}>
          {shortAddress(address)}
        </button>
      )}
      <Modal open={open} title="Wallet" onClose={() => setOpen(false)}>
        <div className="meta two">
          <div className="tile">
            <span>Address</span>
            <strong>
              <AddressLink address={address} />
            </strong>
          </div>
          <div className="tile">
            <span>Network</span>
            <strong>{targetChain.name}</strong>
          </div>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            disconnect.mutate({});
            setOpen(false);
          }}
        >
          Disconnect
        </button>
      </Modal>
    </>
  );
}
