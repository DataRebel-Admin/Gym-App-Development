"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Herbruikbare wrapper rond de browser Fullscreen API. Werkt cross-browser
 * (standaard + `webkit`-prefix voor oudere Safari) en houdt de status
 * gesynchroniseerd via het `fullscreenchange`-event — dus ook wanneer de
 * gebruiker fullscreen op een andere manier verlaat (Esc, browser-UI).
 *
 * `isFullscreen` is alléén `true` als juist *dit* element fullscreen is, zodat
 * meerdere fullscreen-knoppen op één pagina onafhankelijk hun status tonen.
 * Alle acties vangen fouten netjes af en geven `false` terug bij weigering.
 */
export type UseFullscreen = {
  /** Of het meegegeven element op dit moment fullscreen is. */
  isFullscreen: boolean;
  /** Of de browser de Fullscreen API voor elementen ondersteunt. */
  isSupported: boolean;
  /** Zet het element fullscreen. Geeft `false` bij weigering/fout. */
  enter: () => Promise<boolean>;
  /** Verlaat fullscreen. Geeft `false` bij fout. */
  exit: () => Promise<boolean>;
  /** Wisselt tussen aan/uit. Geeft `false` bij weigering/fout. */
  toggle: () => Promise<boolean>;
};

// Vendor-geprefixte varianten (oudere Safari) bovenop de standaard-API.
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function currentFullscreenElement(): Element | null {
  const doc = document as FsDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function useFullscreen(
  ref: RefObject<HTMLElement | null> | null
): UseFullscreen {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const doc = document as FsDocument;
    const supported =
      Boolean(document.fullscreenEnabled) ||
      typeof doc.webkitExitFullscreen === "function";
    setIsSupported(supported);

    const sync = () => {
      const el = ref?.current ?? null;
      setIsFullscreen(el != null && currentFullscreenElement() === el);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [ref]);

  const enter = useCallback(async (): Promise<boolean> => {
    const el = ref?.current as FsElement | null;
    if (!el) return false;
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (!request) return false;
    try {
      await request.call(el);
      return true;
    } catch {
      // Geweigerd (bv. zonder gebruikersgebaar) of niet toegestaan — stil falen.
      return false;
    }
  }, [ref]);

  const exit = useCallback(async (): Promise<boolean> => {
    const doc = document as FsDocument;
    if (currentFullscreenElement() == null) return true;
    const close = document.exitFullscreen ?? doc.webkitExitFullscreen;
    if (!close) return false;
    try {
      await close.call(document);
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggle = useCallback(
    () => (isFullscreen ? exit() : enter()),
    [isFullscreen, enter, exit]
  );

  return { isFullscreen, isSupported, enter, exit, toggle };
}
