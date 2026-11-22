// The gate checks other features work out (integration item 2): the electrical checks, the
// enclosure's checks on the saved choice, production readiness and the no-proof rule on content.
import { describe, expect, it } from "vitest";
import { processFor, type Check } from "@/lib/process/definitions";
import { evaluateCheck, gateOf } from "@/lib/process/evaluate";
import { buildSpec } from "@/lib/enclosure/spec";
import { withDefaults } from "@/lib/enclosure/validate";
import { specFingerprint } from "@/lib/enclosure/fingerprint";
import type { Item } from "@/lib/types";
import { exampleParts } from "../enclosure/helpers";
import { VERIFIED } from "../research/verified";

let nextId = 1000;
const row = (section: string, status: string, data: Record<string, unknown> = {}, title = `row ${nextId}`, body = ""): Item => ({
  id: nextId++, projectId: "p", section, title, body, data, status, sort: nextId,
});
const ids = (type: string, stage: string) => gateOf(processFor(type), stage).checks.map((c) => c.id);
const find = (type: string, stage: string, id: string) => gateOf(processFor(type), stage).checks.find((c) => c.id === id) as Check;

describe("gates that read other features' checks", () => {
  it("are on the right gates for the right product types", () => {
    expect(ids("electronics", "design")).toEqual(expect.arrayContaining(["design.electrical", "design.enclosure"]));
    expect(ids("printed", "design")).not.toContain("design.electrical");
    expect(ids("physical", "design")).not.toContain("design.enclosure");
    for (const t of ["electronics", "printed", "physical"]) {
      expect(ids(t, "production")).toContain("production.ready");
      expect(ids(t, "marketing")).toContain("marketing.proof");
      expect(ids(t, "sales")).toEqual(expect.arrayContaining(["sales.listing-ready", "sales.listing-proof"]));
    }
  });

  it("electrical: met only when the server's counts show no error", () => {
    const c = find("electronics", "design", "design.electrical");
    expect(evaluateCheck(c, [], {}, {}).met).toBe(false);
    // no wire, no circuit: never "Met: no errors" on an empty schematic (U27)
    expect(evaluateCheck(c, [], {}, { erc: { ok: true, errors: 0, warnings: 0 } })).toMatchObject({ met: false, detail: "No schematic yet: there are no wires to check." });
    const wired = [{ id: 1, projectId: "p", section: "design/wiring", title: "w", body: "", data: {}, status: "to solder", sort: 1 }];
    expect(evaluateCheck(c, wired, {}, { erc: { ok: false, errors: 2, warnings: 1 } })).toMatchObject({ met: false, detail: "2 errors and 1 warning in the electrical checks." });
    expect(evaluateCheck(c, wired, {}, { erc: { ok: true, errors: 0, warnings: 3 } })).toMatchObject({ met: true, detail: "No errors, 3 warnings to read." });
  });

  it("enclosure: the saved choice's checks count only while they describe today's parts and settings", () => {
    const c = find("electronics", "design", "design.enclosure");
    const parts = exampleParts();
    expect(evaluateCheck(c, parts).detail).toBe("No enclosure generator is chosen.");
    const params = withDefaults({});
    const fingerprint = specFingerprint(buildSpec({ items: parts, params }));
    const checks = [1, 2, 3, 4, 5].map((n) => ({ key: `k${n}`, label: `Check ${n}`, ok: true }));
    const saved = (checked: Record<string, unknown>, gen = "casemaker") => row("design/enclosure", "open", { enclosureGenerator: gen, params, checked });
    expect(evaluateCheck(c, [...parts, saved({})]).action).toBe("Generate the enclosure to measure its checks");
    expect(evaluateCheck(c, [...parts, saved({ casemaker: { fingerprint, at: "", checks } })])).toMatchObject({ met: true, detail: "All 5 checks pass on the saved choice." });
    // checks measured with the other generator do not count for the chosen one
    expect(evaluateCheck(c, [...parts, saved({ casemaker: { fingerprint, at: "", checks } }, "yapp")]).met).toBe(false);
    // one failed check holds the gate
    const failed = checks.map((x, i) => (i === 2 ? { ...x, ok: false } : x));
    expect(evaluateCheck(c, [...parts, saved({ casemaker: { fingerprint, at: "", checks: failed } })])).toMatchObject({ met: false, detail: "1 of 5 checks failed: Check 3." });
    // a part moved after the checks were measured: they no longer count
    const moved = parts.map((p) => {
      const g = p.data.geometry as { pos?: number[] } | undefined;
      return g?.pos ? { ...p, data: { ...p.data, geometry: { ...g, pos: [g.pos[0] + 5, g.pos[1], g.pos[2]] } } } : p;
    });
    expect(evaluateCheck(c, [...moved, saved({ casemaker: { fingerprint, at: "", checks } })]).action).toBe("Generate the enclosure again");
  });

  it("production readiness: the four checks of the batch plan, for the first planned batch", () => {
    const c = find("electronics", "production", "production.ready");
    const empty = evaluateCheck(c, [], {}, { currency: "USD" });
    expect(empty.met).toBe(false);
    expect(empty.detail).toMatch(/^4 of 4 readiness checks not met/);
    const rows = [
      row("design/bom", "in hand", { ref: "U1", qty: 1, unit: 4, supplier: "ACME" }, "Board"),
      row("production/suppliers", "active", { code: "ACME" }, "Acme"),
      row("prototype/tests", "pass", {}, "Lights up"),
      row("production/compliance", "not applicable", {}, "RoHS"),
      row("sales/channels", "active", { price: 20, platformPercent: 0 }, "Direct"),
      row("production/batches", "planned", { units: 10 }, "First run"),
    ];
    expect(evaluateCheck(c, rows, {}, { currency: "USD" })).toMatchObject({ met: true, detail: "All four readiness checks are met." });
    expect(evaluateCheck(c, rows.map((r) => (r.section === "prototype/tests" ? { ...r, status: "fail" } : r)), {}, { currency: "USD" }).met).toBe(false);
  });

  it("content proof: a released ad with a superlative and no proof holds the Marketing gate; a draft does not", () => {
    const c = find("electronics", "marketing", "marketing.proof");
    const ad = (status: string, proof: unknown[] = []) => row("marketing/ads", status, { channel: "meta", fields: { primaryText: "The best bag tag ever made" }, proof }, "Meta: best");
    expect(evaluateCheck(c, [ad("draft")]).met).toBe(true);
    const r = evaluateCheck(c, [ad("approved")]);
    expect(r).toMatchObject({ met: false, href: "/s/marketing/ads" });
    expect(r.detail).toContain("Meta: best");
    const claim = row("research/claims", "verified", VERIFIED, "Buyers rate it best in a test of 40");
    expect(evaluateCheck(c, [claim, ad("approved", [{ itemId: claim.id }])]).met).toBe(true);
  });
});

describe("the build gate reads live evidence (process review 2)", async () => {
  const { buildPassedCheck } = await import("@/lib/process/computed");
  const mk = (section: string, status: string, data: Record<string, unknown>, title: string, id: number) => ({ id, projectId: "p", section, title, body: "", data, status, sort: id });
  const build = (status = "passed") => mk("prototype/builds", status, { criteria: [{ text: "Boots", met: true }], tests: ["t1"] }, "EVT", 1);
  it("is met when a passed build still has every criterion met and every test passing", () => {
    expect(buildPassedCheck([build(), mk("prototype/tests", "pass", { key: "t1" }, "T1", 2)]).met).toBe(true);
  });
  it("is not met, and says why, when a passed build's test no longer passes or is gone", () => {
    const failing = buildPassedCheck([build(), mk("prototype/tests", "fail", { key: "t1" }, "T1", 2)]);
    expect(failing.met).toBe(false);
    expect(failing.detail).toContain("T1 no longer passes (fail)");
    expect(buildPassedCheck([build()]).detail).toContain("t1 was deleted");
  });
  it("is not met for a passed build with nothing to prove", () => {
    expect(buildPassedCheck([mk("prototype/builds", "passed", {}, "Empty", 1)]).met).toBe(false);
  });
});
