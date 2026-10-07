"use client";

import Link from "next/link";
import type { PartisEvent } from "@/lib/types";
import { eventBadge, eventNote, hasEnded, isCancelled } from "@/lib/status";
import { formatDate, formatDuration, formatPrice, formatTime } from "@/lib/format";
import { Badge, SupplyBar, Tile } from "./ui";

/** Countdown line under the meta tiles, like the market card's timer (§6.2). */
function timing(e: PartisEvent, now: number): string {
  const start = Number(e.startTime);
  const end = Number(e.endTime);
  if (isCancelled(e)) return "Cancelled by organizer";
  if (now < start) return `Starts in ${formatDuration(start - now)}`;
  if (now < end) return `Happening now · ends in ${formatDuration(end - now)}`;
  return `Ended ${formatDate(e.endTime)}`;
}

/**
 * Event card with the system's fixed anatomy: "EVENT #N" + status badge, 22px title,
 * three meta tiles, timer, then a divider row with the note and action.
 */
export function EventCard({ event: e, now, action }: { event: PartisEvent; now: number; action?: React.ReactNode }) {
  const remaining = e.maxSupply - e.minted;
  return (
    <article className="card">
      <div className="card-top">
        <span className="card-id">Event #{e.id.toString()}</span>
        <Badge badge={eventBadge(e, now)} />
      </div>
      <h4 className="card-title">
        <Link href={`/events/${e.id}`}>{e.name}</Link>
      </h4>
      <p className="card-sub">{e.venue}</p>

      <div className="meta">
        <Tile label="Date">
          {formatDate(e.startTime)} · {formatTime(e.startTime)}
        </Tile>
        <Tile label="Price">{formatPrice(e.price)}</Tile>
        <Tile label="Passes">
          {e.minted}/{e.maxSupply}
        </Tile>
      </div>
      <SupplyBar minted={e.minted} max={e.maxSupply} />
      <p className="timer" style={{ marginTop: 10 }}>
        {timing(e, now)}
      </p>

      <div className="divider-row">
        <span className="note">
          {eventNote(e, now)}
          {!isCancelled(e) && !hasEnded(e, now) && remaining > 0 && ` ${remaining} left.`}
        </span>
        {action ?? (
          <Link className="btn ghost small" href={`/events/${e.id}`}>
            View event
          </Link>
        )}
      </div>
    </article>
  );
}
