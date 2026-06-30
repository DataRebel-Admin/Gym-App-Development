import { getAccountUser } from "@/lib/account";
import { ProfileForm } from "./profile-form";

export default async function AccountProfilePage() {
  const user = await getAccountUser();

  return (
    <ProfileForm
      user={{
        email: user.email,
        pendingEmail: user.pendingEmail,
        emailVerified: Boolean(user.emailVerified),
        firstName: user.firstName,
        lastName: user.lastName,
        jobTitle: user.jobTitle,
        phone: user.phone,
        timezone: user.timezone,
        locale: user.locale,
        image: user.image,
        name: user.name,
      }}
    />
  );
}
