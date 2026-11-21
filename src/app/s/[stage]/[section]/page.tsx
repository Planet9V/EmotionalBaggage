import { notFound } from "next/navigation";
import { SectionPage } from "@/components/views/SectionPage";
import { findSection, STAGES } from "@/lib/menu";

export function generateStaticParams() {
  return STAGES.flatMap((st) => st.sections.map((s) => ({ stage: st.key, section: s.key })));
}

export default async function Page({ params }: { params: Promise<{ stage: string; section: string }> }) {
  const { stage, section } = await params;
  // An unknown section is a 404 with the app's own not-found page (src/app/not-found.tsx).
  if (!findSection(stage, section)) notFound();
  return <SectionPage stageKey={stage} sectionKey={section} />;
}
