// @vitest-environment jsdom
// The New concept wizard (Stepperize + react-hook-form + zod): each step is held by its own schema, the product
// type is asked first, and the concept is created with it, then the person lands on the first next step.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const push = vi.fn();
const replace = vi.fn();
const mutateAsync = vi.fn(async () => ({ id: "c1" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/" }));
vi.mock("@/lib/client", () => ({ useProject: () => ({ select: vi.fn() }) }));
vi.mock("@/lib/conceptsClient", () => ({ useCreateConcept: () => ({ mutateAsync }) }));
vi.mock("@/components/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/lib/process/client", () => ({
  processQuery: () => ({ queryKey: ["p"], queryFn: async () => ({}) }),
  processView: () => ({ next: { href: "/concept/questions" } }),
}));
vi.mock("@/lib/queries", () => ({ queries: { items: () => ({ queryKey: ["i"], queryFn: async () => [] }) } }));

import { WizardView } from "@/components/views/WizardView";
import { emptyAnswers, firstProblem } from "@/components/wizard/model";

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WizardView />
    </QueryClientProvider>,
  );
afterEach(() => {
  cleanup();
  push.mockClear();
  replace.mockClear();
  mutateAsync.mockClear();
});

describe("wizard model", () => {
  it("names the first step that is not complete", () => {
    expect(firstProblem(emptyAnswers())).toMatchObject({ step: "idea", message: "Give the concept a name." });
    expect(firstProblem({ ...emptyAnswers(), name: "Lamp", oneLiner: "A lamp" })).toBeNull();
  });
});

describe("WizardView", () => {
  it("asks for the product type first and will not move on without a name", async () => {
    renderIt();
    expect(screen.getByRole("radio", { name: /^Electronics/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => expect(screen.getAllByRole("alert").map((e) => e.textContent)).toEqual(["Give the concept a name.", "Add a one-line description."]));
    expect(screen.getByText(/Step 01 of 06/)).toBeTruthy();
  });

  it("creates the concept with its product type and goes to the first next step", async () => {
    renderIt();
    fireEvent.click(screen.getByRole("radio", { name: /^Printed/i }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Lamp" } });
    fireEvent.change(screen.getByLabelText(/^One-line description/), { target: { value: "A desk lamp" } });
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await waitFor(() => expect(screen.getByText(new RegExp(`Step 0${i + 2} of 06`))).toBeTruthy());
    }
    fireEvent.click(screen.getByRole("button", { name: /Create the concept/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/concept/questions"));
    expect(push).not.toHaveBeenCalled();
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ name: "Lamp", productType: "printed" }));
  });

  it("moves focus to the new step's heading on every step change (U7)", async () => {
    renderIt();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Lamp" } });
    fireEvent.change(screen.getByLabelText(/^One-line description/), { target: { value: "A desk lamp" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Who and why"));
    expect(document.activeElement?.tagName).toBe("H2");
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Product"));
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Who and why"));
  });
});
