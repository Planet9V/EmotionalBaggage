import type { Metadata } from "next";
import { gate, param } from "../gate";
import { ConfirmEmail } from "./ConfirmEmail";

export const metadata: Metadata = { title: "Confirm your email address · Concept to Realization" };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  return <ConfirmEmail token={param((await searchParams).token)} />;
}
