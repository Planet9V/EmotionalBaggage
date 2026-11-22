// @vitest-environment jsdom
// The sidebar's Whole concept group and the two pages, in jsdom with a stand-in API: "Concept story" first and
// "Files" after Chat; the story reads as sections with headings, a pull-out and examples; empty parts say what
// they will hold; the Files page lists files by folder with search and sort, opens a file with its details, what
// cites it and a preview, and empty states say how to add one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { adminServer, on, renderWithClient, shimBrowser } from "../admin-ui/harness";
import { ProcessContext } from "../process/processContext";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/story", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { Shell } from "@/components/Shell";
import { StoryView } from "@/components/story/StoryView";
import { FilesView } from "@/components/story/FilesView";
import { fireEvent } from "@testing-library/react";

const item = (id: number, section: string, title: string, body: string, data: Record<string, unknown>, status = "written") => ({ id, projectId: "toy", section, title, body, data, status, sort: id });
const SOURCE = item(1, "concept/files", "idea.md", "The original idea", { kind: "chat", origin: "A chat", fileName: "idea.md", fileId: 9, size: 2048, addedBy: "demo", addedAt: "2026-11-21T10:00:00Z", folder: "Idea and naming", chunks: 1, chars: 40 }, "stored");
const SCHEMA = item(6, "concept/files", "db_schema.sql", "The schema", { kind: "other", fileName: "db_schema.sql", fileId: 10, size: 5040, addedAt: "2026-11-20T10:00:00Z", folder: "Web platform" }, "stored");
const PITCH = item(2, "concept/story", "The pitch", "A puck that **heckles** the trip.", { part: "pitch", sourceIds: [1] });
const POS = item(3, "concept/story", "Positioning", "Demonstrate, never explain.", { part: "positioning", position: "A comedy device that happens to be a gadget." });
const VOICE = item(4, "concept/story", "Voice, humour and personality", "Deadpan host, chaotic bag.", { part: "voice", examples: [{ text: "Are you calling me FAT?", context: "At the scale" }] });
const WHY = item(5, "concept/story", "Why it should work", "Shared misery.", { part: "why", claims: [{ text: "Gag gifts sell for $12 to $15.", basis: "sourced", note: "Stated in the source, not checked.", sourceIds: [1] }] });

function api(story: unknown[], sources: unknown[]) {
  return adminServer([
    on("GET", "/api/projects", () => ({ body: { projects: [{ id: "toy", name: "Toy", oneLiner: "A toy" }] } })),
    on("GET", "/api/projects/toy/items?section=concept%2Fstory", () => ({ body: { items: story } })),
    on("GET", "/api/projects/toy/items?section=concept%2Ffiles", () => ({ body: { items: sources } })),
    on("GET", "/api/projects/toy/items", () => ({ body: { items: [] } }), true),
    on("GET", "/api/projects/toy/sources", () => ({ body: { sources: sources.map((s) => ({ item: s, citedBy: [{ itemId: 2, title: "The pitch", section: "concept/story", how: "cites" }] })) } })),
    on("GET", "/api/projects/toy/sources?q=", (c) => ({ body: { sources: c.path.includes("q=zzz") ? [] : sources.map((s) => ({ item: s, citedBy: [] })) } }), true),
    on("GET", "/api/files/9", () => ({ body: "# Idea\n\nA suitcase that complains." })),
    on("GET", "/api/projects/toy/process", () => ({ status: 500, body: { error: "not in this test" } })),
    on("GET", "/api/drafts/generators", () => ({ body: { configured: false, reason: "No reasoning model is chosen.", model: "", generators: [] } }), true),
    on("GET", "/api/auth/me", () => ({ body: { user: { username: "demo", usingDefaultPassword: false } } })),
  ]);
}

beforeEach(() => {
  shimBrowser();
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sidebar", () => {
  it("opens Whole concept with Status, then Concept story, and Files after Chat", async () => {
    api([], []);
    renderWithClient(<Shell><p>page</p></Shell>);
    const nav = (await screen.findAllByRole("navigation", { name: "Whole concept" }))[0];
    const links = within(nav).getAllByRole("link").map((a) => [a.textContent?.trim(), a.getAttribute("href")]);
    expect(links[0]).toEqual(["Status", "/status"]);
    expect(links[1]).toEqual(["Concept story", "/story"]);
    const chat = links.findIndex(([, h]) => h === "/chat");
    expect(links[chat + 1]).toEqual(["Files", "/files"]);
    // the stage list does not repeat them
    const stages = (await screen.findAllByRole("navigation", { name: "Stages" }))[0];
    expect(within(stages).queryByRole("link", { name: "Concept story" })).toBeNull();
  });
});

