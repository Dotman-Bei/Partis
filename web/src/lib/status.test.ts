import { describe, expect, it } from "vitest";
import { zeroAddress } from "viem";
import { claimBlocker, eventBadge, passStatus } from "./status";

const base = {
  status: 0,
  startTime: 1000n,
  endTime: 2000n,
  checkInStart: 900n,
  checkInEnd: 2000n,
  minted: 1,
  maxSupply: 10,
  salesPaused: false,
};

describe("eventBadge", () => {
  it("walks the event lifecycle", () => {
    expect(eventBadge(base, 100).label).toBe("ON SALE");
    expect(eventBadge(base, 950).label).toBe("CHECK-IN OPEN");
    expect(eventBadge(base, 2000).label).toBe("ENDED");
    expect(eventBadge({ ...base, status: 1 }, 100).label).toBe("CANCELLED");
    expect(eventBadge({ ...base, minted: 10 }, 100).label).toBe("SOLD OUT");
    expect(eventBadge({ ...base, salesPaused: true }, 100).label).toBe("SALES PAUSED");
  });
});

describe("claimBlocker", () => {
  it("allows claims only when the contract would", () => {
    expect(claimBlocker(base, 100)).toBeNull();
    expect(claimBlocker(base, 1999)).toBeNull();
    expect(claimBlocker(base, 2000)).toMatch(/ended/);
    expect(claimBlocker({ ...base, minted: 10 }, 100)).toMatch(/issued/);
    expect(claimBlocker({ ...base, salesPaused: true }, 100)).toMatch(/paused/);
    expect(claimBlocker({ ...base, status: 1 }, 100)).toMatch(/cancelled/);
  });
});

describe("passStatus", () => {
  const owner = "0x0000000000000000000000000000000000000001" as const;
  it("maps chain state to PRD statuses", () => {
    expect(passStatus({ owner, checkedInAt: 0n }, base, 100)).toBe("Active");
    expect(passStatus({ owner, checkedInAt: 950n }, base, 960)).toBe("Checked In");
    expect(passStatus({ owner, checkedInAt: 950n }, base, 5000)).toBe("Checked In");
    expect(passStatus({ owner, checkedInAt: 0n }, base, 2000)).toBe("Event Ended");
    expect(passStatus({ owner, checkedInAt: 0n }, { ...base, status: 1 }, 100)).toBe("Invalid");
    expect(passStatus({ owner: zeroAddress, checkedInAt: 0n }, base, 100)).toBe("Invalid");
  });
});
