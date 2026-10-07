"use client";

import type { ReactNode } from "react";
import type { Badge as BadgeData } from "@/lib/status";
import { isDeployed } from "@/hooks/usePartis";
import { targetChain } from "@/lib/config";

export function Badge({ badge }: { badge: BadgeData }) {
  return <span className={`badge ${badge.tone}`}>{badge.label}</span>;
}

export function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tile">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

export function Empty({ title, children, action }: { title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {title && <strong>{title}</strong>}
      {children}
      {action && <div>{action}</div>}
    </div>
  );
}

export function SupplyBar({ minted, max }: { minted: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(100, (minted / max) * 100);
  return (
    <div
      className="bar"
      role="progressbar"
      aria-label="Passes issued"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={minted}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

/** Rendered in place of chain-backed content when this build has no contract address. */
export function NotDeployedGate({ children }: { children: ReactNode }) {
  if (isDeployed) return <>{children}</>;
  return (
    <Empty title={`Partis is not deployed on ${targetChain.name} yet.`}>
      Set <span className="mono">NEXT_PUBLIC_PARTIS_ADDRESS</span> to a PartisEventPass deployment to load
      live data.
    </Empty>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Empty
      title="Couldn't reach BOT Chain."
      action={
        <button type="button" className="btn ghost" onClick={onRetry}>
          Try again
        </button>
      }
    >
      The RPC request failed. Check your connection and try again.
    </Empty>
  );
}
