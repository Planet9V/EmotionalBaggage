import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { exampleData } from "@/components/welcome/exampleData";
import { storyData } from "@/components/welcome/storyData";
import { firstRunForm, firstRunOpen } from "@/lib/auth2/firstRun";
import { ownerPool } from "@/lib/db";
import { gate } from "../gate";
import { FirstRun } from "./FirstRun";

export const metadata: Metadata = { title: "Create the owner · Concept to Realization" };

/**
 * "Create the owner", for a self-hosted install with no account yet (src/lib/auth2/firstRun.ts). Not found once any
 * account exists. The introduction beside the form is the welcome page's own hero (HeroStage), drawn from the
 * example's seeded rows: no new imagery.
 */
export default async function FirstRunPage() {
  await gate();
  const db = ownerPool();
  if (!(await firstRunOpen(db))) notFound();
  const form = await firstRunForm(db);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (host.startsWith("localhost") ? "http" : "https");
  const story = storyData(await exampleData());
  return <FirstRun email={form.email} address={form.needsAddress ? `${proto}://${host}` : null} idea={story.origin.idea} facts={story.hero} product={story.product} />;
}
