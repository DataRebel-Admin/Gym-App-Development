import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
  // Na login landt de magic link hier; stuur door op basis van rol.
  const session = await auth();
  if (session?.user) {
    redirect(
      session.user.role === "SUPERADMIN"
        ? "/admin"
        : session.user.role === "TENANT_ADMIN"
          ? "/owner"
          : "/member"
    );
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Zachte accent-gloed op de achtergrond */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent-gradient)" }}
      />
      <span className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-accent-gradient text-2xl font-bold text-accent-foreground shadow-accent">
        G
      </span>
      <h1 className="font-display text-4xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
        GymRebel
      </h1>
      <p className="mt-4 max-w-md text-lg text-neutral-500">
        Slimmer trainen in jouw sportschool.
      </p>
    </main>
  );
}
