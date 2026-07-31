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

/**
 * Gestapelde lockup: beeldmerk boven het woordmerk, met de TRAINING-regel
 * eronder tussen twee liniaaltjes. Dit is de variant van het Brand Book
 * (titelpagina en "STACKED LOGO"), bedoeld voor plekken waar het merk het
 * middelpunt is in plaats van een element in een balk: de landingspagina,
 * het inlogscherm en drukwerk.
 *
 * De TRAINING-regel is bewust **HTML-tekst en geen vectorpad**. De letters staan
 * in het origineel wijd gespatieerd, en dat is met CSS exact te sturen en scherp
 * op elk formaat, terwijl een uitgesneden pad opnieuw getekend zou moeten worden
 * bij elke wijziging. Gevolg: dit component is bedoeld voor de web-UI. Voor
 * bestanden buiten React (iconen, e-mail, PDF) blijven de puur-vectorvarianten
 * in `public/brand/` de bron.
 *
 * `size` schaalt alles mee: de TRAINING-regel volgt de breedte van het woordmerk,
 * zodat de verhoudingen kloppen op elke afmeting.
 */
export function GymRebelStacked({
  className,
  title = "GymRebel Training",
  tone = "brand",
}: MarkProps & { tone?: Tone }) {
  const ruleColor = tone === "mono" ? "currentColor" : BRAND.orange;
  return (
    // `container-type: inline-size` maakt `cqw` beschikbaar: 1cqw is 1% van de
    // bréédte van dit blok. Daardoor schaalt de TRAINING-regel mee met het logo
    // in plaats van met de omliggende pagina, en klopt de verhouding op elk
    // formaat zonder dat de aanroeper iets hoeft mee te geven.
    <div
      className={className}
      role="img"
      aria-label={title}
      style={{ containerType: "inline-size" }}
    >
      {/* Het beeldmerk volgt `currentColor`, dus de kleur zetten we hier: Rebel
          Orange in de merkvariant (zoals in de horizontale lockup en het Brand
          Book), meelopend met de tekstkleur in `mono` — want oranje-op-oranje
          verdwijnt zodra het logo op een accentvlak staat. */}
      <span
        className="block"
        style={tone === "mono" ? undefined : { color: BRAND.orange }}
      >
        <GymRebelMark className="mx-auto block h-auto w-[62%]" />
      </span>
      <GymRebelWordmark className="mt-[6%] block h-auto w-full" tone={tone} />
      {/* Liniaal, TRAINING, liniaal. Flexbox laat de lijnen zich vanzelf voegen
          naar de breedte van de tekst, wat bij een vaste vectorbreedte niet zou
          lukken (letterbreedte hangt van het geladen font af). */}
      <div className="mt-[4%] flex items-center gap-[0.6em]">
        <span aria-hidden className="h-px flex-1" style={{ backgroundColor: ruleColor }} />
        <span
          className="font-display font-semibold uppercase leading-none"
          style={{
            // Eerst een rem-waarde als vangnet voor browsers zonder container
            // queries; de cqw-regel erna overschrijft 'm waar dat wél kan.
            fontSize: "0.75rem",
            letterSpacing: "0.42em",
            // De tracking zit óók achter de laatste letter en trekt de tekst
            // optisch naar links; deze halve stap zet 'm terug in het midden.
            paddingLeft: "0.42em",
          }}
        >
          <span className="[font-size:4.4cqw]">Training</span>
        </span>
        <span aria-hidden className="h-px flex-1" style={{ backgroundColor: ruleColor }} />
      </div>
    </div>
  );
}
