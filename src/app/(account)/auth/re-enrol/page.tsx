import type { Metadata } from "next";
import { gate, param } from "../gate";
import { Reenrol } from "./Reenrol";

// The token may be in this page's address: it must not travel in a Referer header.
export const metadata: Metadata = { title: "Set up two-step sign-in again · Shipwright", referrer: "no-referrer" };

/** After someone else reset this account's two-step sign-in (review B4): the proof, then the password, then set-up. */
export default async function ReenrolPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  const sp = await searchParams;
  const token = param(sp.token);
  const email = param(sp.email);
  return <Reenrol token={token && token.length <= 100 ? token : null} email={email && email.length <= 254 ? email : ""} />;
}
