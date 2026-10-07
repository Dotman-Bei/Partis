import { formatEther, type Address } from "viem";

export function shortAddress(address: Address | string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** "Free" for zero, otherwise a trimmed BOT amount ("2.5 BOT"). */
export function formatPrice(wei: bigint): string {
  return wei === 0n ? "Free" : `${formatBot(wei)} BOT`;
}

export function formatBot(wei: bigint): string {
  const [whole, frac = ""] = formatEther(wei).split(".");
  const trimmed = frac.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const fullFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const toDate = (unix: bigint | number) => new Date(Number(unix) * 1000);

export const formatDate = (unix: bigint | number) => dateFmt.format(toDate(unix));
export const formatTime = (unix: bigint | number) => timeFmt.format(toDate(unix));
export const formatDateTime = (unix: bigint | number) => fullFmt.format(toDate(unix));

/** "3d 4h", "2h 15m", "4m 12s". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export const nowSeconds = () => Math.floor(Date.now() / 1000);
