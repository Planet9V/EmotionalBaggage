import type { Metadata } from "next";
import { ConceptsView } from "@/components/concepts/ConceptsView";

export const metadata: Metadata = { title: "Concepts · Shipwright" };

export default function Page() {
  return <ConceptsView />;
}
