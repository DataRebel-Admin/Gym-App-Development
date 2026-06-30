import Link from "next/link";
import { requireSuperadmin } from "@/lib/superadmin";
import { TenantCreateForm } from "./tenant-create-form";

export const metadata = { title: "Nieuwe tenant" };

export default async function NewTenantPage() {
  await requireSuperadmin();

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link
          href="/admin/tenants"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Tenants
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          Nieuwe tenant
        </h1>
      </div>
      <TenantCreateForm />
    </div>
  );
}
