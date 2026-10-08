"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  active: boolean;
  onScan: (text: string) => void;
}

const SCAN_INTERVAL_MS = 150;

/** Rear-camera QR scanner. Frames are decoded locally with jsQR; nothing leaves the device. */
export function QrScanner({ active, onScan }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera. Enter the pass ID manually instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setError("Camera access was blocked. Allow it in your browser settings, or enter the pass ID manually.");
        return;
      }
      if (stopped || !video.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      // Loaded on demand: the decoder is only needed once the camera is running.
      const { default: jsQR } = await import("jsqr");
      if (stopped) return;

      timer = setInterval(() => {
        const v = video.current;
        if (!v || !ctx || v.readyState < v.HAVE_ENOUGH_DATA) return;
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
        if (code?.data) onScanRef.current(code.data);
      }, SCAN_INTERVAL_MS);
    }

    start();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return (
    <div>
      <div className="scanner">
        <video ref={video} muted playsInline aria-label="Camera preview for scanning pass QR codes" />
      </div>
      {error && (
        <p className="note" role="alert" style={{ marginTop: 10, textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}
