import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { SectionHeading } from "@/components/ui/section-heading";
import { LocationForm } from "../location-form";

export const metadata = { title: "Nieuwe vestiging" };

export default async function NewLocationPage() {
  await requireOwner();
  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/owner/locations" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Vestigingen
      </Link>
      <SectionHeading
        title="Nieuwe vestiging"
        description="Apparaten, lessen en trainingen worden per vestiging geregistreerd."
      />
      <LocationForm />
    </div>
  );
}
