"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * Gedeelde open-staat van het mobiele zijmenu, zodat de hamburger in de header
 * én de "Meer"-knop in de onderbalk dezelfde `SideNavDrawer` bedienen. Eén
 * drawer-instantie, twee triggers — geen tweede portal/scroll-lock.
 *
 * Buiten een provider (bv. `/admin`) is de context `null` en valt de drawer terug
 * op z'n eigen `useState`. `useContext` draait altijd, dus dat blijft een
 * onvoorwaardelijke hook.
 */
type MobileNavValue = { open: boolean; setOpen: (open: boolean) => void };

const MobileNavContext = createContext<MobileNavValue | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
  );
}

/** De gedeelde drawer-staat, of `null` buiten een provider. */
export function useMobileNav(): MobileNavValue | null {
  return useContext(MobileNavContext);
}
