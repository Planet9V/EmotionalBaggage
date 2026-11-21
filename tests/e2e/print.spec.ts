// What comes out on paper. Each page that offers Print, or is likely to be printed, is rendered to a PDF
// under print media and read back with pdftotext: the expected headings must be there and no page may be
// blank. (The schematic's print rules once applied to every section, so the build sheet printed as
// sixteen empty pages.) Needs pdftotext and pdfinfo (poppler-utils).
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";

const dir = mkdtempSync(join(tmpdir(), "c2r-print-"));

async function pdfOf(page: Page, name: string) {
  await page.emulateMedia({ media: "print" });
  const file = join(dir, `${name}.pdf`);
  writeFileSync(file, await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  await page.emulateMedia({ media: "screen" });
  const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [file], { encoding: "utf8" }))?.[1] ?? 0);
  const perPage = Array.from({ length: pages }, (_, i) =>
    execFileSync("pdftotext", ["-f", String(i + 1), "-l", String(i + 1), "-layout", file, "-"], { encoding: "utf8" }).replace(/\s+/g, " ").trim()
  );
  return { pages, perPage, text: perPage.join(" ") };
}

function expectPrinted(out: { pages: number; perPage: string[]; text: string }, headings: string[]) {
  expect(out.pages, "the PDF has pages").toBeGreaterThan(0);
  out.perPage.forEach((t, i) => expect(t.length, `page ${i + 1} of ${out.pages} has text`).toBeGreaterThan(20));
  for (const h of headings) expect(out.text, `the printout contains "${h}"`).toContain(h);
}

const DOCUMENTS: { path: string; headings: string[]; ready?: string }[] = [
  { path: "/s/prototype/wiring", headings: ["Wiring and soldering", "Sensor power"], ready: "Sensor power" },
  { path: "/report", headings: ["Baggage Claims MK1", "Brief"], ready: "Brief" },
  { path: "/traceability", headings: ["Traceability", "Requirements by test"], ready: "Requirements by test" },
  { path: "/s/production/economics", headings: ["Unit economics", "Unit cost build-up"], ready: "Unit cost build-up" },
  { path: "/s/marketing/launch", headings: ["Launch plan"] },
];

for (const d of DOCUMENTS) {
  test(`${d.path} prints its content`, async ({ page }) => {
    await page.goto(d.path);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    if (d.ready) await expect(page.getByText(d.ready, { exact: true }).first()).toBeVisible();
    expectPrinted(await pdfOf(page, d.path.replace(/\W+/g, "_")), d.headings);
  });
}

/** Presses Print on the schematic with the dialog stubbed, renders the PDF, then ends the print as the browser would. */
async function printSchematicView(page: Page, view: "Symbols" | "Pins and wires") {
  await page.getByRole("button", { name: view, exact: true }).click();
  await expect(page.getByTestId(view === "Symbols" ? "symbol-canvas" : "pins-canvas")).toBeVisible();
  await page.waitForTimeout(800); // the canvas fits itself once node sizes are known
  await page.evaluate(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => void ((window as unknown as { __printed: number }).__printed += 1);
  });
  await page.getByRole("button", { name: "Print or PDF" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
  await expect(page.locator("html")).toHaveClass(/printing-schematic/);
  const out = await pdfOf(page, `schematic-${view === "Symbols" ? "symbols" : "pins"}`);
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("html")).not.toHaveClass(/printing-schematic/);
  return out;
}

test("the schematic prints one sheet per view, with its title block and no controls", async ({ page }) => {
  await page.goto("/s/design/schematic");
  await page.waitForLoadState("networkidle");
  const sym = await printSchematicView(page, "Symbols");
  expect(sym.pages, "the symbol view is one sheet").toBe(1);
  expectPrinted(sym, ["Baggage Claims MK1", "Schematic, symbol view", "U1"]);
  expect(sym.text).not.toContain("Press a pin or a wire");

  const pins = await printSchematicView(page, "Pins and wires");
  expect(pins.pages, "the pins-and-wires view is one sheet").toBe(1);
  expectPrinted(pins, ["Baggage Claims MK1", "Schematic, pins and wires", "U1"]);
  for (const chrome of ["Not on the schematic yet", "Drag parts to arrange", "Show or hide", "Add first connection"]) expect(pins.text).not.toContain(chrome);
});

test("a page's own print is not cut down to the schematic after the schematic has been visited", async ({ page }) => {
  await page.goto("/s/design/schematic");
  await page.waitForLoadState("networkidle");
  await page.locator("aside").getByRole("link", { name: "Wiring and soldering" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: /Wiring and soldering/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Sensor power", { exact: true }).first()).toBeVisible();
  expectPrinted(await pdfOf(page, "wiring-after-schematic"), ["Wiring and soldering", "Sensor power"]);
});
