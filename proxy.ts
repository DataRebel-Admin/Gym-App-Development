import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-veilige middleware-instantie: gebruikt alleen de gedeelde config
// (geen adapter/nodemailer). De `authorized`-callback beschermt /member en
// /owner op basis van rol.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Draai op alle routes behalve Next.js-internals, de auth-API en statics.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
