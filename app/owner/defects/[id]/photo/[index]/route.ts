import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/staff";
import { requireFeature } from "@/lib/features/service";
import { getLocationScope } from "@/lib/location-access";
import { getScopedDefect } from "@/lib/defects-server";

/**
 * Beschermde weergave van een defect-foto (AVG): de Blob-URL komt nooit naar
 * de client — deze route controleert permissie + vestiging-scope en streamt de
 * afbeelding server-side door. Buiten de scope/tenant → 404 (geen 403).
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
): Promise<NextResponse> {
  const user = await requirePermission("defects:manage");
  await requireFeature(user.tenantId, "defects");

  const { id, index } = await params;
  const scope = await getLocationScope(user);
  const defect = await getScopedDefect(id, user.tenantId, scope);
  if (!defect) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const i = Number(index);
  const url = Number.isInteger(i) ? defect.photoKeys[i] : undefined;
  if (!url) return NextResponse.json({ error: "not-found" }, { status: 404 });

  // Data-URLs komen hier niet voor (uploadDefectPhoto heeft geen fallback),
  // maar wees defensief.
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "unavailable" }, { status: 502 });
    }
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
