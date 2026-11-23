import type { Metadata } from "next";
import { ChangePassword } from "./ChangePassword";

export const metadata: Metadata = { title: "Account · Shipwright" };

export default function Page() {
  return <ChangePassword />;
}
