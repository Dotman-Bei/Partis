"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection, usePublicClient } from "wagmi";
import { partisAbi } from "@/lib/abi";
import { partisAddress, targetChain } from "@/lib/config";
import { explainError } from "@/lib/errors";
import { formatDateTime, formatTime, nowSeconds, shortAddress } from "@/lib/format";
import { eventBadge, isCheckInOpen } from "@/lib/status";
import { verifyEntry, type Verdict } from "@/lib/verify";
import { PassCheck } from "@/lib/types";
import { useEvent, useIsOperator, useNow, useOrganizerEvents } from "@/hooks/usePartis";
import { usePartisTx } from "@/hooks/usePartisTx";
import { AddressLink } from "@/components/ExplorerLink";
import { QrScanner } from "@/components/QrScanner";
import { Badge, Empty, NotDeployedGate, Tile } from "@/components/ui";
import { WalletButton } from "@/components/WalletButton";

export function CheckIn() {
  return (
    <>
      <section className="hero">
        <div>
          <h2>
            Scan the pass.
            <br />
            <span>Trust the chain.</span>
          </h2>
          <p>
            Every scan is checked against current BOT Chain state. Only the organizer and authorized staff can check
            people in, and a used pass is rejected everywhere.
          </p>
        </div>
      </section>
      <NotDeployedGate>
        <CheckInDesk />
      </NotDeployedGate>
    </>
  );
}

