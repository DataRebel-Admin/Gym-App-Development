import {
  BRAND,
  MARK_BARS,
  MARK_MONOGRAM,
  MARK_MONOGRAM_X,
  MARK_VIEWBOX,
  WORDMARK_GYM,
  WORDMARK_REBEL,
  WORDMARK_VIEWBOX,
} from "./logo-art";

/**
 * Het GymRebel-logo als inline SVG (server-renderbaar, géén client-JS).
 *
 * Waarom inline en niet `<img src="/brand/…">`: het beeldmerk moet mee kunnen
 * kleuren met de context (wit op een accent-tegel, charcoal op licht, oranje op
 * donker). Een `<img>` erft geen `currentColor`. De statische bestanden in
 * `public/brand/` bestaan wél — voor plekken buiten React (manifest, e-mail,
 * tenant-`logoUrl`); beide komen uit dezelfde geometrie (`logo-art.ts`).
 *
 * WHITELABEL: dit is het **platform**merk. Gebruik het alleen waar GymRebel de
 * afzender is (superadmin-area, landing, offline/crash, PWA-iconen). Een
 * sportschool zonder eigen logo houdt haar initiaal-tegel.
 */

type MarkProps = {
  className?: string;
  /** Toegankelijke naam; weglaten = decoratief (`aria-hidden`). */
  title?: string;
};

/** Alleen het beeldmerk (halter + GR-monogram). Volgt `currentColor`. */
export function GymRebelMark({ className, title }: MarkProps) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      className={className}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {MARK_BARS.map((bar) => (
        <rect
          key={`${bar.x}-${bar.y}`}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          rx={bar.r}
          ry={bar.r}
        />
      ))}
      <g transform={`translate(${MARK_MONOGRAM_X},0)`}>
        <path fillRule="evenodd" d={MARK_MONOGRAM} />
      </g>
    </svg>
  );
}

type Tone = "brand" | "mono";

/**
 * Woordmerk "GYMREBEL".
 * - `brand` (default): "GYM" in `currentColor`, "REBEL" in Rebel Orange.
 * - `mono`: alles in `currentColor` — nodig zodra het logo óp het accent staat,
 *   want oranje-op-oranje verdwijnt.
 */
export function GymRebelWordmark({
  className,
  title,
  tone = "brand",
}: MarkProps & { tone?: Tone }) {
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" fillRule="evenodd" d={WORDMARK_GYM} />
      <path
        fill={tone === "mono" ? "currentColor" : BRAND.orange}
        fillRule="evenodd"
        d={WORDMARK_REBEL}
      />
    </svg>
  );
}

/**
 * Horizontale lockup: beeldmerk links, woordmerk rechts. Verhouding en
 * tussenruimte volgen het Brand Book (het beeldmerk staat royaal boven de
 * letterhoogte uit).
 */
export function GymRebelLogo({
  className,
  title = "GymRebel",
  tone = "brand",
}: MarkProps & { tone?: Tone }) {
  return (
    <svg viewBox="0 0 1859 236" className={className} role="img" aria-label={title}>
      <title>{title}</title>
      <g fill={tone === "mono" ? "currentColor" : BRAND.orange} transform="scale(0.6574)">
        {MARK_BARS.map((bar) => (
          <rect
            key={`${bar.x}-${bar.y}`}
            x={bar.x}
            y={bar.y}
            width={bar.w}
            height={bar.h}
            rx={bar.r}
            ry={bar.r}
          />
        ))}
        <g transform={`translate(${MARK_MONOGRAM_X},0)`}>
          <path fillRule="evenodd" d={MARK_MONOGRAM} />
        </g>
      </g>
      <g transform="translate(513,44)">
        <path fill="currentColor" fillRule="evenodd" d={WORDMARK_GYM} />
        <path
          fill={tone === "mono" ? "currentColor" : BRAND.orange}
          fillRule="evenodd"
          d={WORDMARK_REBEL}
        />
      </g>
    </svg>
  );
}
