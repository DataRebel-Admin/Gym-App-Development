export default function CheckEmailPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Check je inbox
        </h1>
        <p className="mt-3 text-sm text-neutral-500">
          We hebben je een magic link gestuurd. Klik op de link om in te loggen.
        </p>
        <p className="mt-4 rounded-lg bg-neutral-100 px-4 py-3 text-xs text-neutral-500">
          In development wordt de link naar de server-console (terminal)
          geprint i.p.v. gemaild.
        </p>
      </div>
    </main>
  );
}
