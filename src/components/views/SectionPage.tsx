"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBlocks } from "@/components/ui/states";
import { SectionLockBanner } from "@/components/process/SectionLockBanner";
import { useProject } from "@/lib/client";
import { findSection, storeKey, type Section } from "@/lib/menu";
import { productType, sectionFor } from "@/lib/productTypes";
import { BomView } from "./BomView";
import { BuildSheetView } from "./BuildSheetView";
import { BuildsView } from "@/components/builds/BuildsView";
import { DecisionsView } from "./DecisionsView";
import { LayoutView } from "./LayoutView";
import { EnclosureView } from "@/components/enclosure/EnclosureView";
import { SchematicView } from "./SchematicView";
import { ChallengeView } from "./ChallengeView";
import { ItemsView } from "./ItemsView";
import { ModelView } from "./ModelView";
import { MonitorView } from "./MonitorView";
import { PrintFlowView } from "@/components/printing/PrintFlowView";
import { ResearchView } from "./ResearchView";
import { SocialView } from "./SocialView";
import { SourcingBoard } from "@/components/sourcing/SourcingBoard";
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
import { AdsView } from "@/components/content/AdsView";
import { LandingView } from "@/components/content/LandingView";
import { LaunchView as AnnounceView } from "@/components/content/LaunchView";
import { ListingView } from "@/components/content/ListingView";
import { CampaignsView } from "@/components/campaigns/CampaignsView";
import { LaunchView } from "@/components/campaigns/LaunchView";
import { ResultsView } from "@/components/campaigns/ResultsView";
import { LinksView } from "@/components/campaigns/LinksView";
import type { ViewProps } from "./types";
import { DraftButton } from "@/components/drafts/DraftButton";
import { SectionAssist } from "@/components/drafts/SectionAssist";

const VIEWS: Record<Section["view"], (p: ViewProps) => React.ReactNode> = {
  items: ItemsView,
  challenge: ChallengeView,
  research: ResearchView,
  model: ModelView,
  bom: BomView,
  sourcing: SourcingBoard,
  printing: PrintFlowView,
  monitor: MonitorView,
  social: SocialView,
  decisions: DecisionsView,
  schematic: SchematicView,
  layout: LayoutView,
  enclosure: EnclosureView,
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
  ads: AdsView,
  landing: LandingView,
  listing: ListingView,
  announce: AnnounceView,
  campaigns: CampaignsView,
  launch: LaunchView,
  results: ResultsView,
  links: LinksView,
};

export function SectionPage({ stageKey, sectionKey }: { stageKey: string; sectionKey: string }) {
  const { project, loading } = useProject();
  const found = findSection(stageKey, sectionKey);
  if (!found) return <p className="p-8 text-sm text-secondary">That section does not exist.</p>;
  // The concept list carries each concept's product type (src/lib/api/concepts.ts, toConcept).
  const type = (project as { productType?: string } | null)?.productType ?? "";
  // The section as this concept's type shows it (its requirement columns), or the menu's while loading.
  const typed = project ? sectionFor(type, stageKey, sectionKey) : null;
  const { stage, section } = typed ?? found;
  const hidden = !!project && !typed;
  const View = VIEWS[section.view];
  return (
    <>
      <PageHeader
        eyebrow={`${String(stage.n).padStart(2, "0")} · ${stage.label}${project ? ` · ${project.name}` : ""}`}
        title={section.label}
        blurb={section.blurb}
      >
        {project && <DraftButton key={`${project.id}:${storeKey(stage, section)}`} projectId={project.id} store={storeKey(stage, section)} sectionLabel={section.label} />}
      </PageHeader>
      <div className="px-8 py-6">
        {loading ? (
          <LoadingBlocks rows={2} label="Loading the concept" />
        ) : !project ? (
          <EmptyState title="No concept yet" action={<Button asChild size="sm" variant="outline"><Link href="/new">Start a concept</Link></Button>}>Each section works on one concept.</EmptyState>
        ) : hidden ? (
          <EmptyState title={`This section is not used for the product type \u201c${productType(type).label}\u201d.`} action={<Button asChild size="sm" variant="outline"><Link href="/concepts">Change the product type</Link></Button>}>
            Its rows, if any, are kept. To show it, change the concept&apos;s product type on the Concepts page.
          </EmptyState>
        ) : (
          <>
            <SectionLockBanner projectId={project.id} stageKey={stage.key} sectionKey={section.key} />
            <SectionAssist key={`assist:${project.id}`} projectId={project.id} store={storeKey(stage, section)} />
            <View key={`${project.id}:${stage.key}/${section.key}`} project={project} stage={stage} section={section} store={storeKey(stage, section)} />
          </>
        )}
      </div>
    </>
  );
}
