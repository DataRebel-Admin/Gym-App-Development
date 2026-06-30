import Link from "next/link";
import { requireOwner } from "@/lib/owner";

export default async function SchemasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwner();

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Schema&apos;s
        </h1>
        <nav className="mt-3 flex gap-4 text-sm">
          <Link
            href="/owner/schemas/templates"
            className="text-neutral-500 hover:text-neutral-900"
          >
            Templates
          </Link>
          <Link
            href="/owner/schemas/members"
            className="text-neutral-500 hover:text-neutral-900"
          >
            Leden
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
