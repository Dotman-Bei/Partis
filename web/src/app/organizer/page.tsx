"use client";

import Link from "next/link";
import { useState } from "react";
import { useConnection } from "wagmi";
import { CreateEventModal } from "@/components/CreateEventModal";
import { CancelModal, PassesModal, StaffModal } from "@/components/OrganizerModals";
import { Badge, Empty, LoadError, NotDeployedGate, SkeletonGrid, SupplyBar, Tile } from "@/components/ui";
import { WalletButton } from "@/components/WalletButton";
import { useNow, useOrganizerEvents } from "@/hooks/usePartis";
import { usePartisTx } from "@/hooks/usePartisTx";
import { formatBot, formatDate, formatPrice, formatTime } from "@/lib/format";
import { eventBadge, hasEnded, isCancelled } from "@/lib/status";
import type { PartisEvent } from "@/lib/types";

export default function OrganizerPage() {
  const { address } = useConnection();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <section className="hero">
        <div>
          <h2>
            Run the event.
            <br />
            <span>Verify the door.</span>
          </h2>
          <p>
            Create events, watch passes go out and check-ins come in, and hand the door to your staff. Everything
            here is read from and written to BOT Chain.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="btn primary" onClick={() => setCreating(true)} disabled={!address}>
            ＋ Create event
          </button>
        </div>
      </section>

      <NotDeployedGate>
        {address ? (
          <OrganizerEvents onCreate={() => setCreating(true)} />
        ) : (
          <Empty title="Connect your wallet to manage your events." action={<WalletButton />}>
            Events belong to the wallet that created them.
          </Empty>
        )}
      </NotDeployedGate>

      <CreateEventModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function OrganizerEvents({ onCreate }: { onCreate: () => void }) {
  const { address } = useConnection();
  const events = useOrganizerEvents(address);
  const now = useNow(5000);

  if (events.isPending) return <SkeletonGrid count={2} />;
  if (events.isError) return <LoadError onRetry={() => events.refetch()} />;

  const list = events.data;
  const totals = list.reduce(
    (t, e) => ({ issued: t.issued + e.minted, checkedIn: t.checkedIn + e.checkedIn }),
    { issued: 0, checkedIn: 0 },
  );

  return (
    <>
      <div className="toolbar">
        <div>
          <h3>Your events</h3>
          <p>
            {list.length} event{list.length === 1 ? "" : "s"} · {totals.issued} passes issued · {totals.checkedIn}{" "}
            checked in
          </p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn ghost" onClick={() => events.refetch()} disabled={events.isFetching}>
            {events.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      {list.length === 0 ? (
        <Empty
          title="No events yet. Create the first one."
          action={
            <button type="button" className="btn primary" onClick={onCreate}>
              ＋ Create event
            </button>
          }
        />
      ) : (
        <div className="grid">
          {list.map((e) => (
            <OrganizerEventCard key={e.id.toString()} event={e} now={now} />
          ))}
        </div>
      )}
    </>
  );
}

type Panel = "staff" | "passes" | "cancel" | null;

function OrganizerEventCard({ event: e, now }: { event: PartisEvent; now: number }) {
  const tx = usePartisTx();
  const [panel, setPanel] = useState<Panel>(null);
  const cancelled = isCancelled(e);
  const ended = hasEnded(e, now);
  const canCancel = !cancelled && !ended && e.checkedIn === 0;
  const canWithdraw = !cancelled && ended && e.proceeds > 0n;

  return (
    <article className="card">
      <div className="card-top">
        <span className="card-id">Event #{e.id.toString()}</span>
        <Badge badge={eventBadge(e, now)} />
      </div>
      <h4 className="card-title">
        <Link href={`/events/${e.id}`}>{e.name}</Link>
      </h4>
      <p className="card-sub">
        {formatDate(e.startTime)} · {formatTime(e.startTime)}–{formatTime(e.endTime)} · {e.venue}
      </p>

      <div className="meta four">
        <Tile label="Supply">{e.maxSupply}</Tile>
        <Tile label="Issued">{e.minted}</Tile>
        <Tile label="Remaining">{e.maxSupply - e.minted}</Tile>
        <Tile label="Checked in">{e.checkedIn}</Tile>
      </div>
      <SupplyBar minted={e.minted} max={e.maxSupply} />
      <p className="timer" style={{ marginTop: 10 }}>
        {formatPrice(e.price)} per pass
        {e.price > 0n && ` · ${formatBot(e.proceeds)} BOT held${ended ? "" : " until the event ends"}`}
        {e.refunded > 0 && ` · ${e.refunded} refunded`}
      </p>

      <div className="row" style={{ marginTop: 16 }}>
        {!cancelled && !ended && (
          <Link className="btn primary small" href={`/check-in?event=${e.id}`}>
            Open check-in
          </Link>
        )}
        <button type="button" className="btn ghost small" onClick={() => setPanel("passes")}>
          Passes
        </button>
        {!cancelled && (
          <button type="button" className="btn ghost small" onClick={() => setPanel("staff")}>
            Staff
          </button>
        )}
        {!cancelled && !ended && (
          <button
            type="button"
            className="btn ghost small"
            disabled={tx.pending !== null}
            onClick={() =>
              tx.send({
                functionName: "setSalesPaused",
                args: [e.id, !e.salesPaused],
                success: e.salesPaused ? "Sales resumed." : "Sales paused.",
              })
            }
          >
            {e.salesPaused ? "Resume sales" : "Pause sales"}
          </button>
        )}
        {canWithdraw && (
          <button
            type="button"
            className="btn tint-yellow small"
            disabled={tx.pending !== null}
            onClick={() =>
              tx.send({
                functionName: "withdrawProceeds",
                args: [e.id],
                success: `Withdrew ${formatBot(e.proceeds)} BOT.`,
              })
            }
          >
            Withdraw {formatBot(e.proceeds)} BOT
          </button>
        )}
        {canCancel && (
          <button type="button" className="btn tint-red small" onClick={() => setPanel("cancel")}>
            Cancel event
          </button>
        )}
      </div>

      <StaffModal event={e} open={panel === "staff"} onClose={() => setPanel(null)} />
      <PassesModal event={e} open={panel === "passes"} onClose={() => setPanel(null)} />
      <CancelModal event={e} open={panel === "cancel"} onClose={() => setPanel(null)} />
    </article>
  );
}
