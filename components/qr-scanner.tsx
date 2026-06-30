"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const READER_ID = "qr-reader";

/** Haal het qrToken uit een gescande waarde (volledige URL of kale token). */
function extractToken(text: string): string {
  try {
    const u = new URL(text);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? text;
  } catch {
    return text.trim();
  }
}

export function QrScanner() {
  const router = useRouter();
  const t = useTranslations("member.scan");
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let stop: (() => Promise<void>) | null = null;
    let cancelled = false;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(READER_ID);
      stop = () => scanner.stop().catch(() => {});
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decoded) => {
            if (cancelled) return;
            cancelled = true;
            const token = extractToken(decoded);
            scanner.stop().finally(() => router.push(`/m/${token}`));
          },
          () => {}
        );
      } catch {
        setError(t("cameraError"));
      }
    })();

    return () => {
      cancelled = true;
      if (stop) void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        id={READER_ID}
        className="w-full max-w-xs overflow-hidden rounded-2xl border border-neutral-200"
      />
      {error ? (
        <p className="text-center text-sm text-red-600">{error}</p>
      ) : (
        <p className="text-center text-sm text-neutral-500">
          {t("aim")}
        </p>
      )}
    </div>
  );
}
