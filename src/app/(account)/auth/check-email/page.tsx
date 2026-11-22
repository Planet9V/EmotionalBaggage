import type { Metadata } from "next";
import { gate, mailOn, nextOf, param } from "../gate";
import { CheckEmail } from "./CheckEmail";

export const metadata: Metadata = { title: "Check your email · Concept to Realization" };

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  const sp = await searchParams;
  const email = param(sp.email);
  const next = param(sp.next);
  return <CheckEmail email={email && email.length <= 254 && email.includes("@") ? email : null} next={next ? nextOf(next) : null} mail={await mailOn()} />;
}
