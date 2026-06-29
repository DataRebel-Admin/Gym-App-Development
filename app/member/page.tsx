import { auth } from "@/auth";

export default async function MemberHome() {
  const session = await auth();
  const name = session?.user.name ?? "sporter";

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Hoi {name} 👋
        </h1>
        <p className="mt-1 text-neutral-500">Klaar voor je training?</p>
      </div>

      <button className="rounded-xl bg-accent px-6 py-5 text-left text-lg font-medium text-accent-foreground">
        Start training
      </button>

      <p className="text-sm text-neutral-500">
        (Schema, scan en tracking volgen in fase 3 — prompts 08–10.)
      </p>
    </div>
  );
}
