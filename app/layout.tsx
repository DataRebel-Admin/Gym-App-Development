import type { CSSProperties } from "react";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { getCurrentTenant } from "@/lib/tenant";
import { getResolvedTheme } from "@/lib/theme";
import { rootMetadata } from "@/lib/metadata";
import { TenantProvider, type TenantInfo } from "@/components/tenant-provider";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ToastProvider } from "@/components/ui/toast";

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

const LOCALE_LANG: Record<string, string> = { NL: "nl", EN: "en", FY: "fy" };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [tenant, theme] = await Promise.all([
    getCurrentTenant(),
    getResolvedTheme(),
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

  return (
    <html
      lang={LOCALE_LANG[tenant?.locale ?? "NL"] ?? "nl"}
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={themeStyle}>
        <MotionProvider>
          <ToastProvider>
            <TenantProvider tenant={tenantInfo}>{children}</TenantProvider>
          </ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
