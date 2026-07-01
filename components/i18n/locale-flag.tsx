import { cn } from "@/lib/cn";
import type { AppLocale } from "@/lib/i18n/config";

/**
 * Kleine vlag-chip per taal als **inline-SVG** — bewust géén emoji: op Windows
 * (en delen van Linux) rendert een regional-indicator-emoji als de láttercode
 * ("NL", "GB"), waardoor Frysk óók als "NL" verscheen. SVG's zien er op elk OS
 * identiek en premium uit.
 *
 * Frysk krijgt de **officiële Fryske vlag** (blauw/wit diagonale banen met rode
 * pompeblêden) — er bestaat geen Frysk-emoji. De `<svg>`-viewport clipt zelf de
 * overlopende vormen, dus geen `clipPath`/ids nodig (veilig in RSC, geen hooks).
 */
export function LocaleFlag({
  code,
  className,
}: {
  code: AppLocale;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-6 shrink-0 overflow-hidden rounded-[3px] shadow-inner ring-1 ring-black/10",
        className,
      )}
      aria-hidden
    >
      {code === "nl" ? <FlagNL /> : code === "en" ? <FlagEN /> : <FlagFY />}
    </span>
  );
}

/** Nederland — horizontale tricolor. */
function FlagNL() {
  return (
    <svg viewBox="0 0 90 60" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="90" height="20" fill="#AE1C28" />
      <rect y="20" width="90" height="20" fill="#ffffff" />
      <rect y="40" width="90" height="20" fill="#21468B" />
    </svg>
  );
}

/** Verenigd Koninkrijk — vereenvoudigde Union Jack (chip-formaat). */
function FlagEN() {
  return (
    <svg viewBox="0 0 90 60" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="90" height="60" fill="#012169" />
      {/* Diagonalen: wit (St. Andrew) onder, rood (St. Patrick) dunner erbovenop */}
      <path d="M0 0 L90 60 M90 0 L0 60" stroke="#ffffff" strokeWidth="12" />
      <path d="M0 0 L90 60 M90 0 L0 60" stroke="#C8102E" strokeWidth="6" />
      {/* Kruis: wit onder, rood erbovenop (St. George) */}
      <path d="M45 0 V60 M0 30 H90" stroke="#ffffff" strokeWidth="18" />
      <path d="M45 0 V60 M0 30 H90" stroke="#C8102E" strokeWidth="10" />
    </svg>
  );
}

/**
 * Fryslân — 7 diagonale banen (4 blauw, 3 wit) met rode pompeblêden. De banen
 * zijn horizontale stroken in een geroteerde groep; de SVG-viewport clipt de
 * overhang. Vereenvoudigd (leaves als kleine ruiten) maar direct herkenbaar.
 */
function FlagFY() {
  const blue = "#164FA3";
  const leaves = [
    { x: -18, y: 15 },
    { x: 6, y: 15 },
    { x: 30, y: 15 },
    { x: -6, y: 30 },
    { x: 18, y: 30 },
    { x: 6, y: 45 },
    { x: 30, y: 45 },
  ];
  return (
    <svg viewBox="0 0 90 60" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="90" height="60" fill={blue} />
      <g transform="rotate(-34 45 30)">
        {/* Witte stroken (2e, 4e, 6e baan) — blauw is de achtergrond ertussen */}
        <rect x="-40" y="6" width="170" height="12" fill="#ffffff" />
        <rect x="-40" y="30" width="170" height="12" fill="#ffffff" />
        <rect x="-40" y="54" width="170" height="12" fill="#ffffff" />
        {/* Pompeblêden (rode ruiten) op de witte stroken */}
        {leaves.map((l, i) => (
          <rect
            key={i}
            x={l.x + 41}
            y={l.y + 5}
            width="6"
            height="6"
            fill="#DA2032"
            transform={`rotate(45 ${l.x + 44} ${l.y + 8})`}
          />
        ))}
      </g>
    </svg>
  );
}
