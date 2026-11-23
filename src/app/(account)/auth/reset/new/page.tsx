import type { Metadata } from "next";
import { gate, param, passwordPolicy } from "../../gate";
import { NewPassword } from "./NewPassword";

export const metadata: Metadata = { title: "Choose a new password · Shipwright" };

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  return <NewPassword token={param((await searchParams).token)} policy={await passwordPolicy()} />;
}
