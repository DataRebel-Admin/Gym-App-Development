import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentTenant } from "@/lib/tenant";
import { TenantProvider, type TenantInfo } from "@/components/tenant-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GymRebel",
  description: "Slimmer trainen in jouw sportschool.",
};

const LOCALE_LANG: Record<string, string> = { NL: "nl", EN: "en", FY: "fy" };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getCurrentTenant();

  const tenantInfo: TenantInfo | null = tenant
    ? {
        slug: tenant.slug,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        accentColor: tenant.accentColor,
        locale: tenant.locale,
      }
    : null;

  // Whitelabel: injecteer de tenant-accentkleur als CSS custom property zodat
  // alle `bg-accent` / `text-accent` utilities runtime per tenant kleuren.
  const themeStyle = tenant?.accentColor
    ? ({ "--tenant-accent": tenant.accentColor } as CSSProperties)
    : undefined;

  return (
    <html
      lang={LOCALE_LANG[tenant?.locale ?? "NL"] ?? "nl"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={themeStyle}>
        <TenantProvider tenant={tenantInfo}>{children}</TenantProvider>
      </body>
    </html>
  );
}
