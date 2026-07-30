import type { FocusEvent, MouseEvent } from "react";

/**
 * Spreadbare handlers zodat een invoerveld z'n **huidige waarde selecteert** zodra
 * je erin klikt of tabt: het eerste teken dat je typt vervangt de oude waarde —
 * geen backspacen meer. Bedoeld voor velden met een voorgevulde waarde die je
 * overschrijft (sets/reps/gewicht in de schema-editors, de log-velden tijdens een
 * workout, metingen).
 *
 * Waarom óók `onMouseUp`: bij een muisklik vuurt `focus` (waar we selecteren)
 * vóór `mouseup`, en die mouseup laat de selectie standaard inklappen tot een
 * cursor. `preventDefault()` houdt de selectie heel — maar **alleen bij de klik
 * die de focus gaf** (de `data-select-all`-markering). Klik je daarna nóg eens in
 * hetzelfde veld, dan zet je gewoon de cursor neer en kun je bijschaven.
 *
 * `type="number"` ondersteunt geen `selectionStart`/`setSelectionRange`; `select()`
 * werkt er wél op — daarom die en geen range-API.
 */
export const selectOnFocus = {
  onFocus: (e: FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    el.dataset.selectAll = "1";
    el.select();
  },
  onMouseUp: (e: MouseEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (el.dataset.selectAll) {
      delete el.dataset.selectAll;
      e.preventDefault();
    }
  },
  onBlur: (e: FocusEvent<HTMLInputElement>) => {
    delete e.currentTarget.dataset.selectAll;
  },
} as const;
