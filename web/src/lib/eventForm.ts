import { parseEther } from "viem";

/** Limits mirrored from PartisEventPass so invalid input is caught before a transaction. */
export const LIMITS = {
  name: 80,
  description: 1000,
  venue: 120,
  passName: 40,
  supply: 100_000,
} as const;

export interface EventFormValues {
  name: string;
  venue: string;
  date: string; // yyyy-mm-dd (local)
  startTime: string; // hh:mm (local)
  endTime: string; // hh:mm (local); at or before start means the next day
  supply: string;
  passName: string;
  mode: "free" | "paid";
  price: string; // BOT, decimal
  onePerWallet: boolean;
  checkInLeadMinutes: string;
  description: string;
}

export interface EventConfigArgs {
  name: string;
  description: string;
  venue: string;
  passName: string;
  startTime: bigint;
  endTime: bigint;
  checkInStart: bigint;
  checkInEnd: bigint;
  maxSupply: number;
  price: bigint;
  onePerWallet: boolean;
}

export type BuildResult = { ok: true; config: EventConfigArgs; overnight: boolean } | { ok: false; error: string };

const bytes = (s: string) => new TextEncoder().encode(s).length;

function localUnix(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const ms = new Date(`${date}T${time}:00`).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/** Validates the sentence-builder form and converts it to the contract's EventConfig. */
export function buildEventConfig(v: EventFormValues, now: number): BuildResult {
  const name = v.name.trim();
  const venue = v.venue.trim();
  const passName = v.passName.trim();
  const description = v.description.trim();

  if (!name) return { ok: false, error: "Give the event a name." };
  if (bytes(name) > LIMITS.name) return { ok: false, error: `Event name must be at most ${LIMITS.name} bytes.` };
  if (!venue) return { ok: false, error: "Add a venue or location." };
  if (bytes(venue) > LIMITS.venue) return { ok: false, error: `Venue must be at most ${LIMITS.venue} bytes.` };
  if (!passName) return { ok: false, error: "Name the pass type." };
  if (bytes(passName) > LIMITS.passName) return { ok: false, error: `Pass name must be at most ${LIMITS.passName} bytes.` };
  if (bytes(description) > LIMITS.description) {
    return { ok: false, error: `Description must be at most ${LIMITS.description} bytes.` };
  }

  const start = localUnix(v.date, v.startTime);
  let end = localUnix(v.date, v.endTime);
  if (start === null || end === null) return { ok: false, error: "Pick a date, start time and end time." };
  const overnight = end <= start;
  if (overnight) end += 86_400;
  if (end <= now) return { ok: false, error: "The event must end in the future." };

  if (!/^\d+$/.test(v.supply)) return { ok: false, error: "Pass supply must be a whole number." };
  const supply = Number(v.supply);
  if (supply < 1 || supply > LIMITS.supply) {
    return { ok: false, error: `Pass supply must be between 1 and ${LIMITS.supply.toLocaleString()}.` };
  }

  let price = 0n;
  if (v.mode === "paid") {
    if (!/^\d+(\.\d{1,18})?$/.test(v.price.trim())) return { ok: false, error: "Enter a valid BOT price." };
    price = parseEther(v.price.trim());
    if (price === 0n) return { ok: false, error: "A paid pass needs a price above 0. Choose free instead." };
  }

  if (!/^\d+$/.test(v.checkInLeadMinutes)) return { ok: false, error: "Check-in lead time must be in whole minutes." };
  const lead = Number(v.checkInLeadMinutes);
  if (lead > 24 * 60) return { ok: false, error: "Check-in can open at most 24 hours before the start." };

  return {
    ok: true,
    overnight,
    config: {
      name,
      description,
      venue,
      passName,
      startTime: BigInt(start),
      endTime: BigInt(end),
      checkInStart: BigInt(start - lead * 60),
      checkInEnd: BigInt(end),
      maxSupply: supply,
      price,
      onePerWallet: v.onePerWallet,
    },
  };
}
