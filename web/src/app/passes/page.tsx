"use client";

import Link from "next/link";
import { useState } from "react";
import { useConnection } from "wagmi";
import { AddressLink } from "@/components/ExplorerLink";
import { PassCard } from "@/components/PassCard";
import { PassQrModal } from "@/components/PassQrModal";
import { Empty, LoadError, NotDeployedGate, SkeletonGrid, Tile } from "@/components/ui";
import { WalletButton } from "@/components/WalletButton";
import { useNow, useOwnedPasses, type OwnedPass } from "@/hooks/usePartis";
import { formatDate } from "@/lib/format";
import { passStatus } from "@/lib/status";

export default function PassesPage() {
  return (
    <>
      <section className="hero">
        <div>
          <h2>
            Your passes.
            <br />
            <span>Your attendance.</span>
          </h2>
          <p>Passes held by your wallet, read from BOT Chain. Open one to show its entry QR at the door.</p>
        </div>
      </section>
      <NotDeployedGate>
        <Passes />
      </NotDeployedGate>
    </>
  );
}

function Passes() {
  const { address } = useConnection();
  const owned = useOwnedPasses(address);
  const now = useNow(1000);
  const [qr, setQr] = useState<OwnedPass | null>(null);

  if (!address) {
    return <Empty title="Connect your wallet to see your passes." action={<WalletButton />} />;
  }
  if (owned.isPending) return <SkeletonGrid count={2} />;
  if (owned.isError) return <LoadError onRetry={() => owned.refetch()} />;

  const all = owned.data;
  const withStatus = all.map((p) => ({ ...p, status: passStatus(p.pass, p.event, now) }));
  const active = withStatus.filter((p) => p.status === "Active");
  const previous = withStatus.filter((p) => p.status !== "Active");
  const checkedIn = withStatus.filter((p) => p.status === "Checked In");
  const recent = [...checkedIn].sort((a, b) => Number(b.pass.checkedInAt - a.pass.checkedInAt)).slice(0, 3);

  return (
    <div className="stack">
      {/* Profile — PRD §18: basic participation history, all derived from on-chain state. */}
      <article className="card">
        <div className="card-top">
          <span className="card-id">Profile</span>
          <AddressLink address={address} />
        </div>
        <div className="meta" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <Tile label="Total passes">{all.length}</Tile>
          <Tile label="Active">{active.length}</Tile>
          <Tile label="Checked in">{checkedIn.length}</Tile>
          <Tile label="Events attended">{new Set(checkedIn.map((p) => p.event.id)).size}</Tile>
        </div>
        <div className="divider-row">
          <span className="note">
            {recent.length === 0
              ? "No attended events yet."
              : `Recently attended: ${recent.map((p) => `${p.event.name} (${formatDate(p.event.startTime)})`).join(" · ")}`}
          </span>
          <button type="button" className="btn ghost small" onClick={() => owned.refetch()} disabled={owned.isFetching}>
            {owned.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </article>

      {all.length === 0 ? (
        <Empty
          title="No passes in this wallet yet."
          action={
            <Link className="btn primary" href="/events">
              Find an event
            </Link>
          }
        />
      ) : (
        <>
          <div className="toolbar" style={{ marginTop: 22, marginBottom: 0 }}>
            <div>
              <h3>Active</h3>
              <p>{active.length === 0 ? "No active passes." : "Ready to present at the entrance."}</p>
            </div>
          </div>
          {active.length > 0 && (
            <div className="grid">
              {active.map((p) => (
                <PassCard key={p.pass.tokenId.toString()} pass={p.pass} event={p.event} now={now} onShowQr={() => setQr(p)} />
              ))}
            </div>
          )}

          {previous.length > 0 && (
            <>
              <div className="toolbar" style={{ marginTop: 22, marginBottom: 0 }}>
                <div>
                  <h3>Previous</h3>
                  <p>Checked in, ended or cancelled.</p>
                </div>
              </div>
              <div className="grid">
                {previous.map((p) => (
                  <PassCard key={p.pass.tokenId.toString()} pass={p.pass} event={p.event} now={now} onShowQr={() => setQr(p)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {qr && <PassQrModal open onClose={() => setQr(null)} pass={qr.pass} event={qr.event} />}
    </div>
  );
}
