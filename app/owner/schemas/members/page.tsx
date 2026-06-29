import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";

export default async function MembersPage() {
  const owner = await requireOwner();

  const members = await prisma.user.findMany({
    where: { tenantId: owner.tenantId, role: "TENANT_MEMBER" },
    orderBy: { name: "asc" },
    include: {
      assignedWorkouts: {
        include: { template: { select: { name: true } } },
        take: 1,
      },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        Wijs leden een schema toe ({members.length} leden).
      </p>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Lid</th>
              <th className="px-4 py-2 font-medium">Huidig schema</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const schema = m.assignedWorkouts[0]?.template?.name;
              return (
                <tr key={m.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-medium text-neutral-900">
                    {m.name ?? m.email}
                  </td>
                  <td className="px-4 py-2 text-neutral-700">
                    {schema ?? (
                      <span className="text-neutral-400">— geen —</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/owner/schemas/members/${m.id}`}
                      className="text-accent hover:underline"
                    >
                      Beheren
                    </Link>
                  </td>
                </tr>
              );
            })}
            {members.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">
                  Nog geen leden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
