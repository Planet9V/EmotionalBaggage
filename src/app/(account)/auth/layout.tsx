import type { Metadata } from "next";
import { gate } from "./gate";

export const metadata: Metadata = { title: "Account · Concept to Realization", robots: { index: false } };

/** The new sign-in's screens (AUTH2). Rendered without the app shell, like /sign-in (src/components/Shell.tsx). */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await gate();
  return children;
}
