import type { Metadata } from "next";
import { ConceptsView } from "@/components/concepts/ConceptsView";

export const metadata: Metadata = { title: "Concepts · Concept to Realization" };

export default function Page() {
  return <ConceptsView />;
}
