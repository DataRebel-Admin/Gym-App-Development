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
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="mb-6 inline-block h-3 w-3 rounded-full bg-accent" />
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
        GymRebel
      </h1>
      <p className="mt-4 max-w-md text-lg text-neutral-500">
        Onder constructie — we bouwen iets goeds.
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        Slimmer trainen in jouw sportschool.
      </p>
    </main>
  );
}
