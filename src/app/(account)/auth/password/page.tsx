import type { Metadata } from "next";
import { requireAccount } from "../gate";
import { ChangePassword } from "./ChangePassword";

export const metadata: Metadata = { title: "Change your password · Concept to Realization" };

export default async function PasswordPage() {
  await requireAccount("/auth/password");
  return <ChangePassword />;
}
