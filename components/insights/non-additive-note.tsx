/**
 * Het verplichte "telt niet op"-label bij actieve-leden-cijfers naast
 * vestigingsrijen (zie lib/metrics/definitions.ts): zonder deze uitleg telt een
 * eigenaar de vestigingskolom zelf op en concludeert dat de cijfers niet
 * kloppen. Server-renderbaar; owner-area, bewust NL (precedent maintenance).
 */
export function NonAdditiveNote() {
  return (
    <p className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-neutral-600">
      <span className="font-semibold">Let op:</span> vestigingstotalen voor{" "}
      <span className="font-semibold">actieve leden</span> tellen niet op tot het
      organisatietotaal — een lid dat op meerdere vestigingen traint, telt per
      vestiging mee maar is één lid voor de organisatie. Bezoeken tellen wél
      zuiver op.
    </p>
  );
}
