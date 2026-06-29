import { logout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
      >
        Uitloggen
      </button>
    </form>
  );
}
