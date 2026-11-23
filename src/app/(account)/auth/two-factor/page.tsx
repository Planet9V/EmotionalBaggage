import type { Metadata } from "next";
import { gate, nextOf, param } from "../gate";
import { CodeForm } from "./CodeForm";

export const metadata: Metadata = { title: "Enter your code · Shipwright" };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gate();
  return <CodeForm next={nextOf(param((await searchParams).next))} />;
}
