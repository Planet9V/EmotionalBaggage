// @vitest-environment jsdom
// The chat screen: a question whose answer never arrived is marked and can be asked again, and the empty
// state's suggested questions wrap instead of being cut off at the edge.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatThread, toUIMessages } from "@/components/chat/ChatThread";
import { EmptyThread } from "@/components/chat/parts";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
  Element.prototype.scrollTo ??= () => {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const wrap = (ui: React.ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

describe("a question without an answer", () => {
  const initial = toUIMessages([{ id: 5, role: "user", content: "What does the load cell weigh?", sources: [], model: "", retrieval: "", createdAt: "" }]);

  it("is marked, and Ask again sends the same question once", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "No reasoning model is chosen." }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    render(wrap(<ChatThread chatId={1} projectId="p" initial={initial} suggestions={[]} conceptName="Bag" />));
    expect(screen.getByText("This question has no answer.")).toBeTruthy();
    expect(screen.getAllByText("What does the load cell weigh?")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Ask again/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ message: "What does the load cell weigh?" });
    // the question is not added to the screen a second time
    await waitFor(() => expect(screen.getByText("The answer could not be completed.")).toBeTruthy());
    expect(screen.getAllByText("What does the load cell weigh?")).toHaveLength(1);
  });

  it("is not marked when the last message is an answer", () => {
    const withAnswer = toUIMessages([
      { id: 5, role: "user", content: "Q", sources: [], model: "", retrieval: "", createdAt: "" },
      { id: 6, role: "assistant", content: "A", sources: [], model: "m", retrieval: "text", createdAt: "" },
    ]);
    render(wrap(<ChatThread chatId={1} projectId="p" initial={withAnswer} suggestions={[]} conceptName="Bag" />));
    expect(screen.queryByText("This question has no answer.")).toBeNull();
    expect(screen.getByText(/Sources found by matching words/)).toBeTruthy();
  });

  it("says plainly when an older answer did not record how its sources were found", () => {
    const old = toUIMessages([
      { id: 5, role: "user", content: "Q", sources: [], model: "", retrieval: "", createdAt: "" },
      { id: 6, role: "assistant", content: "A", sources: [], model: "m", retrieval: "", createdAt: "" },
    ]);
    render(wrap(<ChatThread chatId={1} projectId="p" initial={old} suggestions={[]} conceptName="Bag" />));
    expect(screen.getByText(/was not recorded for this answer/)).toBeTruthy();
  });
});

describe("empty state", () => {
  it("lays the suggestions out wrapped, all three reachable", () => {
    render(<EmptyThread conceptName="Bag" suggestions={["One?", "Two?", "Summarise the Requirements in five lines."]} onPick={() => {}} />);
    const group = screen.getByRole("group", { name: "Suggested questions" });
    expect(group.className).toContain("flex-wrap");
    expect(group.querySelectorAll("button")).toHaveLength(3);
  });
});