function CheckInDesk() {
  const { address } = useConnection();
  const params = useSearchParams();
  const initial = params.get("event");
  const [eventInput, setEventInput] = useState(initial && /^\d+$/.test(initial) ? initial : "");
  const eventId = /^\d{1,30}$/.test(eventInput) && eventInput !== "0" ? BigInt(eventInput) : null;
  const myEvents = useOrganizerEvents(address);

  if (!address) {
    return <Empty title="Connect the organizer or staff wallet to open check-in." action={<WalletButton />} />;
  }

  return (
    <div className="stack">
      <article className="card">
        <div className="card-top">
          <span className="card-id">1 · Choose the event</span>
        </div>
        <div className="field-row">
          {(myEvents.data ?? []).length > 0 && (
            <div className="field">
              <label htmlFor="my-events">Your events</label>
              <select
                id="my-events"
                className="select"
                value={eventInput}
                onChange={(e) => setEventInput(e.target.value)}
              >
                <option value="">Select an event…</option>
                {myEvents.data!.map((e) => (
                  <option key={e.id.toString()} value={e.id.toString()}>
                    #{e.id.toString()} · {e.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="event-id">Event ID {myEvents.data?.length ? "(staff)" : ""}</label>
            <input
              id="event-id"
              className="input"
              inputMode="numeric"
              placeholder="e.g. 12"
              value={eventInput}
              onChange={(e) => setEventInput(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>
      </article>

      {eventId !== null && <Desk key={eventId.toString()} eventId={eventId} />}
    </div>
  );
}

interface LogEntry {
  tokenId: bigint;
  outcome: string;
  ok: boolean;
  at: number;
}

function Desk({ eventId }: { eventId: bigint }) {
  const { address } = useConnection();
  const client = usePublicClient({ chainId: targetChain.id });
  const event = useEvent(eventId);
  const operator = useIsOperator(eventId, address);
  const tx = usePartisTx();
  const now = useNow(1000);

  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState<bigint | null>(null);
  const [ackUnsigned, setAckUnsigned] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const busy = useRef(false);

  if (event.isPending) return <div className="skeleton" aria-busy="true" />;
  if (event.isError) return <Empty title={`Event #${eventId} was not found on ${targetChain.name}.`} />;
  const e = event.data;

  if (operator.data === false) {
    return (
      <Empty title="This wallet can't check people in for this event.">
        Only the organizer ({shortAddress(e.organizer)}) and staff they authorize can. Ask the organizer to add{" "}
        <span className="mono">{address && shortAddress(address)}</span> as staff.
      </Empty>
    );
  }

  async function inspect(raw: string) {
    if (busy.current || !client || !partisAddress) return;
    busy.current = true;
    setScanning(false);
    setChecking(true);
    setDone(null);
    setAckUnsigned(false);
    try {
      const v = await verifyEntry(raw, eventId, nowSeconds(), {
        chainId: targetChain.id,
        contract: partisAddress,
        readVerifyPass: (ev, tok) =>
          client.readContract({ address: partisAddress!, abi: partisAbi, functionName: "verifyPass", args: [ev, tok] }),
        verifySignature: (addr, message, signature) => client.verifyMessage({ address: addr, message, signature }),
      });
      setVerdict(v);
      if (v.kind === "checked" && !v.admissible) {
        setLog((l) => [{ tokenId: v.payload.tokenId, outcome: v.reason, ok: false, at: nowSeconds() }, ...l]);
      }
    } catch (err) {
      setVerdict({ kind: "malformed", error: explainError(err) });
    } finally {
      setChecking(false);
      busy.current = false;
    }
  }

  async function admit() {
    if (verdict?.kind !== "checked") return;
    const tokenId = verdict.payload.tokenId;
    const receipt = await tx.send({
      functionName: "checkIn",
      args: [eventId, tokenId],
      success: `Pass #${tokenId} checked in on-chain.`,
    });
    if (receipt) {
      setDone(tokenId);
      setLog((l) => [{ tokenId, outcome: "Checked in", ok: true, at: nowSeconds() }, ...l]);
    } else {
      // Re-read: someone else may have just checked this pass in.
      await inspect(String(tokenId));
    }
  }

  function next() {
    setVerdict(null);
    setDone(null);
    setManual("");
    setScanning(true);
  }

  const open = isCheckInOpen(e, now);

  return (
    <>
      <article className="card">
        <div className="card-top">
          <span className="card-id">Event #{e.id.toString()}</span>
          <Badge badge={eventBadge(e, now)} />
        </div>
        <h4 className="card-title">{e.name}</h4>
        <p className="card-sub">{e.venue}</p>
        <div className="meta">
          <Tile label="Checked in">
            {e.checkedIn} / {e.minted}
          </Tile>
          <Tile label="Window">
            {formatTime(e.checkInStart)}–{formatTime(e.checkInEnd)}
          </Tile>
          <Tile label="Your role">{operator.isPending ? "…" : address && e.organizer === address ? "Organizer" : "Staff"}</Tile>
        </div>
        {!open && (
          <p className="note">
            Check-in is {now < Number(e.checkInStart) ? `not open yet — it opens ${formatDateTime(e.checkInStart)}` : "closed"}.
            You can still scan to verify passes.
          </p>
        )}
      </article>

      <div className="grid">
        <article className="card">
          <div className="card-top">
            <span className="card-id">2 · Scan</span>
            <button type="button" className="btn ghost small" onClick={() => setScanning((s) => !s)}>
              {scanning ? "Stop camera" : "Start camera"}
            </button>
          </div>
          {scanning ? (
            <QrScanner active={scanning} onScan={inspect} />
          ) : (
            <p className="card-sub" style={{ marginBottom: 14 }}>
              Start the camera and point it at the attendee&apos;s entry QR, or type a pass ID below.
            </p>
          )}
          <form
            className="row"
            style={{ marginTop: 14, flexWrap: "nowrap" }}
            onSubmit={(ev) => {
              ev.preventDefault();
              if (manual.trim()) inspect(manual);
            }}
          >
            <label htmlFor="manual-pass" className="visually-hidden">
              Pass ID or QR text
            </label>
            <input
              id="manual-pass"
              className="input"
              placeholder="Pass ID or QR text"
              value={manual}
              onChange={(ev) => setManual(ev.target.value)}
            />
            <button type="submit" className="btn ghost" disabled={!manual.trim() || checking}>
              Verify
            </button>
          </form>
        </article>

        <article className="card" aria-live="polite">
          <div className="card-top">
            <span className="card-id">3 · Verify & check in</span>
          </div>
          {checking ? (
            <p className="card-sub">Reading BOT Chain…</p>
          ) : !verdict ? (
            <p className="card-sub">Scan a pass to see its live on-chain status.</p>
          ) : verdict.kind === "malformed" ? (
            <div className="result bad">
              <h4>Rejected</h4>
              <p className="card-sub">{verdict.error}</p>
              <button type="button" className="btn ghost" style={{ marginTop: 14 }} onClick={next}>
                Scan next
              </button>
            </div>
          ) : done !== null ? (
            <div className="result done">
              <h4>Checked in</h4>
              <p className="card-sub">Pass #{done.toString()} is now marked used on-chain. A second scan will be rejected.</p>
              <button type="button" className="btn primary" style={{ marginTop: 14 }} onClick={next}>
                Scan next
              </button>
            </div>
          ) : (
            <VerdictCard
              verdict={verdict}
              ackUnsigned={ackUnsigned}
              setAckUnsigned={setAckUnsigned}
              pending={tx.pending !== null}
              onAdmit={admit}
              onNext={next}
            />
          )}
        </article>
      </div>

      {log.length > 0 && (
        <article className="card">
          <div className="card-top">
            <span className="card-id">This session</span>
            <span className="timer">
              {log.filter((l) => l.ok).length} admitted · {log.filter((l) => !l.ok).length} rejected
            </span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Pass</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {log.slice(0, 20).map((l, i) => (
                <tr key={i}>
                  <td>{formatTime(l.at)}</td>
                  <td>#{l.tokenId.toString()}</td>
                  <td style={{ color: l.ok ? "var(--blue)" : "var(--red)" }}>{l.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}

      <p className="note">
        Need to add staff? <Link className="link" href="/organizer">Manage staff in Organizer →</Link>
      </p>
    </>
  );
}

function VerdictCard({
  verdict,
  ackUnsigned,
  setAckUnsigned,
  pending,
  onAdmit,
  onNext,
}: {
  verdict: Extract<Verdict, { kind: "checked" }>;
  ackUnsigned: boolean;
  setAckUnsigned: (v: boolean) => void;
  pending: boolean;
  onAdmit: () => void;
  onNext: () => void;
}) {
  const v = verdict;
  const chainOk = v.check === PassCheck.Valid;
  const needsAck = v.admissible && v.signature === "missing";
  const sigLine = {
    verified: "Holder signature verified — presented by the wallet that owns this pass",
    missing: "No holder signature — ownership by the presenter is not proven",
    expired: "Entry code expired — ask the attendee to refresh their QR",
    invalid: "Signature does not match the current holder — possible copied QR",
  }[v.signature];

  return (
    <div className={`result ${v.admissible ? "ok" : "bad"}`}>
      <span className="micro">Pass #{v.payload.tokenId.toString()}</span>
      <h4>{v.admissible ? "Valid pass" : "Do not admit"}</h4>
      <ul className="checks">
        <li className={chainOk ? "" : "fail"}>{chainOk ? "On-chain: valid for this event, not yet used" : `On-chain: ${v.reason}`}</li>
        {v.holder && (
          <li className={chainOk ? "" : "fail"}>
            Holder <AddressLink address={v.holder} />
          </li>
        )}
        <li className={v.signature === "verified" ? "" : v.signature === "missing" ? "warn" : "fail"}>{sigLine}</li>
      </ul>
      {needsAck && (
        <label className="check" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={ackUnsigned} onChange={(e) => setAckUnsigned(e.target.checked)} />I confirmed
          this attendee holds the pass another way (e.g. their wallet app shows it).
        </label>
      )}
      <div className="row" style={{ marginTop: 16 }}>
        {v.admissible && (
          <button type="button" className="btn primary" onClick={onAdmit} disabled={pending || (needsAck && !ackUnsigned)}>
            {pending ? "Checking in…" : "Confirm check-in"}
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onNext} disabled={pending}>
          {v.admissible ? "Cancel" : "Scan next"}
        </button>
      </div>
    </div>
  );
}
