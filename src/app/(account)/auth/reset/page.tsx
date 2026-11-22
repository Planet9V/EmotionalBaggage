import type { Metadata } from "next";
import { gate, mailOn } from "../gate";
import { ResetRequest } from "./ResetRequest";

export const metadata: Metadata = { title: "Reset your password · Concept to Realization" };

export default async function ResetPage() {
  await gate();
  return <ResetRequest mail={await mailOn()} />;
}
