"use client";

import { useState } from "react";
import { useConnection, useSignMessage } from "wagmi";
import { isAddressEqual } from "viem";
import { partisAddress, targetChain } from "@/lib/config";
import { ENTRY_TTL_SECONDS, encodeEntry, entryMessage } from "@/lib/entry";
import { explainError } from "@/lib/errors";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { PartisEvent, PassView } from "@/lib/types";
import { useNow } from "@/hooks/usePartis";
import { Modal } from "./Modal";
import { Tile } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  pass: PassView;
  event: PartisEvent;
}

/**
 * Shows the entry QR for a pass. The QR holds only identifiers plus an optional holder
 * signature (see lib/entry.ts); it is rendered locally and nothing is sent anywhere.
 * Callers mount it only while it is shown, so its state resets on close.
 */
export function PassQrModal({ open, onClose, pass, event }: Props) {
  const { address } = useConnection();
  const sign = useSignMessage();
  const now = useNow(1000);
  const [qr, setQr] = useState<{ url: string; issuedAt?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHolder = !!address && isAddressEqual(address, pass.owner);

  async function render(text: string, issuedAt?: number) {
    // Loaded on demand: only people opening a pass QR need the encoder.
    const { default: QRCode } = await import("qrcode");
    const url = await QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 1, width: 640 });
    setQr({ url, issuedAt });
  }

  async function signAndShow() {
    if (!partisAddress) return;
    setError(null);
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const message = entryMessage({
        chainId: targetChain.id,
        contract: partisAddress,
        eventId: pass.eventId,
        tokenId: pass.tokenId,
        issuedAt,
      });
      const signature = await sign.mutateAsync({ message });
      await render(
        encodeEntry({ chainId: targetChain.id, eventId: pass.eventId, tokenId: pass.tokenId, issuedAt, signature }),
        issuedAt,
      );
    } catch (e) {
      setError(explainError(e));
    }
  }

  async function showIdOnly() {
    setError(null);
    await render(encodeEntry({ chainId: targetChain.id, eventId: pass.eventId, tokenId: pass.tokenId }));
  }

  // `now` ticks once a second and can trail the signing time; never show more than the TTL.
  const remaining =
    qr?.issuedAt !== undefined ? Math.min(ENTRY_TTL_SECONDS, qr.issuedAt + ENTRY_TTL_SECONDS - now) : null;
  const expired = remaining !== null && remaining <= 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pass #${pass.tokenId}`}
      description={`${event.name} · ${formatDateTime(event.startTime)}`}
    >
      {!qr ? (
        <>
          <p className="card-sub" style={{ marginTop: 0 }}>
            Sign a short-lived entry code with your wallet. It proves you hold this pass, costs nothing and sends no
            transaction. Door staff will verify it against BOT Chain.
          </p>
          {!isHolder && (
            <p className="note">Connect the wallet that holds this pass to sign an entry code.</p>
          )}
          <button
            type="button"
            className="btn primary"
            onClick={signAndShow}
            disabled={!isHolder || sign.isPending}
          >
            {sign.isPending ? "Waiting for signature…" : "Sign entry QR"}
          </button>
          <button type="button" className="btn ghost" onClick={showIdOnly}>
            Show ID-only QR
          </button>
          <p className="note">
            The ID-only QR works too, but staff will be warned that holder ownership was not proven.
          </p>
        </>
      ) : (
        <>
          <div className="qr-frame">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated locally */}
            <img
              src={qr.url}
              alt={`Entry QR for pass ${pass.tokenId}, event ${pass.eventId}`}
              style={{ opacity: expired ? 0.15 : 1 }}
            />
          </div>
          <div className="meta">
            <Tile label="Event">#{pass.eventId.toString()}</Tile>
            <Tile label="Pass">#{pass.tokenId.toString()}</Tile>
            <Tile label="Proof">
              {qr.issuedAt === undefined ? "ID only" : expired ? "Expired" : formatDuration(remaining!)}
            </Tile>
          </div>
          {(expired || qr.issuedAt === undefined) && (
            <button type="button" className="btn primary" onClick={signAndShow} disabled={!isHolder || sign.isPending}>
              {sign.isPending ? "Waiting for signature…" : expired ? "Refresh entry QR" : "Sign entry QR instead"}
            </button>
          )}
        </>
      )}
      {error && (
        <p className="note" role="alert" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
