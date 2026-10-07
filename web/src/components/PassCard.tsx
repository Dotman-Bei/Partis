"use client";

import Link from "next/link";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { passBadge, passStatus } from "@/lib/status";
import type { PartisEvent, PassView } from "@/lib/types";
import { Badge, Tile } from "./ui";

/** Pass card: same anatomy as the event card, keyed on the pass (PRD §15 fields). */
export function PassCard({
  pass,
  event: e,
  now,
  onShowQr,
}: {
  pass: PassView;
  event: PartisEvent;
  now: number;
  onShowQr: () => void;
}) {
  const status = passStatus(pass, e, now);
  return (
    <article className="card">
      <div className="card-top">
        <span className="card-id">
          Pass #{pass.tokenId.toString()} · Event #{e.id.toString()}
        </span>
        <Badge badge={passBadge[status]} />
      </div>
      <h4 className="card-title">
        <Link href={`/events/${e.id}`}>{e.name}</Link>
      </h4>
      <p className="card-sub">{e.passName}</p>

      <div className="meta">
        <Tile label="Date">
          {formatDate(e.startTime)} · {formatTime(e.startTime)}
        </Tile>
        <Tile label="Venue">{e.venue}</Tile>
        <Tile label="Check-in">{pass.checkedInAt > 0n ? formatDateTime(pass.checkedInAt) : "Not yet"}</Tile>
      </div>

      <div className="divider-row">
        <span className="note">
          {status === "Active" && "Present this pass's QR at the entrance."}
          {status === "Checked In" && "Attendance recorded on-chain."}
          {status === "Event Ended" && "This event has ended."}
          {status === "Invalid" && "Event cancelled. Open the event to refund."}
        </span>
        {status === "Active" ? (
          <button type="button" className="btn primary small" onClick={onShowQr}>
            Show QR
          </button>
        ) : (
          <Link className="btn ghost small" href={`/events/${e.id}`}>
            View event
          </Link>
        )}
      </div>
    </article>
  );
}
