import type { Metadata } from "next";
import { connection } from "next/server";
import { defaultPasswordInUse } from "@/lib/auth";
import { safeNext } from "./shared";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in · Concept to Realization" };

/**
 * The sign-in page. It renders without the app shell (see src/components/Shell.tsx), reads on the
 * server whether the published default password is still in use, and hands the form a `next`
 * address that has already been checked to be a path on this site.
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  let showDefault = false;
  try {
    showDefault = await defaultPasswordInUse();
  } catch {
    // The database could not be reached: the form still renders, and signing in reports the problem.
  }
  return <SignInForm next={next} showDefault={showDefault} />;
}
