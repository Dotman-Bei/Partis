"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useConnection } from "wagmi";
import { isAddressEqual, parseEventLogs } from "viem";
import { partisAbi } from "@/lib/abi";
import { targetChain } from "@/lib/config";
import { formatDate, formatDateTime, formatDuration, formatPrice, formatTime } from "@/lib/format";
import { claimBlocker, eventBadge, eventNote, isCancelled, passBadge, passStatus } from "@/lib/status";
import type { PartisEvent, PassView } from "@/lib/types";
import { STATUS_TICK_MS, useEvent, useHasClaimed, useNow, useOwnedPasses } from "@/hooks/usePartis";
import { Ticker } from "@/components/Ticker";
import { usePartisTx } from "@/hooks/usePartisTx";
import { AddressLink } from "@/components/ExplorerLink";
import { Modal } from "@/components/Modal";
import { PassQrModal } from "@/components/PassQrModal";
import { Badge, Empty, LoadError, NotDeployedGate, SupplyBar, Tile } from "@/components/ui";
import { WalletButton } from "@/components/WalletButton";
import { useToast } from "@/components/Toast";

export function EventDetailRoute({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const id = /^\d{1,30}$/.test(eventId) ? BigInt(eventId) : null;
  return (
    <NotDeployedGate>
      {id === null || id === 0n ? <NotFound /> : <EventDetail id={id} />}
    </NotDeployedGate>
  );
}

function NotFound() {
  return (
    <Empty
      title="Event not found."
      action={
        <Link className="btn ghost" href="/events">
          Browse events
        </Link>
      }
    >
      There is no Partis event with that ID on {targetChain.name}.
    </Empty>
  );
}

function EventDetail({ id }: { id: bigint }) {
  const event = useEvent(id);
  const now = useNow(STATUS_TICK_MS);
  const toast = useToast();

  if (event.isPending) return <div className="skeleton" style={{ minHeight: 420 }} aria-busy="true" />;
  if (event.isError) {
    return /EventNotFound/.test(String(event.error)) ? <NotFound /> : <LoadError onRetry={() => event.refetch()} />;
  }
  const e = event.data;

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.show("Event link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <>
      <section className="hero">
        <div>
          <div className="row" style={{ marginBottom: 16 }}>
            <span className="card-id">Event #{e.id.toString()}</span>
            <Badge badge={eventBadge(e, now)} />
          </div>
          <h2 style={{ overflowWrap: "anywhere" }}>{e.name}</h2>
          {e.description && <p style={{ whiteSpace: "pre-wrap" }}>{e.description}</p>}
        </div>
        <div className="hero-actions">
          <button type="button" className="btn ghost" onClick={share}>
            Copy link
          </button>
        </div>
      </section>

      <div className="grid">
        <EventFacts e={e} now={now} />
        <div className="stack">
          <PassPanel e={e} now={now} />
          <OrganizerShortcut e={e} />
        </div>
      </div>
    </>
  );
}

function EventFacts({ e, now }: { e: PartisEvent; now: number }) {
  const start = Number(e.startTime);
  return (
    <article className="card">
      <div className="card-top">
        <span className="card-id">Details</span>
        <span className="timer">
          <Ticker>
            {(t) =>
              isCancelled(e)
                ? "Cancelled"
                : t < start
                  ? `Starts in ${formatDuration(start - t)}`
                  : t < Number(e.endTime)
                    ? "Happening now"
                    : "Ended"
            }
          </Ticker>
        </span>
      </div>
      <div className="meta">
        <Tile label="Date">{formatDate(e.startTime)}</Tile>
        <Tile label="Time">
          {formatTime(e.startTime)}–{formatTime(e.endTime)}
        </Tile>
        <Tile label="Price">{formatPrice(e.price)}</Tile>
        <Tile label="Venue">{e.venue}</Tile>
        <Tile label="Pass">{e.passName}</Tile>
        <Tile label="Limit">{e.onePerWallet ? "1 per wallet" : "No limit"}</Tile>
      </div>
      <div className="spread" style={{ marginBottom: 8 }}>
        <span className="micro">Passes issued</span>
        <span className="micro" style={{ color: "var(--text)" }}>
          {e.minted} / {e.maxSupply}
        </span>
      </div>
      <SupplyBar minted={e.minted} max={e.maxSupply} />
      <div className="meta two">
        <Tile label="Check-in opens">{formatDateTime(e.checkInStart)}</Tile>
        <Tile label="Check-in closes">{formatDateTime(e.checkInEnd)}</Tile>
      </div>
      <div className="divider-row">
        <span className="note">
          Organizer <AddressLink address={e.organizer} />
        </span>
        <span className="note">{eventNote(e, now)}</span>
      </div>
    </article>
  );
}

function PassPanel({ e, now }: { e: PartisEvent; now: number }) {
  const { address } = useConnection();
  const owned = useOwnedPasses(address);
  const claimed = useHasClaimed(e.id, address);
  const tx = usePartisTx();
  const [confirming, setConfirming] = useState(false);
  const [qrPass, setQrPass] = useState<PassView | null>(null);

  if (!address) {
    return (
      <article className="card">
        <div className="card-top">
          <span className="card-id">Your pass</span>
        </div>
        <p className="card-sub" style={{ marginBottom: 16 }}>
          Connect your wallet to {e.price === 0n ? "claim" : "buy"} a pass. It will be issued to that wallet.
        </p>
        <WalletButton />
      </article>
    );
  }

  const mine = (owned.data ?? []).filter((p) => p.pass.eventId === e.id).map((p) => p.pass);
  const blocker = claimBlocker(e, now);
  const walletLimit = e.onePerWallet && claimed.data === true;
  const canClaim = !blocker && !walletLimit;
  const verb = e.price === 0n ? "Claim free pass" : `Buy pass · ${formatPrice(e.price)}`;

  async function claim() {
    const receipt = await tx.send({
      functionName: "claim",
      args: [e.id],
      value: e.price,
      success: "Pass issued to your wallet.",
    });
    setConfirming(false);
    if (receipt) {
      const [issued] = parseEventLogs({ abi: partisAbi, eventName: "PassIssued", logs: receipt.logs });
      if (issued) {
        setQrPass({
          tokenId: issued.args.tokenId,
          eventId: e.id,
          owner: address!,
          issuedAt: BigInt(Math.floor(Date.now() / 1000)),
          checkedInAt: 0n,
          checkedInBy: "0x0000000000000000000000000000000000000000",
          pricePaid: e.price,
        });
      }
    }
  }

  async function refund(pass: PassView) {
    await tx.send({
      functionName: "refund",
      args: [pass.tokenId],
      success: pass.pricePaid > 0n ? `Refunded ${formatPrice(pass.pricePaid)}.` : "Pass returned.",
    });
  }

  return (
    <article className="card">
      <div className="card-top">
        <span className="card-id">Your pass</span>
        {owned.isFetching && <span className="timer">Checking chain…</span>}
      </div>

      {mine.length > 0 && (
        <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
          {mine.map((p) => {
            const status = passStatus(p, e, now);
            return (
              <div key={p.tokenId.toString()} className="tile spread">
                <div>
                  <strong style={{ fontSize: 16 }}>Pass #{p.tokenId.toString()}</strong>
                  <span style={{ marginTop: 6 }}>
                    <Badge badge={passBadge[status]} />
                  </span>
                </div>
                {isCancelled(e) ? (
                  <button
                    type="button"
                    className="btn tint-yellow small"
                    onClick={() => refund(p)}
                    disabled={tx.pending !== null}
                  >
                    {p.pricePaid > 0n ? `Refund ${formatPrice(p.pricePaid)}` : "Return pass"}
                  </button>
                ) : status === "Active" ? (
                  <button type="button" className="btn primary small" onClick={() => setQrPass(p)}>
                    Show QR
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {mine.length === 0 && (
        <p className="card-sub" style={{ marginBottom: 16 }}>
          {walletLimit
            ? "This wallet already claimed its pass for this event."
            : blocker ?? `${e.maxSupply - e.minted} of ${e.maxSupply} passes left.`}
        </p>
      )}

      {canClaim && (mine.length === 0 || !e.onePerWallet) && (
        <button
          type="button"
          className="btn primary block"
          onClick={() => setConfirming(true)}
          disabled={tx.pending !== null || claimed.isPending}
        >
          {verb}
        </button>
      )}

      <div className="divider-row">
        <span className="note">Ownership is recorded on {targetChain.name}.</span>
        <Link className="link" href="/passes" style={{ fontSize: 12 }}>
          My passes →
        </Link>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        busy={tx.pending !== null}
        title={e.price === 0n ? "Claim pass" : "Buy pass"}
        description="Review and confirm in your wallet. The contract checks supply, price and the sales window."
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => setConfirming(false)} disabled={tx.pending !== null}>
              Cancel
            </button>
            <button type="button" className="btn primary" onClick={claim} disabled={tx.pending !== null}>
              {tx.pending ? "Confirming…" : verb}
            </button>
          </>
        }
      >
        <div className="meta two">
          <Tile label="Event">{e.name}</Tile>
          <Tile label="Pass">{e.passName}</Tile>
          <Tile label="You pay">{e.price === 0n ? "0 BOT + gas" : `${formatPrice(e.price)} + gas`}</Tile>
          <Tile label="Network">{targetChain.name}</Tile>
        </div>
        {e.price > 0n && (
          <p className="note">
            Payment is held by the contract until the event ends. If the organizer cancels, you can refund it in full.
          </p>
        )}
      </Modal>

      {qrPass && <PassQrModal open onClose={() => setQrPass(null)} pass={qrPass} event={e} />}
    </article>
  );
}

function OrganizerShortcut({ e }: { e: PartisEvent }) {
  const { address } = useConnection();
  if (!address || !isAddressEqual(address, e.organizer)) return null;
  return (
    <article className="card">
      <div className="card-top">
        <span className="card-id">You organize this event</span>
      </div>
      <div className="row">
        <Link className="btn primary" href={`/check-in?event=${e.id}`}>
          Open check-in
        </Link>
        <Link className="btn ghost" href="/organizer">
          Manage
        </Link>
      </div>
    </article>
  );
}
