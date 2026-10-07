import type { Address, Hex } from "viem";
import { entryMessage, parseEntry, signatureFreshness, type EntryPayload } from "./entry";
import { PassCheck, passCheckLabel } from "./types";

export type SignatureState = "verified" | "missing" | "expired" | "invalid";

export type Verdict =
  | { kind: "malformed"; error: string }
  | {
      kind: "checked";
      payload: EntryPayload;
      /** Result of PartisEventPass.verifyPass for the event being admitted to. */
      check: number;
      reason: string;
      holder: Address | null;
      signature: SignatureState;
      /** The pass may be checked in: chain says Valid and the holder signature (if any) holds. */
      admissible: boolean;
    };

export interface VerifyDeps {
  chainId: number;
  contract: Address;
  /** Reads verifyPass(eventId, tokenId) from current chain state. */
  readVerifyPass: (eventId: bigint, tokenId: bigint) => Promise<readonly [number, Address]>;
  /** Verifies a personal_sign signature (EOA or ERC-1271 smart wallet). */
  verifySignature: (address: Address, message: string, signature: Hex) => Promise<boolean>;
}

/**
 * Door verification (PRD §12). Combines:
 *  1. the authoritative on-chain verdict for the *selected* event (fake pass, wrong event,
 *     replay, window), and
 *  2. the optional holder signature from the QR (copied-QR mitigation).
 * A bare pass ID ("41") is accepted for manual entry and treated as unsigned.
 */
export async function verifyEntry(
  raw: string,
  selectedEventId: bigint,
  now: number,
  deps: VerifyDeps,
): Promise<Verdict> {
  const trimmed = raw.trim();
  let payload: EntryPayload;
  if (/^\d{1,30}$/.test(trimmed)) {
    payload = { chainId: deps.chainId, eventId: selectedEventId, tokenId: BigInt(trimmed) };
  } else {
    const parsed = parseEntry(trimmed);
    if (!parsed.ok) return { kind: "malformed", error: parsed.error };
    payload = parsed.payload;
  }

  if (payload.chainId !== deps.chainId) {
    return { kind: "malformed", error: "This pass is for a different network." };
  }

  // Always ask the chain about the event being admitted to, never the event the QR claims.
  const [check, holderRaw] = await deps.readVerifyPass(selectedEventId, payload.tokenId);
  let result = check;
  // A QR that claims another event is rejected even if its token id happens to exist here.
  if (payload.eventId !== selectedEventId && result === PassCheck.Valid) result = PassCheck.WrongEvent;
  const holder = holderRaw === "0x0000000000000000000000000000000000000000" ? null : holderRaw;

  let signature: SignatureState = "missing";
  if (payload.signature && payload.issuedAt !== undefined) {
    const fresh = signatureFreshness(payload.issuedAt, now);
    if (fresh !== "fresh") {
      signature = "expired";
    } else if (!holder) {
      signature = "invalid";
    } else {
      const message = entryMessage({
        chainId: payload.chainId,
        contract: deps.contract,
        eventId: payload.eventId,
        tokenId: payload.tokenId,
        issuedAt: payload.issuedAt,
      });
      signature = (await deps.verifySignature(holder, message, payload.signature)) ? "verified" : "invalid";
    }
  }

  return {
    kind: "checked",
    payload,
    check: result,
    reason: passCheckLabel[result] ?? "Unknown result",
    holder,
    signature,
    // An invalid or expired signature is a red flag (copied/stale QR) and blocks admission;
    // a missing one is allowed only after explicit staff confirmation in the UI.
    admissible: result === PassCheck.Valid && (signature === "verified" || signature === "missing"),
  };
}
