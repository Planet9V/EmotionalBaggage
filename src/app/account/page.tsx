import type { Metadata } from "next";
import { ChangePassword } from "./ChangePassword";

export const metadata: Metadata = { title: "Account · Concept to Realization" };

export default function Page() {
  return <ChangePassword />;
}
