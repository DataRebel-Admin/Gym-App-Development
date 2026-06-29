import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { LogoutButton } from "@/components/ui/logout-button";

const NAV = [
  { href: "/member", label: "Home" },
  { href: "/member/schema", label: "Schema" },
  { href: "/member/scan", label: "Scan" },
  { href: "/member/rooster", label: "Rooster" },
  { href: "/member/history", label: "Historie" },
];

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
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <Link href="/member" className="font-semibold text-neutral-900">
          {tenant?.name ?? "GymRebel"}
        </Link>
        <div className="flex items-center gap-3">
          <span className="max-w-[8rem] truncate text-sm text-neutral-500">
            {session.user.name ?? session.user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="flex flex-1 flex-col pb-20">{children}</main>

      {/* Mobile-first onderbalk */}
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center justify-around border-t border-neutral-200 bg-white py-2">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="px-3 py-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
