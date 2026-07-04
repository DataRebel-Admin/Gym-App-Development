"use client";

import { useEffect, useRef } from "react";
import { markAutoStopSeen } from "@/app/member/schema/actions";

/**
 * Markeert de "automatisch gestopt na 5 uur"-melding als gezien, zodat die maar
 * één keer verschijnt. Rendert niets. Draait één keer bij het openen.
 */
export function MarkAutoStopSeen() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markAutoStopSeen();
  }, []);
  return null;
}
