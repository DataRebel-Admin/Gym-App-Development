import type { CSSProperties } from "react";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { getCurrentTenant } from "@/lib/tenant";
import { getResolvedTheme } from "@/lib/theme";
import { rootMetadata } from "@/lib/metadata";
import { LOCALE_META, isLocale } from "@/lib/i18n/config";
import { TenantProvider, type TenantInfo } from "@/components/tenant-provider";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ToastProvider } from "@/components/ui/toast";
import { FullscreenToggle } from "@/components/fullscreen-toggle";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [tenant, theme, locale, messages] = await Promise.all([
    getCurrentTenant(),
    getResolvedTheme(),
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
  const vars: Record<string, string> = {};
  if (tenant?.accentColor) vars["--tenant-accent"] = tenant.accentColor;
  if (tenant?.secondaryColor) vars["--tenant-secondary"] = tenant.secondaryColor;
  // Eigen lettertype overschrijft de default (Geist) alleen als de tenant 'm zet.
  if (tenant?.fontFamily) vars["fontFamily"] = tenant.fontFamily;
  const themeStyle =
    Object.keys(vars).length > 0 ? (vars as CSSProperties) : undefined;

  // `<html lang>` volgt de actieve UI-locale (niet langer de tenant-taal).
  const htmlLang = isLocale(locale) ? LOCALE_META[locale].bcp47 : "nl-NL";

  return (
    <html
      lang={htmlLang}
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={themeStyle}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MotionProvider>
            <ToastProvider>
              <TenantProvider tenant={tenantInfo}>
                {children}
                <FullscreenToggle />
              </TenantProvider>
            </ToastProvider>
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
