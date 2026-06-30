// Pure wachtwoordsterkte (geen server-only/bcrypt) — bruikbaar in client + server.

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  ok: boolean;
};

const LABELS = ["Zeer zwak", "Zwak", "Redelijk", "Sterk", "Zeer sterk"];

export function passwordStrength(pw: string): PasswordStrength {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
  return { score, label: LABELS[score], ok: pw.length >= 8 && score >= 2 };
}
