import type { Metadata } from "next";
import { gate, param } from "../gate";
import { CheckEmail } from "./CheckEmail";

export const metadata: Metadata = { title: "Check your email · Concept to Realization" };

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  const email = param((await searchParams).email);
  return <CheckEmail email={email && email.length <= 254 && email.includes("@") ? email : null} />;
}
