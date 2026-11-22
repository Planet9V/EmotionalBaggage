import type { Metadata } from "next";
import { headers } from "next/headers";
import { invitationByToken, type Invitation } from "@/lib/auth2/workspaces/invitations";
import { auth2Session } from "@/lib/auth2/server";
import { ownerPool } from "@/lib/db";
import { gate, param } from "../gate";
import { InviteView } from "./InviteView";

// The token is in this page's address: it must not travel to another site in a Referer header.
export const metadata: Metadata = { title: "Invitation · Concept to Realization", referrer: "no-referrer" };

/** An invitation link from an email (or handed over in "no mail" mode): what it is for, and how to accept it. */
export default async function InvitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  const token = param((await searchParams).token) ?? "";
  let invitation: Invitation | null = null;
  try {
    invitation = await invitationByToken(ownerPool(), token);
  } catch {
    invitation = null;
  }
  const s = invitation ? await auth2Session(await headers()) : null;
  return <InviteView token={token} invitation={invitation} signedInAs={s?.user.email ?? null} />;
}
