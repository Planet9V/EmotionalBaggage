// @vitest-environment jsdom
// New print job: the enclosure saved on the Enclosure page is the first choice, and "Send to printing"
// opens the dialog with its file already chosen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { NewJobDialog, enclosureFirst } from "@/components/printing/NewJobDialog";
import type { FileMeta } from "@/lib/types";
import { renderWithClient, shimBrowser } from "../admin-ui/harness";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

beforeEach(shimBrowser);
afterEach(() => cleanup());

const file = (id: number, name: string, meta: Record<string, unknown> = {}): FileMeta => ({ id, name, mime: "model/stl", kind: name.split(".").pop()!, size: 10, sha256: "x", meta, createdAt: "2026-11-21" });
const FILES = [
  file(1, "bracket.stl"),
  file(2, "old-case.stl"),
  file(3, "enclosure-casemaker-aaaa0000.3mf", { enclosure: true, at: "2026-11-20T10:00:00Z" }),
  file(4, "enclosure-casemaker-bbbb1111.3mf", { enclosure: true, at: "2026-11-21T10:00:00Z" }),
  file(5, "x.gcode.3mf"),
];

describe("New print job", () => {
  it("lists the Enclosure page's files first, newest first, then other case-like files, then the rest", () => {
    const { enclosure, rest } = enclosureFirst(FILES);
    expect(enclosure.map((f) => f.id)).toEqual([4, 3, 2]);
    expect(rest.map((f) => f.id)).toEqual([1]);
  });

  it("opens with the file it was sent, and names the latest saved enclosure", async () => {
    renderWithClient(<NewJobDialog open onOpenChange={() => {}} files={FILES} parts={[]} builds={[]} printers={[]} slicer={undefined} onCreate={async () => {}} initialFileId="4" />);
    const select = (await screen.findByLabelText("File to print")) as HTMLSelectElement;
    expect(select.value).toBe("4");
    expect(select.options[1].textContent).toMatch(/enclosure-casemaker-bbbb1111\.3mf \(saved last on the Enclosure page\)/);
    expect((screen.getByLabelText("Job name") as HTMLInputElement).value).toBe("enclosure-casemaker-bbbb1111");
  });
});
