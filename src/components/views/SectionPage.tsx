"use client";

import { PageHeader } from "@/components/PageHeader";
import { useProject } from "@/lib/client";
import { findSection, storeKey, type Section } from "@/lib/menu";
import { BomView } from "./BomView";
import { BuildSheetView } from "./BuildSheetView";
import { BuildsView } from "@/components/builds/BuildsView";
import { DecisionsView } from "./DecisionsView";
import { LayoutView } from "./LayoutView";
import { SchematicView } from "./SchematicView";
import { ChallengeView } from "./ChallengeView";
import { ItemsView } from "./ItemsView";
import { ModelView } from "./ModelView";
import { MonitorView } from "./MonitorView";
import { PrintingView } from "./PrintingView";
import { ResearchView } from "./ResearchView";
import { SocialView } from "./SocialView";
import { SourcingView } from "./SourcingView";
import { BatchesView } from "@/components/production/BatchesView";
import { PartPricesView } from "@/components/production/PartPricesView";
import { ComplianceView } from "@/components/compliance/ComplianceView";
import { EconomicsView } from "@/components/economics/EconomicsView";
import { BrandView } from "@/components/market/BrandView";
import { CompetitorsView } from "@/components/market/CompetitorsView";
import { ImageryView } from "@/components/market/ImageryView";
import { NamesView } from "@/components/market/NamesView";
import { PersonasView } from "@/components/market/PersonasView";
import { PositioningView } from "@/components/market/PositioningView";
import { PricingView } from "@/components/market/PricingView";
import type { ViewProps } from "./types";

const VIEWS: Record<Section["view"], (p: ViewProps) => React.ReactNode> = {
  items: ItemsView,
  challenge: ChallengeView,
  research: ResearchView,
  model: ModelView,
  bom: BomView,
  sourcing: SourcingView,
  printing: PrintingView,
  monitor: MonitorView,
  social: SocialView,
  decisions: DecisionsView,
  schematic: SchematicView,
  layout: LayoutView,
  buildsheet: BuildSheetView,
  builds: BuildsView,
  economics: EconomicsView,
  batches: BatchesView,
  partprices: PartPricesView,
  compliance: ComplianceView,
  personas: PersonasView,
  competitors: CompetitorsView,
  positioning: PositioningView,
  pricing: PricingView,
  names: NamesView,
  brand: BrandView,
  imagery: ImageryView,
};

export function SectionPage({ stageKey, sectionKey }: { stageKey: string; sectionKey: string }) {
  const { project, loading } = useProject();
  const found = findSection(stageKey, sectionKey);
  if (!found) return <p className="p-8 text-sm text-secondary">That section does not exist.</p>;
  const { stage, section } = found;
  const View = VIEWS[section.view];
  return (
    <>
      <PageHeader
        eyebrow={`${String(stage.n).padStart(2, "0")} · ${stage.label}${project ? ` · ${project.name}` : ""}`}
        title={section.label}
        blurb={section.blurb}
      />
      <div className="px-8 py-6">
        {loading ? (
          <p className="text-sm text-secondary">Loading the concept.</p>
        ) : !project ? (
          <p className="text-sm text-secondary">No concept yet. Use New concept to start one.</p>
        ) : (
          <View key={`${project.id}:${stage.key}/${section.key}`} project={project} stage={stage} section={section} store={storeKey(stage, section)} />
        )}
      </div>
    </>
  );
}
