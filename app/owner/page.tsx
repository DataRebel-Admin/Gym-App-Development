import { auth } from "@/auth";

export default async function OwnerHome() {
  const session = await auth();
  const name = session?.user.name ?? "eigenaar";

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Welkom, {name}
      </h1>
      <p className="text-neutral-500">
        Beheer je machines en schema&apos;s, en bekijk gebruiksinzichten.
      </p>
      <p className="text-sm text-neutral-500">
        (Machinebeheer, schema&apos;s en het dashboard volgen in fase 2 — prompts
        05–07.)
      </p>
    </div>
  );
}
