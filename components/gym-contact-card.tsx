import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Navigation,
} from "@/components/ui/icons";

/**
 * Contactgegevens van de sportschool als nette kaart met iconen (server-
 * renderbaar). Toont alléén ingevulde velden. Interactieve, mobiel-geoptimaliseerde
 * acties: bellen (`tel:`), mailen (`mailto:`), website openen en route via Maps.
 */

export type GymContact = {
  name: string;
  logoUrl: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  openingHours: unknown;
  socials: unknown;
};

const DAY_LABELS: Record<string, string> = {
  mon: "Maandag",
  tue: "Dinsdag",
  wed: "Woensdag",
  thu: "Donderdag",
  fri: "Vrijdag",
  sat: "Zaterdag",
  sun: "Zondag",
};
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X / Twitter",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

function asStringMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" && val.trim()) out[k] = val.trim();
  }
  return out;
}

function ensureUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function Row({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}

export function GymContactCard({ gym }: { gym: GymContact }) {
  const addressParts = [
    gym.addressLine,
    [gym.postalCode, gym.city].filter(Boolean).join(" "),
    gym.country,
  ].filter((p): p is string => Boolean(p && p.trim()));
  const hasAddress = addressParts.length > 0;
  const mapsQuery = encodeURIComponent([gym.name, ...addressParts].join(", "));
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const hours = asStringMap(gym.openingHours);
  const hourEntries = DAY_ORDER.filter((d) => hours[d]).map((d) => ({
    label: DAY_LABELS[d],
    value: hours[d],
  }));
  // Onbekende sleutels (niet mon..sun) tonen we ook, achteraan.
  for (const [k, v] of Object.entries(hours)) {
    if (!DAY_ORDER.includes(k)) hourEntries.push({ label: DAY_LABELS[k] ?? k, value: v });
  }

  const socials = asStringMap(gym.socials);
  const socialEntries = Object.entries(socials);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-sm">
      {/* Kop: logo + naam */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        {gym.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gym.logoUrl}
            alt=""
            className="size-12 shrink-0 rounded-xl object-contain"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-accent-foreground">
            <Building2 className="size-6" />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight text-neutral-900">
            {gym.name}
          </p>
          <p className="text-sm text-neutral-500">Jouw sportschool</p>
        </div>
      </div>

      <div className="divide-y divide-neutral-100">
        {hasAddress ? (
          <Row icon={<MapPin className="size-4" />}>
            <div className="flex items-start justify-between gap-3">
              <address className="not-italic text-neutral-700">
                {addressParts.map((p, i) => (
                  <span key={i} className="block">{p}</span>
                ))}
              </address>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-semibold text-accent active:scale-95"
              >
                <Navigation className="size-3.5" /> Route
              </a>
            </div>
          </Row>
        ) : null}

        {gym.contactPhone ? (
          <Row icon={<Phone className="size-4" />}>
            <a href={`tel:${gym.contactPhone.replace(/\s/g, "")}`} className="font-medium text-neutral-900 active:text-accent">
              {gym.contactPhone}
            </a>
            <span className="block text-xs text-neutral-400">Tik om te bellen</span>
          </Row>
        ) : null}

        {gym.contactEmail ? (
          <Row icon={<Mail className="size-4" />}>
            <a href={`mailto:${gym.contactEmail}`} className="break-all font-medium text-neutral-900 active:text-accent">
              {gym.contactEmail}
            </a>
            <span className="block text-xs text-neutral-400">Tik om te mailen</span>
          </Row>
        ) : null}

        {gym.website ? (
          <Row icon={<Globe className="size-4" />}>
            <a
              href={ensureUrl(gym.website)}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-medium text-neutral-900 active:text-accent"
            >
              {gym.website.replace(/^https?:\/\//i, "")}
            </a>
            <span className="block text-xs text-neutral-400">Open de website</span>
          </Row>
        ) : null}

        {hourEntries.length > 0 ? (
          <Row icon={<Clock className="size-4" />}>
            <p className="mb-1 font-medium text-neutral-900">Openingstijden</p>
            <ul className="flex flex-col gap-0.5 text-neutral-600">
              {hourEntries.map((h) => (
                <li key={h.label} className="flex justify-between gap-3">
                  <span>{h.label}</span>
                  <span className="tabular-nums">{h.value}</span>
                </li>
              ))}
            </ul>
          </Row>
        ) : null}

        {socialEntries.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {socialEntries.map(([platform, url]) => (
              <a
                key={platform}
                href={ensureUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {SOCIAL_LABELS[platform] ?? platform}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
