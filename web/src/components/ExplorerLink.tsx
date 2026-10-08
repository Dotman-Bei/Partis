import type { Address, Hash } from "viem";
import { explorerUrl } from "@/lib/config";
import { shortAddress } from "@/lib/format";

/** Links to BOTScan so every on-chain claim in the UI can be checked independently. */
export function TxLink({ hash, label = "View transaction ↗" }: { hash: Hash; label?: string }) {
  if (!explorerUrl) return null;
  return (
    <a className="link" href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

export function AddressLink({ address, label }: { address: Address; label?: string }) {
  const text = label ?? shortAddress(address);
  if (!explorerUrl) {
    return (
      <span className="mono" title={address}>
        {text}
      </span>
    );
  }
  return (
    <a
      className="link mono"
      href={`${explorerUrl}/address/${address}`}
      target="_blank"
      rel="noreferrer"
      title={address}
    >
      {text}
    </a>
  );
}
