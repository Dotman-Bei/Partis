"use client";

import Link from "next/link";
import { useAllEvents, useNow, useStats } from "@/hooks/usePartis";
import { hasEnded, isCancelled } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { targetChain } from "@/lib/config";
import { NotDeployedGate, SupplyBar, Tile } from "./ui";

/**
 * §6.1 "LIVE" panel. Unlike the reference landing (illustrative numbers), every figure here is
 * read from PartisEventPass — PRD §3.5: never fabricate metrics.
 */
export function LiveStats() {
  return (
    <NotDeployedGate>
      <LiveStatsInner />
    </NotDeployedGate>
  );
}

function LiveStatsInner() {
  const stats = useStats();
  const events = useAllEvents();
  const now = useNow(30_000);

  const upcoming = (events.data ?? [])
    .filter((e) => !isCancelled(e) && !hasEnded(e, now))
    .sort((a, b) => Number(a.startTime - b.startTime))
    .slice(0, 3);

  const s = stats.data;
  const loading = stats.isPending;

  return (
    <div className="grid">
      <div className="card">
        <div className="card-top">
          <span className="badge yellow">LIVE ON {targetChain.name.toUpperCase()}</span>
        </div>
        <div className="big-number">{loading ? "—" : s ? s.events.toString() : "—"}</div>
        <p className="card-sub">Events created on-chain</p>
        <div className="meta">
          <Tile label="Passes">{s ? s.passesIssued.toString() : "—"}</Tile>
          <Tile label="Check-ins">{s ? s.checkIns.toString() : "—"}</Tile>
          <Tile label="Organizers">{s ? s.organizers.toString() : "—"}</Tile>
        </div>
        <p className="note">
          Read live from the PartisEventPass contract{stats.isError ? " — RPC unavailable right now." : "."}
        </p>
      </div>

      <div className="card">
        <div className="card-top">
          <span className="card-id">Upcoming</span>
          <Link className="link" href="/events">
            All events →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="card-sub">
            {events.isPending ? "Loading events…" : "No upcoming events yet. Organizers can create the first one."}
          </p>
        ) : (
          <div className="stat-rows">
            {upcoming.map((e) => (
              <Link key={e.id.toString()} href={`/events/${e.id}`} className="stat-row">
                <div className="stat-row-top">
                  <span>
                    {e.name} <span className="muted">· {formatDate(e.startTime)}</span>
                  </span>
                  <span>
                    {e.minted}/{e.maxSupply}
                  </span>
                </div>
                <SupplyBar minted={e.minted} max={e.maxSupply} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
