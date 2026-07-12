-- Wachtwoord-reset via e-mail: eenmalige, kortlevende token + vervaldatum op User.
-- Patroon gelijk aan de e-mailwijziging-token (emailChangeToken/emailChangeExpires).
-- Kolommen op bestaand model → geen RLS-wijziging nodig.

ALTER TABLE "User"
  ADD COLUMN "passwordResetToken" TEXT,
  ADD COLUMN "passwordResetExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");
