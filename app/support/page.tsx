import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/public/info-page";
import { LEGAL_ENTITY } from "@/lib/legal";

export const metadata = {
  title: "Hulp nodig",
  description: "Antwoorden op veelgestelde vragen en hoe je contact opneemt.",
};

/**
 * Publieke supportpagina. Dit is de **support-URL** die App Store Connect en
 * Google Play Console verplicht stellen.
 *
 * Bewust een echte pagina en geen `mailto:`-link: Apple accepteert dat laatste
 * niet als support-URL. En bewust publiek, want een reviewer moet 'm kunnen
 * openen zonder account.
 *
 * De antwoorden hieronder verwijzen naar bestaande schermen. Verplaats je een
 * route, controleer dan deze pagina.
 */
const FAQ: { vraag: string; antwoord: React.ReactNode }[] = [
  {
    vraag: "Ik kan niet inloggen, of ik heb geen account",
    antwoord: (
      <>
        GymRebel loopt via je sportschool: zij maakt je account aan, je kunt je
        niet zelf aanmelden. Krijg je de melding dat je e-mailadres onbekend is,
        gebruik dan het adres waarmee je bij je sportschool bekend staat, of vraag
        je sportschool om je opnieuw uit te nodigen.
      </>
    ),
  },
  {
    vraag: "Ik ben mijn wachtwoord vergeten",
    antwoord: (
      <>
        Kies op het inlogscherm voor “Wachtwoord vergeten?”, of ga rechtstreeks
        naar <Link href="/login/reset" className="underline">de resetpagina</Link>.
        Je krijgt een e-mail met een link die één uur geldig is. Zie je geen mail,
        controleer dan je spammap.
      </>
    ),
  },
  {
    vraag: "Ik train bij meerdere sportscholen",
    antwoord: (
      <>
        Dat kan. De app herkent je aan je e-mailadres en vraagt na het inloggen
        bij welke sportschool je wilt zijn. Je gegevens blijven per sportschool
        gescheiden.
      </>
    ),
  },
  {
    vraag: "Ik krijg geen meldingen",
    antwoord: (
      <>
        Controleer twee dingen. Ten eerste of meldingen aanstaan in de app, onder
        Account → Meldingen: daar zet je per soort bericht in of je het in de app,
        per e-mail of als pushmelding wilt. Ten tweede of je toestel meldingen van
        GymRebel toestaat, in de systeeminstellingen bij Apps of Meldingen. Heb je
        de vraag om toestemming ooit geweigerd, dan moet je die daar alsnog
        aanzetten.
      </>
    ),
  },
  {
    vraag: "De QR-scanner start niet",
    antwoord: (
      <>
        De scanner heeft toegang tot je camera nodig. Weiger je die vraag, dan
        blijft het scherm leeg. Zet cameratoegang voor GymRebel aan in de
        instellingen van je toestel. Lukt scannen daarna nog niet, dan kun je de
        oefening ook opzoeken in de oefeningenlijst.
      </>
    ),
  },
  {
    vraag: "Er klopt iets niet aan mijn schema",
    antwoord: (
      <>
        Je schema wordt samengesteld door je coach. Wil je iets aangepast hebben,
        gebruik dan “Aanpassing vragen aan je trainer” bij je schema. Staat je
        sportschool het toe, dan kun je ook zelf een schema samenstellen of je
        toegewezen schema aanpassen.
      </>
    ),
  },
  {
    vraag: "Een apparaat in de zaal is kapot",
    antwoord: (
      <>
        Meld het in de app, via de QR-code op het apparaat of via Apparaat melden.
        Je sportschool krijgt de melding direct binnen. Is het apparaat onveilig,
        geef dat dan aan: het wordt dan meteen op buiten gebruik gezet zodat
        anderen gewaarschuwd zijn.
      </>
    ),
  },
  {
    vraag: "Hoe verwijder ik mijn account?",
    antwoord: (
      <>
        Ga naar Account → Privacy en kies “Mijn account verwijderen”. Je account
        en je persoonlijke gegevens worden na een bedenktijd van 30 dagen
        automatisch en definitief verwijderd. Tot die datum kun je het nog
        annuleren. Wil je eerst je gegevens bewaren, gebruik dan “Exporteer mijn
        gegevens” op diezelfde pagina.
      </>
    ),
  },
  {
    vraag: "Hoe verander ik de taal?",
    antwoord: <>Ga naar Account → Taal. De app onthoudt je keuze op al je toestellen.</>,
  },
];

export default function SupportPage() {
  return (
    <InfoPage
      title="Hulp nodig"
      intro={
        <>
          <p>
            Kom je ergens niet uit? Hieronder staan de vragen die het vaakst
            gesteld worden. Staat het antwoord er niet bij, dan helpen we je
            graag verder.
          </p>
        </>
      }
    >
      <InfoSection id="wie" heading="Wie kun je het beste vragen">
        <p>
          <strong>Vragen over je training, je schema of je lidmaatschap</strong>{" "}
          stel je aan je eigen sportschool. Zij beheert je account, stelt je
          schema samen en bepaalt welke functies aanstaan. De contactgegevens van
          je sportschool vind je in de app onder “Mijn sportschool”.
        </p>
        <p>
          <strong>Werkt de app zelf niet goed?</strong> Dan zijn wij aan zet.
          Gebruik de knop “Probleem melden” in het menu van de app. Je melding
          komt rechtstreeks bij het ontwikkelteam terecht, inclusief technische
          gegevens die het opsporen versnellen. Je ziet vooraf precies wat er
          wordt meegestuurd, en je kunt anoniem melden. Na verzenden krijg je een
          referentienummer.
        </p>
      </InfoSection>

      <InfoSection id="faq" heading="Veelgestelde vragen">
        <dl className="flex flex-col gap-6">
          {FAQ.map((item) => (
            <div key={item.vraag}>
              <dt className="font-semibold text-neutral-900">{item.vraag}</dt>
              <dd className="mt-1.5">{item.antwoord}</dd>
            </div>
          ))}
        </dl>
      </InfoSection>

      <InfoSection id="contact" heading="Contact">
        <p>
          Kom je er niet uit, mail dan{" "}
          <a className="underline" href={`mailto:${LEGAL_ENTITY.email}`}>
            {LEGAL_ENTITY.email}
          </a>
          . Vermeld erbij bij welke sportschool je traint en op welk toestel je
          het probleem ziet, dan kunnen we sneller helpen.
        </p>
        <p>
          {LEGAL_ENTITY.name}, {LEGAL_ENTITY.city}, {LEGAL_ENTITY.country}
        </p>
      </InfoSection>

      <InfoSection id="documenten" heading="Documenten">
        <p>
          Lees hoe we met je gegevens omgaan in onze{" "}
          <Link href="/privacy" className="underline">
            privacyverklaring
          </Link>{" "}
          en welke cookies we plaatsen in ons{" "}
          <Link href="/cookies" className="underline">
            cookiebeleid
          </Link>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
