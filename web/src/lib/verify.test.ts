import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage, zeroAddress, type Address } from "viem";
import { encodeEntry, entryMessage } from "./entry";
import { PassCheck } from "./types";
import { verifyEntry, type VerifyDeps } from "./verify";

const contract = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;
const holder = privateKeyToAccount(generatePrivateKey());
const thief = privateKeyToAccount(generatePrivateKey());
const NOW = 1_800_000_000;

/** Fake chain: token 41 belongs to event 3 and is held by `holder`. */
function deps(onChain: number = PassCheck.Valid, owner: Address = holder.address): VerifyDeps {
  return {
    chainId: 968,
    contract,
    readVerifyPass: async (eventId, tokenId) => {
      if (tokenId !== 41n) return [PassCheck.PassNotFound, zeroAddress] as const;
      if (eventId !== 3n) return [PassCheck.WrongEvent, owner] as const;
      return [onChain, owner] as const;
    },
    verifySignature: (address, message, signature) => verifyMessage({ address, message, signature }),
  };
}

async function signedQr(signer = holder, issuedAt = NOW, tokenId = 41n, eventId = 3n) {
  const signature = await signer.signMessage({
    message: entryMessage({ chainId: 968, contract, eventId, tokenId, issuedAt }),
  });
  return encodeEntry({ chainId: 968, eventId, tokenId, issuedAt, signature });
}

describe("verifyEntry — PRD §23 threat model", () => {
  it("admits a valid pass with a fresh holder signature", async () => {
    const v = await verifyEntry(await signedQr(), 3n, NOW + 30, deps());
    expect(v.kind === "checked" && v.admissible && v.signature).toBe("verified");
  });

  it("copied QR: a signature by someone other than the current holder is rejected", async () => {
    const v = await verifyEntry(await signedQr(thief), 3n, NOW, deps());
    expect(v.kind === "checked" && v.signature).toBe("invalid");
    expect(v.kind === "checked" && v.admissible).toBe(false);
  });

  it("copied QR: a stale screenshot expires", async () => {
    const v = await verifyEntry(await signedQr(), 3n, NOW + 3600, deps());
    expect(v.kind === "checked" && v.signature).toBe("expired");
    expect(v.kind === "checked" && v.admissible).toBe(false);
  });

  it("copied QR after transfer: the old holder's signature no longer matches", async () => {
    const v = await verifyEntry(await signedQr(holder), 3n, NOW, deps(PassCheck.Valid, thief.address));
    expect(v.kind === "checked" && v.signature).toBe("invalid");
  });

  it("replay: an already-used pass is never admissible", async () => {
    const v = await verifyEntry(await signedQr(), 3n, NOW, deps(PassCheck.AlreadyCheckedIn));
    expect(v.kind === "checked" && v.admissible).toBe(false);
    expect(v.kind === "checked" && v.reason).toBe("Already checked in");
  });

  it("fake pass: a token the chain doesn't know is rejected", async () => {
    const v = await verifyEntry("partis:1:968:3:999", 3n, NOW, deps());
    expect(v.kind === "checked" && v.check).toBe(PassCheck.PassNotFound);
  });

  it("wrong event: chain verdict is for the selected event, not the QR's claim", async () => {
    const v = await verifyEntry(await signedQr(), 7n, NOW, deps());
    expect(v.kind === "checked" && v.check).toBe(PassCheck.WrongEvent);
    expect(v.kind === "checked" && v.admissible).toBe(false);
  });

  it("wrong event: a QR claiming another event is rejected even if the token is valid here", async () => {
    const v = await verifyEntry("partis:1:968:9:41", 3n, NOW, deps());
    expect(v.kind === "checked" && v.check).toBe(PassCheck.WrongEvent);
  });

  it("rejects other networks and junk", async () => {
    expect((await verifyEntry("partis:1:677:3:41", 3n, NOW, deps())).kind).toBe("malformed");
    expect((await verifyEntry("hello", 3n, NOW, deps())).kind).toBe("malformed");
  });

  it("manual pass ID entry is checked on-chain and flagged unsigned", async () => {
    const v = await verifyEntry("41", 3n, NOW, deps());
    expect(v.kind === "checked" && v.signature).toBe("missing");
    expect(v.kind === "checked" && v.admissible).toBe(true);
  });
});
