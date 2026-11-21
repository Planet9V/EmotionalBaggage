// @vitest-environment jsdom
// U14: the overview lists the same sections as the sidebar; a section the product type hides is not listed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const project = { id: "c1", name: "Cable comb", oneLiner: "", productType: "physical" };
vi.mock("@/lib/client", () => ({ useProject: () => ({ project, loading: false }) }));
vi.mock("@/components/plan/useConcept", () => ({
  useConcept: () => ({ data: { items: [{ id: 1, projectId: "c1", section: "concept/brief", title: "x", body: "", data: {}, status: "open", sort: 1 }], events: [] }, errors: [], loading: false }),
}));
vi.mock("@/components/process/NextStepCard", () => ({ NextStepCard: () => null }));
vi.mock("@/components/plan/computedSections", () => ({ ComputedSections: () => null }));
vi.mock("@/components/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

import { OverviewView } from "@/components/views/OverviewView";
import { productType } from "@/lib/productTypes";

afterEach(cleanup);

describe("the overview", () => {
  it("hides the sections the product type hides", () => {
    render(<OverviewView />);
    const stages = screen.getByRole("list", { name: "Stages" });
    const hidden = productType("physical").hidden;
    expect(hidden.length).toBeGreaterThan(0);
    for (const key of hidden) expect(stages.querySelector(`a[href="/s/${key}"]`)).toBeNull();
    expect(stages.querySelector('a[href="/s/concept/brief"]')).not.toBeNull();
  });
});
