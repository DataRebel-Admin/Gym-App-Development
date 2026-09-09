import type { CSSProperties } from "react";
import type { Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { getCurrentTenant } from "@/lib/tenant";
import { getResolvedTheme } from "@/lib/theme";
import { getBackgroundParallax } from "@/lib/background-motion";
import { rootMetadata } from "@/lib/metadata";
import { accentForTheme, readableText } from "@/lib/color";
import { LOCALE_META, isLocale } from "@/lib/i18n/config";
import { TenantProvider, type TenantInfo } from "@/components/tenant-provider";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ClientErrorRecorder } from "@/components/error/client-error-recorder";
import { SplashGate } from "@/components/pwa/splash-gate";
import { DeepLinkHandler } from "@/components/pwa/deep-link-handler";
import { NativePushListeners } from "@/components/pwa/native-push-listeners";
import { AppBackground } from "@/components/ui/app-background";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display-font voor headings (vet, sportief). Tenant fontFamily-override
// blijft leidend voor de body-tekst.
const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Titel-sjabloon + dynamische favicon (per tenant). Zie lib/metadata.ts.
export const generateMetadata = rootMetadata;

// Browser-chrome themekleur volgt de tenant-huisstijl (whitelabel), met de
// GymRebel-merkkleur als fallback. getCurrentTenant is per-request gecachet.
export async function generateViewport(): Promise<Viewport> {
  const tenant = await getCurrentTenant();
  return { themeColor: tenant?.accentColor ?? "#ff4d00" };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [tenant, theme, parallax, locale, messages] = await Promise.all([
    getCurrentTenant(),
    getResolvedTheme(),
    getBackgroundParallax(),
    getLocale(),
    getMessages(),
  ]);

  const tenantInfo: TenantInfo | null = tenant
    ? {
        slug: tenant.slug,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        accentColor: tenant.accentColor,
        locale: tenant.locale,
      }
    : null;

  // Whitelabel: injecteer de tenant-huisstijl als CSS custom properties zodat
  // `bg-accent`/`text-accent` (+ secondary/font) runtime per tenant kleuren.
  //
  // ⚠️ DE TENANT-VARS HOREN OP `<html>` (= `:root`), NIET OP `<body>`.
  // Alle afgeleide tokens (--accent-soft, --accent-ring, --accent-gradient,
  // --shadow-accent, --app-bg, --orb-*) worden in globals.css op `:root`
  // berekend met color-mix(var(--tenant-accent) …). Een custom property met een
  // var()-verwijzing wordt gesubstitueerd op het element waar hij gedeclareerd
  // staat — dus op `:root`, met de daar geldende --tenant-accent. Stond de
  // tenant-kleur op <body>, dan bleven al die afgeleiden op de default Rebel
  // Orange staan terwijl `bg-accent` (die de var pas op het element zelf
  // oplost) wél meekleurde: een zwart/gele sportschool kreeg oranje aurora-orbs,
  // accent-washes, ringen en schaduwen. Op `<html>` wint de inline-stijl in de
  // cascade, dus ook de dark-mode-varianten van die tokens rekenen mee.
  //
  // Het accent gaat als twee thema-varianten mee, niet als één waarde: een
  // merkkleur kan in precies één van beide thema's wegvallen (zwart op de
  // bijna zwarte donkere modus, knalgeel op wit). `accentForTheme` mengt zo'n
  // kleur minimaal bij tot 3:1 tegen het kaartoppervlak en laat een accent dat
  // al genoeg contrast heeft — het GymRebel-oranje bijvoorbeeld — exact met
  // rust. De keuze tussen de twee doet de cascade in globals.css, want de
  // themawissel zet alleen `data-theme` om zonder server-render.
  const brandVars: Record<string, string> = {};
  if (tenant?.accentColor) {
    const lightAccent = accentForTheme(tenant.accentColor, "light");
    const darkAccent = accentForTheme(tenant.accentColor, "dark");
    brandVars["--tenant-accent-light"] = lightAccent;
    brandVars["--tenant-accent-dark"] = darkAccent;
    // Leesbare tekstkleur ÓP het accent (wit of donkergrijs), per thema afgeleid
    // van de kleur die daar écht getoond wordt. Zonder dit bleef
    // `--tenant-accent-foreground` op #fff staan → wit-op-licht bij een lichte
    // tenant-huisstijl. Zelfde luminantie-logica als e-mails/QR (lib/color.ts).
    brandVars["--tenant-accent-fg-light"] = readableText(lightAccent);
    brandVars["--tenant-accent-fg-dark"] = readableText(darkAccent);
  }
  if (tenant?.secondaryColor) brandVars["--tenant-secondary"] = tenant.secondaryColor;
  const htmlStyle =
    Object.keys(brandVars).length > 0 ? (brandVars as CSSProperties) : undefined;

  // Het eigen lettertype blijft bewust op <body>: `body { font-family: … }` in
  // globals.css zou een van <html> geërfde waarde overschrijven.
  const bodyStyle: CSSProperties | undefined = tenant?.fontFamily
    ? { fontFamily: tenant.fontFamily }
    : undefined;

  // `<html lang>` volgt de actieve UI-locale (niet langer de tenant-taal).
  const htmlLang = isLocale(locale) ? LOCALE_META[locale].bcp47 : "nl-NL";

  return (
    <html
      lang={htmlLang}
      data-theme={theme}
      data-bg-parallax={parallax ? "on" : "off"}
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} h-full antialiased`}
      style={htmlStyle}
    >
      <body className="min-h-full flex flex-col" style={bodyStyle}>
        {/* Levende aurora-achtergrond — achter alle content (zie .app-bg). */}
        <AppBackground />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MotionProvider>
            <ToastProvider>
              <TenantProvider tenant={tenantInfo}>
                {children}
                <ServiceWorkerRegister />
                <ClientErrorRecorder />
                {/* Klikt het native startscherm weg zodra de UI staat; no-op op web. */}
                <SplashGate />
                {/* Magic link, uitnodiging of QR die de app opent → juiste pagina. */}
                <DeepLinkHandler />
                {/* Reageren op pushmeldingen — op élke pagina, niet alleen member/owner. */}
                <NativePushListeners />
              </TenantProvider>
            </ToastProvider>
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
