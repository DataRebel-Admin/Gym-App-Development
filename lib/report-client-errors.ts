// Lichte client-side ringbuffer met de laatste opgevangen JS-errors, gevuld
// door `components/error/client-error-recorder.tsx` (window "error" +
// "unhandledrejection") en gelezen door `useReportContext()`. Module-level
// state — bewust simpel, overleeft alleen de huidige pagina-levensduur.
//
// Snapshot-stabiel: `getClientErrors()` geeft dezelfde array-referentie terug
// tot er een nieuwe error bijkomt (vereist voor useSyncExternalStore).
import type { ClientErrorEntry } from "@/lib/report-context";
import { MAX_CLIENT_ERRORS } from "@/lib/report-context";

let snapshot: ClientErrorEntry[] = [];

/** Voegt een error toe aan de ringbuffer (oudste valt eruit boven het maximum). */
export function pushClientError(entry: ClientErrorEntry): void {
  snapshot = [...snapshot, entry].slice(-MAX_CLIENT_ERRORS);
}

/** De laatste opgevangen client-errors (nieuwste achteraan). Stabiele referentie. */
export function getClientErrors(): ClientErrorEntry[] {
  return snapshot;
}
