"use client";

import { useEffect } from "react";

/**
 * Registreert één QR-scan zodra de publieke apparaatpagina in de browser laadt.
 * Client-beacon i.p.v. tellen tijdens render: link-preview-bots draaien geen JS
 * (tellen dus niet mee) en een sessionStorage-guard voorkomt refresh-dubbeltelling.
 * De huidige query (`?tenant=` in dev) blijft behouden zodat de tenant klopt.
 */
export function TrackScan({ qrToken }: { qrToken: string }) {
  useEffect(() => {
    const key = `scan:${qrToken}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode e.d. → geen guard, tel gewoon 1× per load.
    }
    const qs = typeof window !== "undefined" ? window.location.search : "";
    fetch(`/m/${encodeURIComponent(qrToken)}/scan${qs}`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [qrToken]);

  return null;
}
