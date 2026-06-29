"use client";

import { useState } from "react";
import QRCode from "qrcode";

/** Genereert client-side een QR-PNG van de gegeven URL en downloadt die. */
export function DownloadQrButton({
  url,
  filename,
}: {
  url: string;
  filename: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50"
    >
      {busy ? "Genereren…" : "Download QR-code"}
    </button>
  );
}
