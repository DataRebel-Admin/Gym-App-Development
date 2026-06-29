import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { LogoutButton } from "@/components/ui/logout-button";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Verdediging in de diepte (de middleware beschermt deze routes ook al).
  if (!session?.user) redirect("/login");
  if (session.user.role !== "MEMBER") redirect("/owner");

  const tenant = await getCurrentTenant();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <Link href="/member" className="font-semibold text-neutral-900">
          {tenant?.name ?? "GymRebel"}
        </Link>
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
