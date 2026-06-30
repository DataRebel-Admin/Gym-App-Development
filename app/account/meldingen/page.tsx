import { getAccountUser } from "@/lib/account";
import { NotificationsForm } from "./notifications-form";

export default async function NotificationsPage() {
  const user = await getAccountUser();
  const initial =
    user.notificationPrefs && typeof user.notificationPrefs === "object"
      ? (user.notificationPrefs as Record<string, Record<"email" | "inApp" | "push", boolean>>)
      : null;

  return <NotificationsForm initial={initial} />;
}
