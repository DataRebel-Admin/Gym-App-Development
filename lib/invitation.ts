import "server-only";
import { randomBytes } from "node:crypto";
import { graphConfigured, sendMailViaGraph } from "@/lib/email/graph";

/** 32-hex-karakter uitnodigingstoken. */
export function inviteToken(): string {
  return randomBytes(16).toString("hex");
}

/** Vervaldatum: 7 dagen vanaf nu. */
export function inviteExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function inviteHtml(tenantName: string, acceptUrl: string): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#171717">Uitnodiging voor ${tenantName}</h1>
    <p style="color:#525252;line-height:1.5">
      Je bent uitgenodigd om een account te activeren bij <strong>${tenantName}</strong> op GymRebel.
      Klik op de knop hieronder om je uitnodiging te accepteren.
    </p>
    <p style="margin:24px 0">
      <a href="${acceptUrl}" style="background:#171717;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">
        Uitnodiging accepteren
      </a>
    </p>
    <p style="color:#a3a3a3;font-size:12px">Werkt de knop niet? Plak deze link in je browser:<br>${acceptUrl}</p>
  </div>`;
}

/**
 * Verstuur de uitnodigingsmail. Met Microsoft Graph geconfigureerd gaat 'ie echt
 * de deur uit; anders (dev) naar de server-console — net als de magic link.
 */
export async function sendInviteEmail(opts: {
  email: string;
  tenantName: string;
  acceptUrl: string;
}): Promise<void> {
  if (graphConfigured()) {
    try {
      await sendMailViaGraph({
        to: opts.email,
        subject: `Uitnodiging voor ${opts.tenantName}`,
        html: inviteHtml(opts.tenantName, opts.acceptUrl),
      });
      return;
    } catch (err) {
      // Niet de hele actie laten klappen op een mailfout; loggen + door.
      console.error("✗ Graph-mail mislukt, fallback naar console:", (err as Error).message);
    }
  }
  console.log(
    "\n✉️  [GymRebel] Uitnodiging voor " +
      opts.email +
      " (" +
      opts.tenantName +
      "):\n" +
      opts.acceptUrl +
      "\n"
  );
}
