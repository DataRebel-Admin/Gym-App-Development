import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { LogoutButton } from "@/components/ui/logout-button";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER") redirect("/member");

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/owner" className="font-semibold text-neutral-900">
            GymRebel
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-500">
            <Link href="/owner" className="hover:text-neutral-900">
              Dashboard
            </Link>
            <Link href="/owner/machines" className="hover:text-neutral-900">
              Machines
            </Link>
            <Link href="/owner/schemas" className="hover:text-neutral-900">
              Schema&apos;s
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
