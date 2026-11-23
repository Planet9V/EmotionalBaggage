import type { Metadata } from "next";
import { gate, param, passwordPolicy } from "../../gate";
import { FirstPassword } from "./FirstPassword";

export const metadata: Metadata = { title: "Choose your password · Concept to Realization" };

/** After an administrator set a temporary password: the person chooses their own before any session starts. */
export default async function FirstPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  const email = param((await searchParams).email) ?? "";
  return <FirstPassword email={email.length <= 254 ? email : ""} policy={await passwordPolicy()} />;
}
