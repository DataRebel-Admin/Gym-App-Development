import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { ensureTemplate } from "@/lib/email/template-store";
import {
  getTemplateDef,
  isEmailTemplateKey,
  placeholdersFor,
} from "@/lib/email/template-defaults";
import { TemplateEditor } from "./editor";

/** Bewerkbare talen — NL is de bron, EN/FY worden per taal apart onderhouden. */
const EDIT_LOCALES: { code: Locale; label: string }[] = [
  { code: "NL", label: "Nederlands" },
  { code: "EN", label: "English" },
  { code: "FY", label: "Frysk" },
];

function parseLocale(value: string | undefined): Locale {
  return value === "EN" || value === "FY" ? value : "NL";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const def = getTemplateDef(key);
  return { title: def ? `${def.name} | E-mailtemplate` : "E-mailtemplate" };
}

export default async function EmailTemplateEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const admin = await requireSuperadmin();
  const { key } = await params;
  if (!isEmailTemplateKey(key)) notFound();
  const def = getTemplateDef(key)!;
  const locale = parseLocale((await searchParams).locale);

  const template = await ensureTemplate(key, locale);
  const [versions, tenants] = await Promise.all([
    prisma.emailTemplateVersion.findMany({
      where: { templateId: template.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        subject: true,
        note: true,
        authorEmail: true,
        createdAt: true,
      },
    }),
    prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, accentColor: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin/email-templates" className="hover:text-accent">
          E-mailtemplates
        </Link>
        <span>/</span>
        <span className="text-neutral-900">{def.name}</span>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-1 p-1 text-sm">
        <span className="px-2 text-xs font-medium text-neutral-500">Taal:</span>
        {EDIT_LOCALES.map((l) => (
          <Link
            key={l.code}
            href={`/admin/email-templates/${key}?locale=${l.code}`}
            className={`rounded-md px-3 py-1 font-medium ${
              l.code === locale
                ? "bg-accent text-white"
                : "text-neutral-600 hover:bg-surface-2"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <TemplateEditor
        key={locale}
        templateKey={key}
        locale={locale}
        name={def.name}
        description={def.description}
        hasTrigger={def.hasTrigger}
        placeholders={placeholdersFor(key)}
        initial={{
          subject: template.subject,
          preheader: template.preheader ?? "",
          bodyHtml: template.bodyHtml,
          status: template.status,
          publishedAt: template.publishedAt?.toISOString() ?? null,
        }}
        versions={versions.map((v) => ({
          id: v.id,
          subject: v.subject,
          note: v.note,
          authorEmail: v.authorEmail,
          createdAt: v.createdAt.toISOString(),
        }))}
        tenants={tenants}
        adminEmail={admin.email ?? ""}
      />
    </div>
  );
}