describe("Concept story page", () => {
  it("reads as sections with headings, a pull-out position, examples and marked claims", async () => {
    api([PITCH, POS, VOICE, WHY], [SOURCE]);
    renderWithClient(<ProcessContext projectId="toy"><StoryView /></ProcessContext>);
    expect(await screen.findByRole("heading", { level: 2, name: "The pitch" })).toBeTruthy();
    expect(screen.getByText("heckles").tagName).toBe("STRONG");
    expect(screen.getByText("A comedy device that happens to be a gadget.").closest("figure")).toBeTruthy();
    expect(screen.getByText("The one-line position")).toBeTruthy();
    expect(screen.getByText(/Are you calling me FAT\?/).closest("figure")?.textContent).toContain("At the scale");
    const claims = screen.getByRole("list", { name: "The claims, and how each is known" });
    expect(within(claims).getByText("Sourced")).toBeTruthy();
    expect(within(claims).getByText(/Stated in the source, not checked/)).toBeTruthy();
    expect(within(claims).getByRole("link", { name: "idea.md" }).getAttribute("href")).toBe("/files#file-1");
    // a part with no row says what it will hold
    const origin = screen.getByRole("region", { name: "Where the idea came from" });
    expect(origin.textContent).toContain("Not written yet. The moment, the itch or the joke that started it");
    expect(within(origin).getByRole("button", { name: "Write Where the idea came from" })).toBeTruthy();
  });

  it("with nothing written and no files, says how to start", async () => {
    api([], []);
    renderWithClient(<ProcessContext projectId="toy"><StoryView /></ProcessContext>);
    expect(await screen.findByText("The story is not written yet")).toBeTruthy();
    expect(screen.getByText("No files yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Files" }).getAttribute("href")).toBe("/files#add-file");
  });
});

describe("Files page", () => {
  it("lists files by folder, searches, sorts, and opens a file with its details, what cites it and a preview", async () => {
    api([PITCH], [SOURCE, SCHEMA]);
    renderWithClient(<ProcessContext projectId="toy"><FilesView /></ProcessContext>);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("button").map((b) => b.textContent)).toEqual(["db_schema.sql", "idea.md"]);
    expect(screen.getByText(/Up to 25 MB a file/)).toBeTruthy();
    // folders
    const folders = screen.getByRole("navigation", { name: "Folders" });
    fireEvent.click(within(folders).getByRole("button", { name: /Web platform/ }));
    expect(within(screen.getByRole("table")).queryByText("idea.md")).toBeNull();
    fireEvent.click(within(folders).getByRole("button", { name: /All files/ }));
    // sort by size, largest first
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "size" } });
    expect(within(screen.getByRole("table")).getAllByRole("button")[0].textContent).toBe("db_schema.sql");
    // search by content goes to the server
    fireEvent.change(screen.getByLabelText("Search by name or content"), { target: { value: "zzz" } });
    expect(await screen.findByText(/No file's name or text matches "zzz"/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search by name or content"), { target: { value: "" } });
    // details
    fireEvent.click(await screen.findByRole("button", { name: "idea.md" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toMatch(/Added: .*2026 by demo/);
    expect(dialog.textContent).toContain("Where it came from: A chat");
    expect(within(dialog).getByRole("link", { name: /The pitch/ }).getAttribute("href")).toBe("/story#story-pitch");
    expect(within(dialog).getByRole("link", { name: "Download" }).getAttribute("href")).toBe("/api/files/9");
    expect(within(dialog).getByRole("button", { name: "Replace with a new version" })).toBeTruthy();
    expect(await within(dialog).findByText(/A suitcase that complains/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(within(dialog).getByRole("alertdialog").textContent).toContain("recorded in the history");
  });

  it("with no files, says what will appear and how to add one", async () => {
    api([], []);
    renderWithClient(<ProcessContext projectId="toy"><FilesView /></ProcessContext>);
    expect(await screen.findByText("No files yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Paste text as a file" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose files" })).toBeTruthy();
  });
});
