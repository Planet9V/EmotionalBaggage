import type { Metadata } from "next";
import { gate, mailOn, nextOf, param } from "../gate";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Create an account · Concept to Realization" };

/** `email` and `next` come from an invitation page: the address is filled in and the person comes back to it. */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  const sp = await searchParams;
  const email = param(sp.email);
  const next = param(sp.next);
  return <SignUpForm email={email && email.length <= 254 ? email : ""} next={next ? nextOf(next) : null} mail={await mailOn()} />;
}
