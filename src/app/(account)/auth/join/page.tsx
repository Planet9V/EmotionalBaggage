import type { Metadata } from "next";
import { byToken } from "@/lib/auth2/accountInvitations";
import { ownerPool } from "@/lib/db";
import { NotSetUp } from "../_components/NotSetUp";
import { gate, param, passwordPolicy, setupPending } from "../gate";
import { JoinView } from "./JoinView";

// The token is in this page's address: it must not travel to another site in a Referer header.
export const metadata: Metadata = { title: "Your invitation · Concept to Realization", referrer: "no-referrer" };

/** The link in an account invitation (src/lib/auth2/accountInvitations.ts): choose a password, or why it cannot be used. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  if (await setupPending()) return <NotSetUp />;
  const token = param((await searchParams).token) ?? "";
  return <JoinView token={token} view={await byToken(ownerPool(), token)} policy={await passwordPolicy()} />;
}
