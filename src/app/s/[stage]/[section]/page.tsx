import { SectionPage } from "@/components/views/SectionPage";
import { STAGES } from "@/lib/menu";

export function generateStaticParams() {
  return STAGES.flatMap((st) => st.sections.map((s) => ({ stage: st.key, section: s.key })));
}

export default async function Page({ params }: { params: Promise<{ stage: string; section: string }> }) {
  const { stage, section } = await params;
  return <SectionPage stageKey={stage} sectionKey={section} />;
}
