import type { Metadata } from "next";
import { gate, nextOf, param, setupPending } from "../gate";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in · Concept to Realization" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  return <SignInForm next={nextOf(param((await searchParams).next))} setupPending={await setupPending()} />;
}
