import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { LogoutButton } from "@/components/ui/logout-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPERADMIN") redirect("/");

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-semibold text-neutral-900">
            GymRebel <span className="text-neutral-400">· Platform</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-500">
            <Link href="/admin" className="hover:text-neutral-900">
              Dashboard
            </Link>
            <Link href="/admin/tenants" className="hover:text-neutral-900">
              Tenants
            </Link>
            <Link href="/admin/users" className="hover:text-neutral-900">
              Gebruikers
            </Link>
            <Link href="/admin/audit" className="hover:text-neutral-900">
              Audit log
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500">
            {session.user.name ?? session.user.email}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
