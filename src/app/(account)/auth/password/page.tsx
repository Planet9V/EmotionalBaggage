import type { Metadata } from "next";
import { passwordPolicy, requireAccount } from "../gate";
import { ChangePassword } from "./ChangePassword";

export const metadata: Metadata = { title: "Change your password · Shipwright" };

export default async function PasswordPage() {
  const s = await requireAccount("/auth/password", { owedOk: true });
  return <ChangePassword policy={await passwordPolicy()} who={{ email: s.user.email, name: s.user.name }} />;
}
