import { zeroAddress } from "viem";
import { EventStatus, type PartisEvent, type PassView } from "./types";

/** Pill hues from the style guide's tinted "fill + edge + text" triple, plus neutral. */
export type Tone = "yellow" | "red" | "blue" | "muted";

export interface Badge {
  label: string;
  tone: Tone;
}

type EventTimes = Pick<
  PartisEvent,
  "status" | "startTime" | "endTime" | "checkInStart" | "checkInEnd" | "minted" | "maxSupply" | "salesPaused"
>;

export const isCancelled = (e: Pick<PartisEvent, "status">) => e.status === EventStatus.Cancelled;
export const hasEnded = (e: Pick<PartisEvent, "endTime">, now: number) => now >= Number(e.endTime);
export const isSoldOut = (e: Pick<PartisEvent, "minted" | "maxSupply">) => e.minted >= e.maxSupply;
export const isCheckInOpen = (e: EventTimes, now: number) =>
  !isCancelled(e) && now >= Number(e.checkInStart) && now < Number(e.checkInEnd);

/** Mirrors the on-chain checks in `claim` so the UI never offers a transaction that must revert. */
export function claimBlocker(e: EventTimes, now: number): string | null {
  if (isCancelled(e)) return "This event was cancelled.";
  if (hasEnded(e, now)) return "This event has ended.";
  if (e.salesPaused) return "The organizer has paused pass sales.";
  if (isSoldOut(e)) return "All passes have been issued.";
  return null;
}

export function eventBadge(e: EventTimes, now: number): Badge {
  if (isCancelled(e)) return { label: "CANCELLED", tone: "red" };
  if (hasEnded(e, now)) return { label: "ENDED", tone: "blue" };
  if (isCheckInOpen(e, now)) return { label: "CHECK-IN OPEN", tone: "yellow" };
  if (isSoldOut(e)) return { label: "SOLD OUT", tone: "muted" };
  if (e.salesPaused) return { label: "SALES PAUSED", tone: "muted" };
  return { label: "ON SALE", tone: "yellow" };
}

/** Pass statuses from PRD §15. */
export type PassStatus = "Active" | "Checked In" | "Event Ended" | "Invalid";

export function passStatus(pass: Pick<PassView, "owner" | "checkedInAt">, e: EventTimes, now: number): PassStatus {
  if (pass.owner === zeroAddress || isCancelled(e)) return "Invalid";
  if (pass.checkedInAt > 0n) return "Checked In";
  if (hasEnded(e, now)) return "Event Ended";
  return "Active";
}

export const passBadge: Record<PassStatus, Badge> = {
  Active: { label: "ACTIVE", tone: "yellow" },
  "Checked In": { label: "CHECKED IN", tone: "blue" },
  "Event Ended": { label: "EVENT ENDED", tone: "muted" },
  Invalid: { label: "INVALID", tone: "red" },
};

/** One-line plain status note, in the style guide's voice ("Prediction is open."). */
export function eventNote(e: EventTimes, now: number): string {
  if (isCancelled(e)) return "Event cancelled. Paid passes can be refunded.";
  if (hasEnded(e, now)) return "Event ended.";
  if (isCheckInOpen(e, now)) return "Check-in is open.";
  if (isSoldOut(e)) return "Sold out.";
  if (e.salesPaused) return "Sales paused by organizer.";
  return "Passes available.";
}
