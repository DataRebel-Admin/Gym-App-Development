"use client";

import { createContext, useContext } from "react";

export type TenantInfo = {
  slug: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
  locale: string;
};

const TenantContext = createContext<TenantInfo | null>(null);

/** Maakt de tenant beschikbaar in Client Components via `useTenant()`. */
export function TenantProvider({
  tenant,
  children,
}: {
  tenant: TenantInfo | null;
  children: React.ReactNode;
}) {
  return (
    <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantInfo | null {
  return useContext(TenantContext);
}
