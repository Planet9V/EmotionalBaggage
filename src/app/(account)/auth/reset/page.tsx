import type { Metadata } from "next";
import { NotSetUp } from "../_components/NotSetUp";
import { gate, mailOn, setupPending } from "../gate";
import { ResetRequest } from "./ResetRequest";

export const metadata: Metadata = { title: "Reset your password · Shipwright" };

export default async function ResetPage() {
  await gate();
  if (await setupPending()) return <NotSetUp />;
  return <ResetRequest mail={await mailOn()} />;
}
