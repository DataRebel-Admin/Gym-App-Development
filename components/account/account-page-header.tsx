/**
 * Gedeelde kop voor account-sub-pagina's. De `h1` toont **alleen op desktop** —
 * op mobiel geeft de topbalk (AccountHeaderNav) al de sectietitel, dus daar
 * begint de content direct met de (optionele) beschrijving. `action` = optionele
 * rechter-slot (bv. een live "opgeslagen"-status of een knop).
 */
export function AccountPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="hidden font-display text-2xl font-bold text-neutral-900 lg:block">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-neutral-500 lg:mt-1">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
