"use client";

import { useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { EventCard } from "@/components/EventCard";
import { Empty, LoadError, NotDeployedGate, SkeletonGrid } from "@/components/ui";
import { STATUS_TICK_MS, useAllEvents, useNow, useOwnedPasses } from "@/hooks/usePartis";
import { claimBlocker, hasEnded, isCancelled } from "@/lib/status";
import type { PartisEvent } from "@/lib/types";

const FILTERS = ["Upcoming", "Available", "My passes", "Completed", "All"] as const;
type Filter = (typeof FILTERS)[number];

export default function EventsPage() {
  return (
    <>
      <section className="hero">
        <div>
          <h2>
            Find an event.
            <br />
            <span>Hold the pass.</span>
          </h2>
          <p>Every event here was created on BOT Chain. Pass supply, price and availability are read live.</p>
        </div>
      </section>
      <NotDeployedGate>
        <EventsList />
      </NotDeployedGate>
    </>
  );
}

function EventsList() {
  const [filter, setFilter] = useState<Filter>("Upcoming");
  const { address } = useConnection();
  const events = useAllEvents();
  const owned = useOwnedPasses(address);
  const now = useNow(STATUS_TICK_MS);

  const heldEventIds = useMemo(
    () => new Set((owned.data ?? []).map((p) => p.pass.eventId)),
    [owned.data],
  );

  const all = events.data ?? [];
  const visible = all.filter((e) => matches(e, filter, now, heldEventIds));
  if (filter === "Upcoming" || filter === "Available") {
    visible.sort((a, b) => Number(a.startTime - b.startTime));
  } else if (filter === "Completed") {
    visible.sort((a, b) => Number(b.endTime - a.endTime));
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h3>Events</h3>
          <p>
            {events.isPending
              ? "Reading events from BOT Chain…"
              : `${all.length} event${all.length === 1 ? "" : "s"} on-chain · showing ${visible.length}`}
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => events.refetch()}
            disabled={events.isFetching}
          >
            {events.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="filters" role="group" aria-label="Filter events">
        {FILTERS.map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {events.isPending ? (
        <SkeletonGrid />
      ) : events.isError ? (
        <LoadError onRetry={() => events.refetch()} />
      ) : filter === "My passes" && !address ? (
        <Empty title="Connect your wallet to see events you hold passes for." />
      ) : visible.length === 0 ? (
        <Empty title={emptyTitle(filter, all.length)}>
          {all.length === 0 && "Organizers can create one from the Organizer page."}
        </Empty>
      ) : (
        <div className="grid">
          {visible.map((e) => (
            <EventCard key={e.id.toString()} event={e} now={now} />
          ))}
        </div>
      )}
    </>
  );
}

function matches(e: PartisEvent, f: Filter, now: number, held: Set<bigint>): boolean {
  switch (f) {
    case "Upcoming":
      return !isCancelled(e) && !hasEnded(e, now);
    case "Available":
      return claimBlocker(e, now) === null;
    case "My passes":
      return held.has(e.id);
    case "Completed":
      return hasEnded(e, now) && !isCancelled(e);
    case "All":
      return true;
  }
}

function emptyTitle(f: Filter, total: number): string {
  if (total === 0) return "No events yet. Create the first one.";
  switch (f) {
    case "Upcoming":
      return "No upcoming events right now.";
    case "Available":
      return "No events have passes available right now.";
    case "My passes":
      return "You don't hold a pass for any event yet.";
    case "Completed":
      return "No completed events yet.";
    default:
      return "No events.";
  }
}
