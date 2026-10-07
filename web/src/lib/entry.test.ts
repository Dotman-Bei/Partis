import { describe, expect, it } from "vitest";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { verifyMessage } from "viem";
import { encodeEntry, entryMessage, parseEntry, signatureFreshness, ENTRY_TTL_SECONDS } from "./entry";

const contract = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

describe("entry QR", () => {
  it("round-trips an unsigned payload", () => {
    const raw = encodeEntry({ chainId: 968, eventId: 3n, tokenId: 41n });
    expect(raw).toBe("partis:1:968:3:41");
    const parsed = parseEntry(raw);
    expect(parsed).toEqual({ ok: true, payload: { chainId: 968, eventId: 3n, tokenId: 41n } });
  });

  it("round-trips a signed payload whose signature recovers to the holder", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const issuedAt = 1_800_000_000;
    const message = entryMessage({ chainId: 968, contract, eventId: 3n, tokenId: 41n, issuedAt });
    const signature = await account.signMessage({ message });

    const parsed = parseEntry(encodeEntry({ chainId: 968, eventId: 3n, tokenId: 41n, issuedAt, signature }));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.payload.signature).toBe(signature);

    const { eventId, tokenId } = parsed.payload;
    const rebuilt = entryMessage({ chainId: 968, contract, eventId, tokenId, issuedAt: parsed.payload.issuedAt! });
    expect(await verifyMessage({ address: account.address, message: rebuilt, signature })).toBe(true);
    // A signature for pass 41 must not validate pass 42.
    const other = entryMessage({ chainId: 968, contract, eventId: 3n, tokenId: 42n, issuedAt });
    expect(await verifyMessage({ address: account.address, message: other, signature })).toBe(false);
  });

  it("rejects foreign and malformed input", () => {
    expect(parseEntry("https://evil.example").ok).toBe(false);
    expect(parseEntry("partis:2:968:1:1").ok).toBe(false);
    expect(parseEntry("partis:1:968:1").ok).toBe(false);
    expect(parseEntry("partis:1:968:-1:1").ok).toBe(false);
    expect(parseEntry("partis:1:968:1:1:123:0xnothex").ok).toBe(false);
    expect(parseEntry("partis:1:968:1:1:abc:0x" + "a".repeat(130)).ok).toBe(false);
  });

  it("expires signatures after the TTL", () => {
    expect(signatureFreshness(1000, 1000 + ENTRY_TTL_SECONDS)).toBe("fresh");
    expect(signatureFreshness(1000, 1001 + ENTRY_TTL_SECONDS)).toBe("expired");
    expect(signatureFreshness(2000, 1000)).toBe("future");
  });
});
