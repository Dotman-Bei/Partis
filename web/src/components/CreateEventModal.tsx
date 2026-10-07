"use client";

import Link from "next/link";
import { useState } from "react";
import { parseEventLogs } from "viem";
import { partisAbi } from "@/lib/abi";
import { buildEventConfig, LIMITS, type EventFormValues } from "@/lib/eventForm";
import { formatDate, formatPrice, formatTime, nowSeconds } from "@/lib/format";
import { usePartisTx } from "@/hooks/usePartisTx";
import { Modal } from "./Modal";

/** Local yyyy-mm-dd one week from now. Called on open, never during render. */
function weekFromNow(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaults(): EventFormValues {
  return {
    name: "",
    venue: "",
    date: "",
    startTime: "18:00",
    endTime: "21:00",
    supply: "100",
    passName: "General Admission",
    mode: "free",
    price: "",
    onePerWallet: true,
    checkInLeadMinutes: "60",
    description: "",
  };
}

/**
 * Event creation as a sentence builder with a live preview (style guide §6.2, §11.8): the
 * form reads as the event it produces, so there is nothing to interpret.
 */
export function CreateEventModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setV] = useState<EventFormValues>(defaults);
  // The default date depends on the clock, so derive it only while open (never in prerender).
  const v = open && !form.date ? { ...form, date: weekFromNow() } : form;
  const [created, setCreated] = useState<bigint | null>(null);
  const [touched, setTouched] = useState(false);
  const tx = usePartisTx();

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setV({ ...v, [key]: value });

  const built = buildEventConfig(v, open ? nowSeconds() : 0);

  function close() {
    onClose();
    // Reset after closing so a reopened modal starts fresh.
    setTimeout(() => {
      setV(defaults());
      setCreated(null);
      setTouched(false);
    }, 0);
  }

  async function submit() {
    setTouched(true);
    if (!built.ok) return;
    const receipt = await tx.send({
      functionName: "createEvent",
      args: [built.config],
      success: "Event created on-chain.",
    });
    if (!receipt) return;
    const [log] = parseEventLogs({ abi: partisAbi, eventName: "EventCreated", logs: receipt.logs });
    setCreated(log?.args.eventId ?? null);
  }

  if (created !== null) {
    return (
      <Modal
        open={open}
        onClose={close}
        title="Event published"
        description="Your event has an on-chain ID and a public page attendees can open."
        actions={
          <>
            <button type="button" className="btn ghost" onClick={close}>
              Done
            </button>
            <Link className="btn primary" href={`/events/${created}`} onClick={close}>
              Open event page
            </Link>
          </>
        }
      >
        <div className="preview">
          <span className="micro">Event #{created.toString()}</span>
          <p>Share this page so attendees can claim passes:</p>
          <p className="mono">{typeof window !== "undefined" ? `${window.location.origin}/events/${created}` : ""}</p>
        </div>
      </Modal>
    );
  }

  const c = built.ok ? built.config : null;

  return (
    <Modal
      open={open}
      onClose={close}
      busy={tx.pending !== null}
      wide
      title="Create an event"
      description="Describe the event in one sentence. Times, supply and price are fixed on-chain once created. Partis charges no fee; you pay only gas."
      actions={
        <>
          <button type="button" className="btn ghost" onClick={close} disabled={tx.pending !== null}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={submit}
            disabled={tx.pending !== null || (touched && !built.ok)}
          >
            {tx.pending ? "Creating…" : "Create event"}
          </button>
        </>
      }
    >
      <div className="sentence">
        Host{" "}
        <input
          className="input w-lg"
          aria-label="Event name"
          placeholder="Event name"
          maxLength={LIMITS.name}
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
        />{" "}
        at{" "}
        <input
          className="input w-md"
          aria-label="Venue"
          placeholder="Venue"
          maxLength={LIMITS.venue}
          value={v.venue}
          onChange={(e) => set("venue", e.target.value)}
        />{" "}
        on{" "}
        <input
          className="input"
          type="date"
          aria-label="Date"
          value={v.date}
          onChange={(e) => set("date", e.target.value)}
        />{" "}
        from{" "}
        <input
          className="input"
          type="time"
          aria-label="Start time"
          value={v.startTime}
          onChange={(e) => set("startTime", e.target.value)}
        />{" "}
        to{" "}
        <input
          className="input"
          type="time"
          aria-label="End time"
          value={v.endTime}
          onChange={(e) => set("endTime", e.target.value)}
        />
        . Offer{" "}
        <input
          className="input w-xs"
          inputMode="numeric"
          aria-label="Pass supply"
          value={v.supply}
          onChange={(e) => set("supply", e.target.value.replace(/[^\d]/g, ""))}
        />{" "}
        <input
          className="input w-md"
          aria-label="Pass name"
          maxLength={LIMITS.passName}
          value={v.passName}
          onChange={(e) => set("passName", e.target.value)}
        />{" "}
        passes{" "}
        <select
          className="select"
          aria-label="Claim or purchase mode"
          value={v.mode}
          onChange={(e) => set("mode", e.target.value as EventFormValues["mode"])}
        >
          <option value="free">for free</option>
          <option value="paid">at a fixed price of</option>
        </select>
        {v.mode === "paid" && (
          <>
            {" "}
            <input
              className="input w-xs"
              inputMode="decimal"
              aria-label="Price in BOT"
              placeholder="2.5"
              value={v.price}
              onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))}
            />{" "}
            BOT
          </>
        )}
        ,{" "}
        <select
          className="select"
          aria-label="Passes per wallet"
          value={v.onePerWallet ? "one" : "many"}
          onChange={(e) => set("onePerWallet", e.target.value === "one")}
        >
          <option value="one">one per wallet</option>
          <option value="many">any number per wallet</option>
        </select>
        . Check-in opens{" "}
        <input
          className="input w-xs"
          inputMode="numeric"
          aria-label="Minutes before start that check-in opens"
          value={v.checkInLeadMinutes}
          onChange={(e) => set("checkInLeadMinutes", e.target.value.replace(/[^\d]/g, ""))}
        />{" "}
        minutes before the start.
      </div>

      <div className="field">
        <label htmlFor="event-description">Description (optional)</label>
        <textarea
          id="event-description"
          className="textarea"
          maxLength={LIMITS.description}
          placeholder="What attendees should know: agenda, who it's for, what to bring."
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="preview" aria-live="polite">
        <span className="micro">Event preview</span>
        {c ? (
          <p>
            <strong>{c.name}</strong> at {c.venue} on {formatDate(c.startTime)}, {formatTime(c.startTime)}–
            {formatTime(c.endTime)}
            {built.ok && built.overnight ? " (next day)" : ""}. {c.maxSupply.toLocaleString()} {c.passName} passes,{" "}
            {c.price === 0n ? "free" : formatPrice(c.price)}, {c.onePerWallet ? "one per wallet" : "no wallet limit"}.
            Check-in from {formatTime(c.checkInStart)} until the event ends.
          </p>
        ) : (
          <p style={{ color: touched ? "var(--red)" : undefined }}>{!built.ok && built.error}</p>
        )}
      </div>
    </Modal>
  );
}
