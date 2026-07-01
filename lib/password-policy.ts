// Wachtwoordbeleid — één bron van waarheid voor de minimale eisen. Puur (geen
// server-only/bcrypt) zodat zowel de client (realtime checklist) als de server
// (validatie vóór hashen) exact dezelfde regels gebruiken.
//
// Beleid: minimaal 12 tekens, ≥1 hoofdletter, ≥1 kleine letter, ≥1 cijfer en
// ≥1 speciaal teken. Uitbreidbaar: nieuwe eis = één record toevoegen.

export type PasswordRequirement = {
  id: string;
  label: string;
  test: (pw: string) => boolean;
};

export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "length",
    label: `Minimaal ${MIN_PASSWORD_LENGTH} tekens`,
    test: (pw) => pw.length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: "uppercase",
    label: "Minimaal één hoofdletter",
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    id: "lowercase",
    label: "Minimaal één kleine letter",
    test: (pw) => /[a-z]/.test(pw),
  },
  {
    id: "digit",
    label: "Minimaal één cijfer",
    test: (pw) => /\d/.test(pw),
  },
  {
    id: "special",
    label: "Minimaal één speciaal teken",
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
];

export type PasswordCheck = {
  requirements: { id: string; label: string; met: boolean }[];
  allMet: boolean;
};

/** Toets een wachtwoord tegen álle eisen — geschikt voor de realtime checklist
 *  én als harde poort vóór opslaan. */
export function checkPassword(pw: string): PasswordCheck {
  const requirements = PASSWORD_REQUIREMENTS.map((r) => ({
    id: r.id,
    label: r.label,
    met: r.test(pw),
  }));
  return { requirements, allMet: requirements.every((r) => r.met) };
}

/** Voldoet het wachtwoord aan het volledige beleid? */
export function passwordMeetsPolicy(pw: string): boolean {
  return PASSWORD_REQUIREMENTS.every((r) => r.test(pw));
}
