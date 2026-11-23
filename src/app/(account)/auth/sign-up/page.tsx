import type { Metadata } from "next";
import { NotSetUp } from "../_components/NotSetUp";
import { gate, mailOn, nextOf, param, passwordPolicy, setupPending } from "../gate";
import { SignUpForm } from "./SignUpForm";
import { RequestAccount } from "./RequestAccount";
import { readRules } from "@/lib/auth2/rules";
import { invitationByToken } from "@/lib/auth2/workspaces/invitations";
import { ownerPool } from "@/lib/db";

export const metadata: Metadata = { title: "Create an account · Shipwright" };

/** `email` and `next` come from an invitation page: the address is filled in and the person comes back to it. */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  if (await setupPending()) return <NotSetUp />;
  const sp = await searchParams;
  const email = param(sp.email);
  const next = param(sp.next);
  const shown = email && email.length <= 254 ? email : "";
  // Closed (the default during early access): only someone following an open workspace invitation for this very
  // address signs up here; everyone else asks for an account (an access request, announced to the owner).
  if (!(await readRules(ownerPool())).signUpOpen && !(await invitedHere(next, shown))) return <RequestAccount email={shown} />;
  return <SignUpForm email={email && email.length <= 254 ? email : ""} next={next ? nextOf(next) : null} mail={await mailOn()} policy={await passwordPolicy()} />;
}

/** Whether `next` is an open workspace invitation for this address (the "Create an account" link on an invitation). */
async function invitedHere(next: string | null, email: string): Promise<boolean> {
  if (!next || !email) return false;
  try {
    const token = new URL(next, "http://x").searchParams.get("token");
    const inv = await invitationByToken(ownerPool(), token);
    return inv.state === "open" && inv.email.toLowerCase() === email.toLowerCase();
  } catch {
    return false;
  }
}
