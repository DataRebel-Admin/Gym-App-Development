import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requireOwner } from "@/lib/owner";
import {
  TEMPLATE_HEADERS,
  TEMPLATE_SAMPLE_ROWS,
  buildCsvTemplate,
} from "@/lib/member-import";

/**
 * Voorbeeldbestand voor de bulk-import. `?format=csv` (standaard) of `?format=xlsx`.
 * Headers + 2 voorbeeldrijen komen uit `lib/member-import.ts` (één bron van waarheid).
 */
export async function GET(req: NextRequest) {
  await requireOwner();
  const format = req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  if (format === "xlsx") {
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE_ROWS]);
    sheet["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Leden");
    const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="leden-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(buildCsvTemplate(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leden-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
