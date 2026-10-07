"use client";

import { useState } from "react";
import { getAddress, isAddress, zeroAddress, type Address } from "viem";
import { useEventPasses, useStaff } from "@/hooks/usePartis";
import { usePartisTx } from "@/hooks/usePartisTx";
import { formatDateTime, formatPrice } from "@/lib/format";
import type { PartisEvent } from "@/lib/types";
import { AddressLink } from "./ExplorerLink";
import { Modal } from "./Modal";
import { Empty } from "./ui";

/** Grants or revokes check-in rights. Staff can only verify and check in (PRD §13). */
export function StaffModal({ event: e, open, onClose }: { event: PartisEvent; open: boolean; onClose: () => void }) {
  const staff = useStaff(e.id, open);
  const tx = usePartisTx();
  const [input, setInput] = useState("");
  const valid = isAddress(input.trim());

  async function setStaff(account: Address, authorized: boolean) {
    const ok = await tx.send({
      functionName: "setStaff",
      args: [e.id, account, authorized],
      success: authorized ? "Staff member added." : "Staff member removed.",
    });
    if (ok && authorized) setInput("");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={tx.pending !== null}
      title="Check-in staff"
      description="Staff wallets can verify passes and check attendees in for this event only. They cannot change, cancel or withdraw anything."
    >
      <div className="field">
        <label htmlFor="staff-address">Staff wallet address</label>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input
            id="staff-address"
            className="input mono"
            placeholder="0x…"
            value={input}
            onChange={(ev) => setInput(ev.target.value)}
          />
          <button
            type="button"
            className="btn primary"
            disabled={!valid || tx.pending !== null}
            onClick={() => setStaff(getAddress(input.trim()), true)}
          >
            Add
          </button>
        </div>
      </div>

      {staff.isPending ? (
        <p className="note">Loading staff…</p>
      ) : (staff.data ?? []).length === 0 ? (
        <p className="note">No staff yet. As the organizer you can always check people in yourself.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Wallet</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {staff.data!.map((a) => (
              <tr key={a}>
                <td>
                  <AddressLink address={a} label={a} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn tint-red small"
                    disabled={tx.pending !== null}
                    onClick={() => setStaff(a, false)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/** Issued passes with live owners and check-in state (first 100). */
export function PassesModal({ event: e, open, onClose }: { event: PartisEvent; open: boolean; onClose: () => void }) {
  const passes = useEventPasses(e.id, open);
  const rows = passes.data?.passes ?? [];
  return (
    <Modal open={open} onClose={onClose} wide title={`Issued passes · ${e.name}`}>
      {passes.isPending ? (
        <p className="note">Reading passes from BOT Chain…</p>
      ) : rows.length === 0 ? (
        <Empty title="No passes issued yet." />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Pass</th>
                  <th>Holder</th>
                  <th>Paid</th>
                  <th>Checked in</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.tokenId.toString()}>
                    <td>#{p.tokenId.toString()}</td>
                    <td>{p.owner === zeroAddress ? <span className="muted">Refunded</span> : <AddressLink address={p.owner} />}</td>
                    <td>{formatPrice(p.pricePaid)}</td>
                    <td>{p.checkedInAt > 0n ? formatDateTime(p.checkedInAt) : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {passes.data && passes.data.total > BigInt(rows.length) && (
            <p className="note">
              Showing the first {rows.length} of {passes.data.total.toString()} passes.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

export function CancelModal({ event: e, open, onClose }: { event: PartisEvent; open: boolean; onClose: () => void }) {
  const tx = usePartisTx();
  async function cancel() {
    if (await tx.send({ functionName: "cancelEvent", args: [e.id], success: "Event cancelled. Holders can now refund." })) {
      onClose();
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={tx.pending !== null}
      title="Cancel this event?"
      description="This cannot be undone. Pass sales and check-in stop, and every holder can refund exactly what they paid. Proceeds can no longer be withdrawn."
      actions={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={tx.pending !== null}>
            Keep event
          </button>
          <button type="button" className="btn tint-red" onClick={cancel} disabled={tx.pending !== null}>
            {tx.pending ? "Cancelling…" : "Cancel event"}
          </button>
        </>
      }
    >
      <p className="note">
        {e.minted} pass{e.minted === 1 ? "" : "es"} issued. Cancellation is only possible before anyone has checked in
        and before the event ends.
      </p>
    </Modal>
  );
}
