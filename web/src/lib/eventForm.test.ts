import { describe, expect, it } from "vitest";
import { buildEventConfig, type EventFormValues } from "./eventForm";

const base: EventFormValues = {
  name: "BOT Builders Meetup",
  venue: "Yaba, Lagos",
  date: "2030-03-14",
  startTime: "18:00",
  endTime: "22:00",
  supply: "100",
  passName: "General Admission",
  mode: "free",
  price: "",
  onePerWallet: true,
  checkInLeadMinutes: "60",
  description: "",
};
const now = Math.floor(new Date("2030-03-01T00:00:00").getTime() / 1000);

describe("buildEventConfig", () => {
  it("builds a free event matching the contract config", () => {
    const r = buildEventConfig(base, now);
    if (!r.ok) throw new Error(r.error);
    const start = Math.floor(new Date("2030-03-14T18:00:00").getTime() / 1000);
    expect(r.config.startTime).toBe(BigInt(start));
    expect(r.config.endTime).toBe(BigInt(start + 4 * 3600));
    expect(r.config.checkInStart).toBe(BigInt(start - 3600));
    expect(r.config.checkInEnd).toBe(r.config.endTime);
    expect(r.config.price).toBe(0n);
    expect(r.config.maxSupply).toBe(100);
    expect(r.overnight).toBe(false);
  });

  it("parses a fixed BOT price", () => {
    const r = buildEventConfig({ ...base, mode: "paid", price: "2.5" }, now);
    expect(r.ok && r.config.price).toBe(2_500_000_000_000_000_000n);
  });

  it("rolls an end time at or before the start into the next day", () => {
    const r = buildEventConfig({ ...base, startTime: "22:00", endTime: "02:00" }, now);
    if (!r.ok) throw new Error(r.error);
    expect(r.overnight).toBe(true);
    expect(Number(r.config.endTime - r.config.startTime)).toBe(4 * 3600);
  });

  it("rejects what the contract would reject", () => {
    expect(buildEventConfig({ ...base, name: " " }, now).ok).toBe(false);
    expect(buildEventConfig({ ...base, name: "x".repeat(81) }, now).ok).toBe(false);
    expect(buildEventConfig({ ...base, venue: "" }, now).ok).toBe(false);
    expect(buildEventConfig({ ...base, supply: "0" }, now).ok).toBe(false);
    expect(buildEventConfig({ ...base, supply: "100001" }, now).ok).toBe(false);
    expect(buildEventConfig({ ...base, supply: "1.5" }, now).ok).toBe(false);
    expect(buildEventConfig({ ...base, mode: "paid", price: "0" }, now).ok).toBe(false);
    expect(buildEventConfig({ ...base, mode: "paid", price: "abc" }, now).ok).toBe(false);
    expect(buildEventConfig({ ...base, date: "2020-01-01" }, now).ok).toBe(false);
    // Multi-byte characters count as bytes, like Solidity's bytes(string).length.
    expect(buildEventConfig({ ...base, passName: "é".repeat(21) }, now).ok).toBe(false);
  });
});
