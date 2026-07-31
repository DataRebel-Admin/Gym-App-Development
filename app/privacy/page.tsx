import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/public/info-page";
import { LEGAL_ENTITY, LEGAL_UPDATED_AT, PROCESSORS } from "@/lib/legal";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/constants";

export const metadata = {
  title: "Privacyverklaring",
  description: "Hoe GymRebel omgaat met je persoonsgegevens.",
};

/**
 * Publieke privacyverklaring. Bereikbaar zonder login, want App Store Connect en
 * Google Play Console eisen allebei een privacy-URL die een reviewer kan openen.
 *
 * De tekst beschrijft wat de app daadwerkelijk verwerkt; de bewaartermijnen
 * hieronder komen één-op-één uit de code (accountverwijdering, auditretentie,
 * opschoning van foto's bij defectmeldingen).
 */
export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacyverklaring"
      updatedAt={LEGAL_UPDATED_AT}
      intro={
        <>
          <p>
            GymRebel is een app waarmee je traint bij je eigen sportschool: je
            schema, je voortgang en de apparatuur in de zaal. Voor die functies
            verwerken we persoonsgegevens. Hieronder lees je welke, waarom, hoe
            lang en welke rechten je hebt.
          </p>
          <p>
            We houden het bewust klein: geen advertenties, geen verkoop van
            gegevens, geen trackingpixels en geen profilering voor commerciële
            doeleinden.
          </p>
        </>
      }
    >
      <InfoSection id="rollen" heading="Wie is waarvoor verantwoordelijk">
        <p>
          Je sportschool bepaalt welke gegevens zij van jou in GymRebel bijhoudt
          en waarom. Zij is daarmee de <strong>verwerkingsverantwoordelijke</strong>{" "}
          in de zin van de AVG. Vragen over jouw trainingsgegevens stel je dus in
          de eerste plaats aan je eigen sportschool.
        </p>
        <p>
          {LEGAL_ENTITY.name} levert de software en beheert de servers. Wij zijn
          daarbij <strong>verwerker</strong>: we verwerken gegevens in opdracht
          van je sportschool en gebruiken ze niet voor eigen doeleinden. Voor een
          klein aantal zaken zijn we zelf verantwoordelijk, namelijk de
          beveiliging van het platform, het afhandelen van storingsmeldingen die
          je aan ons stuurt, en onze eigen administratie.
        </p>
        <p>
          Elke sportschool werkt in een strikt gescheiden omgeving. Medewerkers
          van de ene sportschool kunnen nooit gegevens van leden van een andere
          sportschool inzien.
        </p>
      </InfoSection>

      <InfoSection id="gegevens" heading="Welke gegevens we verwerken">
        <p>Afhankelijk van wat je gebruikt, kan het gaan om:</p>
        <ul className="ml-5 flex list-disc flex-col gap-2">
          <li>
            <strong>Account:</strong> naam, e-mailadres, rol, taalvoorkeur, de
            sportschool en vestiging waar je traint, en je inloggegevens. Je
            wachtwoord bewaren we uitsluitend versleuteld (bcrypt); passkeys
            slaan we op als publieke sleutel, waarbij je vingerafdruk of gezicht
            je toestel nooit verlaat.
          </li>
          <li>
            <strong>Training:</strong> je trainingsschema, gestarte sessies,
            gelogde sets, gewichten, herhalingen, tijden en afstanden.
          </li>
          <li>
            <strong>Voortgang:</strong> metingen en doelen die jij of je coach
            vastlegt, plus behaalde trofeeën.
          </li>
          <li>
            <strong>Gebruik in de zaal:</strong> welke apparaat-QR je scant, en
            defectmeldingen die je doet, eventueel met foto.
          </li>
          <li>
            <strong>Meldingen aan ons:</strong> als je een probleem meldt, sturen
            we technische context mee (route, app-versie, toesteltype,
            besturingssysteem, schermformaat en de laatste foutmeldingen). Je
            kunt anoniem melden en een schermafbeelding is optioneel.
          </li>
          <li>
            <strong>Beveiligingslogboek:</strong> wie wanneer welke handeling
            deed, met een <em>geanonimiseerd</em> IP-adres (het laatste deel
            wordt op nul gezet) en het type browser of app.
          </li>
        </ul>
        <p>
          We verwerken <strong>geen bijzondere persoonsgegevens</strong>. Metingen
          als gewicht of omvang zijn zelf ingevoerde fitnessgegevens, geen
          medische gegevens, en GymRebel geeft nadrukkelijk geen medisch advies.
          Twijfel je over een oefening, raadpleeg dan een professional.
        </p>
      </InfoSection>

      <InfoSection id="grondslag" heading="Waarom we ze verwerken">
        <p>
          De basis is de <strong>overeenkomst</strong> tussen jou en je
          sportschool: zonder deze gegevens kan de app je geen schema tonen en je
          voortgang niet bijhouden. Voor beveiliging, misbruikpreventie en het
          oplossen van storingen beroepen we ons op een{" "}
          <strong>gerechtvaardigd belang</strong>. Pushmeldingen en de optionele
          AI-assistent werken alleen met jouw <strong>toestemming</strong>, die je
          op elk moment kunt intrekken in je accountinstellingen.
        </p>
      </InfoSection>

      <InfoSection id="bewaren" heading="Hoe lang we ze bewaren">
        <ul className="ml-5 flex list-disc flex-col gap-2">
          <li>
            <strong>Je account en trainingsgegevens:</strong> zolang je lid bent.
            Verwijder je je account, dan wissen we alles definitief na een
            bedenktijd van {ACCOUNT_DELETION_GRACE_DAYS} dagen, waarin je de
            verwijdering nog kunt annuleren.
          </li>
          <li>
            <strong>Beveiligingslogboek:</strong> standaard één jaar, daarna
            gearchiveerd of verwijderd.
          </li>
          <li>
            <strong>Foto&rsquo;s bij defectmeldingen:</strong> twaalf maanden. De
            melding zelf twee jaar na afhandeling.
          </li>
          <li>
            <strong>Schermafbeeldingen bij probleemmeldingen:</strong> zes maanden
            na afhandeling.
          </li>
        </ul>
      </InfoSection>

      <InfoSection id="delen" heading="Met wie we ze delen">
        <p>
          We verkopen je gegevens niet en delen ze niet met adverteerders. Wel
          werken we met dienstverleners die namens ons verwerken:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-neutral-900">
                <th className="py-2 pr-4 font-semibold">Dienst</th>
                <th className="py-2 pr-4 font-semibold">Waarvoor</th>
                <th className="py-2 font-semibold">Regio</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((p) => (
                <tr key={p.name} className="border-b border-border/60">
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="py-2 pr-4">{p.purpose}</td>
                  <td className="py-2">{p.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          De applicatie en de database draaien in de Europese Unie. Voor
          pushmeldingen is het onvermijdelijk dat het bericht via Apple of Google
          loopt; daarbij gaat alleen de meldingstekst mee, geen trainingsdata.
        </p>
      </InfoSection>

      <InfoSection id="rechten" heading="Jouw rechten">
        <p>
          Je hebt recht op inzage, correctie, verwijdering, beperking en
          overdraagbaarheid van je gegevens, en je mag bezwaar maken tegen de
          verwerking. Twee daarvan regel je direct in de app, zonder dat je iets
          hoeft aan te vragen:
        </p>
        <ul className="ml-5 flex list-disc flex-col gap-2">
          <li>
            <strong>Downloaden:</strong> Account → Privacy → “Exporteer mijn
            gegevens” geeft je alles als JSON-bestand.
          </li>
          <li>
            <strong>Verwijderen:</strong> Account → Privacy → “Mijn account
            verwijderen”. Dit verwijdert je account en persoonlijke gegevens
            automatisch en definitief.
          </li>
        </ul>
        <p>
          Voor de overige rechten mail je{" "}
          <a className="underline" href={`mailto:${LEGAL_ENTITY.privacyEmail}`}>
            {LEGAL_ENTITY.privacyEmail}
          </a>
          . Ben je het oneens met hoe we met je gegevens omgaan, dan kun je een
          klacht indienen bij de Autoriteit Persoonsgegevens.
        </p>
      </InfoSection>

      <InfoSection id="beveiliging" heading="Beveiliging">
        <p>
          Verkeer loopt uitsluitend over versleutelde verbindingen. Wachtwoorden
          worden gehasht opgeslagen, tweestapsverificatie en passkeys zijn
          beschikbaar, en de database dwingt op databaseniveau af dat gegevens van
          verschillende sportscholen gescheiden blijven. Handelingen in de
          beheeromgeving worden vastgelegd in een onveranderlijk logboek.
        </p>
      </InfoSection>

      <InfoSection id="contact" heading="Contact">
        <p>
          {LEGAL_ENTITY.name}, handelend onder {LEGAL_ENTITY.tradeName}
          <br />
          {LEGAL_ENTITY.address}, {LEGAL_ENTITY.postalCode} {LEGAL_ENTITY.city},{" "}
          {LEGAL_ENTITY.country}
          <br />
          KvK: {LEGAL_ENTITY.cocNumber}
          <br />
          <a className="underline" href={`mailto:${LEGAL_ENTITY.email}`}>
            {LEGAL_ENTITY.email}
          </a>
        </p>
        <p>
          Zie ook ons <Link href="/cookies" className="underline">cookiebeleid</Link>.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
