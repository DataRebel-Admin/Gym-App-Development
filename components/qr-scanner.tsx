"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Html5Qrcode } from "html5-qrcode";

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
  const [error, setError] = useState<string | null>(null);

  // Houd de nieuwste vertaal-functie in een ref zodat het effect niet
  // opnieuw hoeft te draaien (en de camera niet onnodig herstart).
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let handled = false; // een QR is gedecodeerd → we navigeren weg
    let running = false; // camerastream is nu actief
    let starting = false; // start() is bezig (async)
    let disposed = false; // component is ontkoppeld

    const isVisible = () =>
      typeof document !== "undefined" && document.visibilityState === "visible";

    const onDecoded = (decoded: string) => {
      if (handled) return;
      handled = true;
      const token = extractToken(decoded);
      void stop().finally(() => router.push(`/m/${token}`));
    };

    async function ensureScanner(): Promise<Html5Qrcode | null> {
      if (scanner) return scanner;
      const { Html5Qrcode } = await import("html5-qrcode");
      if (disposed) return null;
      scanner = new Html5Qrcode(READER_ID);
      return scanner;
    }

    // Start de camera — alléén wanneer de pagina echt zichtbaar is.
    async function start() {
      if (disposed || handled || running || starting) return;
      if (!isVisible()) return;
      starting = true;
      try {
        const s = await ensureScanner();
        if (!s || disposed || handled || !isVisible()) return;
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          onDecoded,
          () => {}
        );
        running = true;
        setError(null);
        // Zichtbaarheid kan tijdens de async start zijn omgeslagen: als de
        // pagina intussen verborgen is (of ontkoppeld), meteen weer vrijgeven.
        if (disposed || !isVisible()) void stop();
      } catch {
        if (!disposed) setError(tRef.current("cameraError"));
      } finally {
        starting = false;
      }
    }

    // Stop de camera en geef het toestel fysiek vrij (indicator uit).
    async function stop() {
      if (!scanner || !running) return;
      running = false;
      try {
        await scanner.stop();
      } catch {
        // negeren — kan al gestopt zijn
      }
    }

    const onVisibilityChange = () => {
      if (isVisible()) void start();
      else void stop();
    };

    // pagehide dekt bfcache / app-suspend waar visibilitychange soms uitblijft.
    const onPageHide = () => void stop();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    void start();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      void stop();
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
