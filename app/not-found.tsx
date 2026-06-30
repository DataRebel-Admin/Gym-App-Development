import { ErrorView } from "@/components/error/error-view";

export const metadata = { title: "Pagina niet gevonden" };

/**
 * Globale 404 — vangt zowel echt onbestaande URL's als expliciete
 * `notFound()`-calls. Auth-bewust (juiste dashboard-knop) met slimme
 * typo-suggesties en zoek. Rendert binnen de root-layout, dus tenant-branding +
 * motion zijn beschikbaar.
 */
export default function NotFound() {
  return <ErrorView code={404} />;
}
