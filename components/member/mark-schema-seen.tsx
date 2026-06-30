"use client";

import { useEffect, useRef } from "react";
import { markActiveSchemaSeen } from "@/app/member/schema/actions";

/**
 * Markeert het actieve schema als "gezien" zodra het lid de schema-pagina opent
 * — waarmee de "Nieuw"-indicator verdwijnt. Rendert niets. Draait één keer.
 */
export function MarkSchemaSeen() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markActiveSchemaSeen();
  }, []);
  return null;
}
