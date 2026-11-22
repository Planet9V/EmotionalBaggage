import type { Metadata } from "next";
import { gate } from "../gate";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Create an account · Concept to Realization" };

export default async function SignUpPage() {
  await gate();
  return <SignUpForm />;
}
