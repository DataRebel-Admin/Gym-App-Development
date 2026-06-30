import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { ensureTemplate } from "@/lib/email/template-store";
import {
  getTemplateDef,
  isEmailTemplateKey,
  placeholdersFor,
} from "@/lib/email/template-defaults";
import { TemplateEditor } from "./editor";

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
}: {
  params: Promise<{ key: string }>;
}) {
  const admin = await requireSuperadmin();
  const { key } = await params;
  if (!isEmailTemplateKey(key)) notFound();
  const def = getTemplateDef(key)!;

  const template = await ensureTemplate(key);
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

      <TemplateEditor
        templateKey={key}
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
