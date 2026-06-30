import { getAccountUser } from "@/lib/account";
import { vapidPublicKey } from "@/lib/push";
import { NotificationsForm } from "./notifications-form";
import { PushToggle } from "./push-toggle";

export const metadata = { title: "Meldingen" };

export default async function NotificationsPage() {
  const user = await getAccountUser();
  const initial =
    user.notificationPrefs && typeof user.notificationPrefs === "object"
      ? (user.notificationPrefs as Record<string, Record<"email" | "inApp" | "push", boolean>>)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <NotificationsForm initial={initial} />
      <PushToggle vapidPublicKey={vapidPublicKey()} />
    </div>
  );
}
