import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/public/info-page";
import { LEGAL_ENTITY, LEGAL_UPDATED_AT } from "@/lib/legal";

export const metadata = {
  title: "Cookiebeleid",
  description: "Welke cookies GymRebel gebruikt en waarom.",
};

/**
 * Publiek cookiebeleid. De lijst hieronder komt uit `lib/constants.ts`; komt er
 * een cookie bij, voeg 'm hier dan óók toe.
 *
 * Alle cookies zijn strikt noodzakelijk of een expliciete voorkeursinstelling van
 * de gebruiker. Daarom is er bewust géén toestemmingsbanner: onder de
 * Telecommunicatiewet is toestemming alleen vereist voor niet-functionele
 * cookies, en die zetten we niet. Voeg je ooit analytics of een trackingpixel
 * toe, dan is een banner wél verplicht en moet deze pagina mee veranderen.
 */
const COOKIES: { name: string; purpose: string; duration: string }[] = [
  {
    name: "authjs.session-token",
    purpose: "Houdt je ingelogd. Zonder deze cookie werkt de app niet.",
    duration: "Sessie, verlengt bij gebruik",
  },
  {
    name: "gymrebel-auth-tenant",
    purpose: "Onthoudt bij welke sportschool je inlogt, zodat de inloglink bij de juiste omgeving uitkomt.",
    duration: "1 jaar",
  },
  {
    name: "gymrebel-2fa-challenge",
    purpose: "Kortlevend bewijs dat je wachtwoord al is gecontroleerd, tijdens het invoeren van je tweestapscode.",
    duration: "5 minuten",
  },
  {
    name: "gymrebel-locale",
    purpose: "Onthoudt je taalkeuze.",
    duration: "1 jaar",
  },
  {
    name: "gymrebel-location",
    purpose: "Onthoudt bij welke vestiging je op dit moment traint.",
    duration: "1 jaar",
  },
  {
    name: "gymrebel-gym-select",
    purpose: "Onthoudt je keuze als je bij meerdere sportscholen traint.",
    duration: "1 jaar",
  },
  {
    name: "gymrebel-bg-parallax",
    purpose: "Onthoudt of je de bewegende achtergrond aan of uit hebt gezet.",
    duration: "1 jaar",
  },
];

export default function CookiesPage() {
  return (
    <InfoPage
      title="Cookiebeleid"
      updatedAt={LEGAL_UPDATED_AT}
      intro={
        <>
          <p>
            GymRebel gebruikt alleen cookies die nodig zijn om de app te laten
            werken of om een instelling van jou te onthouden. We gebruiken{" "}
            <strong>geen</strong> analytics, geen advertentiecookies en geen
            trackingpixels, en we delen niets met derden voor marketing.
          </p>
          <p>
            Daarom zie je bij ons ook geen toestemmingsbanner: die is wettelijk
            alleen verplicht voor niet-functionele cookies, en die zetten we niet.
          </p>
        </>
      }
    >
      <InfoSection id="lijst" heading="Welke cookies we plaatsen">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-neutral-900">
                <th className="py-2 pr-4 font-semibold">Naam</th>
                <th className="py-2 pr-4 font-semibold">Waarvoor</th>
                <th className="py-2 font-semibold">Bewaartijd</th>
              </tr>
            </thead>
            <tbody>
              {COOKIES.map((c) => (
                <tr key={c.name} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-4 font-mono text-[13px]">{c.name}</td>
                  <td className="py-2 pr-4">{c.purpose}</td>
                  <td className="py-2 whitespace-nowrap">{c.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InfoSection>

      <InfoSection id="opslag" heading="Opslag op je eigen toestel">
        <p>
          Naast cookies bewaart de app een paar voorkeuren lokaal op je toestel,
          bijvoorbeeld of de rusttimer in deze trainingssessie aanstaat en of je
          een supersetgroep als wizard of als lijst wilt zien. Die gegevens
          verlaten je toestel niet en verdwijnen als je de app verwijdert of je
          browsergegevens wist.
        </p>
        <p>
          Gebruik je GymRebel als geïnstalleerde app, dan wordt daarnaast een
          service worker gebruikt om de app sneller te laden en een nette melding
          te tonen als je geen verbinding hebt.
        </p>
      </InfoSection>

      <InfoSection id="beheer" heading="Cookies weigeren of verwijderen">
        <p>
          Je kunt cookies verwijderen via de instellingen van je browser of door
          de app te verwijderen. Houd er rekening mee dat je zonder de
          inlogcookie niet kunt inloggen: die is technisch noodzakelijk.
        </p>
      </InfoSection>

      <InfoSection id="contact" heading="Vragen">
        <p>
          Mail{" "}
          <a className="underline" href={`mailto:${LEGAL_ENTITY.privacyEmail}`}>
            {LEGAL_ENTITY.privacyEmail}
          </a>{" "}
          of lees onze{" "}
          <Link href="/privacy" className="underline">
            privacyverklaring
          </Link>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
