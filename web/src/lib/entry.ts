import type { Address, Hex } from "viem";

/**
 * Entry QR protocol.
 *
 * The QR carries only identifiers (PRD §11): chain, event id, pass id. It is never proof of
 * ownership by itself — the scanner always reads current contract state.
 *
 * To mitigate copied QRs (PRD §23 threat 1), the attendee's wallet can sign a short-lived
 * entry message. The scanner checks that the signature recovers to the pass's *current
 * on-chain owner* and is recent, so a screenshot of someone else's QR fails once it expires
 * and can never be produced for a pass the presenter does not control. Whatever happens, the
 * on-chain single-use rule means a pass can be admitted at most once.
 *
 * Format:  partis:1:<chainId>:<eventId>:<tokenId>[:<issuedAt>:<signature>]
 */

export const ENTRY_TTL_SECONDS = 600;
const PREFIX = "partis";
const VERSION = "1";

export interface EntryPayload {
  chainId: number;
  eventId: bigint;
  tokenId: bigint;
  issuedAt?: number;
  signature?: Hex;
}

export function entryMessage(p: {
  chainId: number;
  contract: Address;
  eventId: bigint;
  tokenId: bigint;
  issuedAt: number;
}): string {
  return [
    "Partis entry pass",
    `Event: ${p.eventId}`,
    `Pass: ${p.tokenId}`,
    `Chain: ${p.chainId}`,
    `Contract: ${p.contract}`,
    `Issued at: ${p.issuedAt}`,
    "",
    "Signing proves you hold this pass. It does not send a transaction or cost gas.",
  ].join("\n");
}

export function encodeEntry(p: EntryPayload): string {
  const parts = [PREFIX, VERSION, p.chainId, p.eventId, p.tokenId];
  if (p.signature && p.issuedAt !== undefined) parts.push(p.issuedAt, p.signature);
  return parts.join(":");
}

const uint = /^\d{1,30}$/;

export type ParseResult = { ok: true; payload: EntryPayload } | { ok: false; error: string };

/** Parses a scanned QR. Rejects anything that is not exactly a Partis entry payload. */
export function parseEntry(raw: string): ParseResult {
  const parts = raw.trim().split(":");
  if (parts[0] !== PREFIX) return { ok: false, error: "Not a Partis pass QR." };
  if (parts[1] !== VERSION) return { ok: false, error: "Unsupported pass QR version." };
  if (parts.length !== 5 && parts.length !== 7) return { ok: false, error: "Malformed pass QR." };
  const [, , chainId, eventId, tokenId, issuedAt, signature] = parts;
  if (![chainId, eventId, tokenId].every((v) => uint.test(v))) return { ok: false, error: "Malformed pass QR." };

  const payload: EntryPayload = {
    chainId: Number(chainId),
    eventId: BigInt(eventId),
    tokenId: BigInt(tokenId),
  };
  if (parts.length === 7) {
    if (!uint.test(issuedAt) || !/^0x[0-9a-fA-F]{130,}$/.test(signature)) {
      return { ok: false, error: "Malformed pass signature." };
    }
    payload.issuedAt = Number(issuedAt);
    payload.signature = signature as Hex;
  }
  return { ok: true, payload };
}

export type Freshness = "fresh" | "expired" | "future";

export function signatureFreshness(issuedAt: number, now: number): Freshness {
  if (issuedAt > now + 60) return "future"; // allow small clock skew
  return now - issuedAt <= ENTRY_TTL_SECONDS ? "fresh" : "expired";
}
