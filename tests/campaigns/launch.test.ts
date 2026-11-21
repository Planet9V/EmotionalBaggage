import { describe, expect, it } from "vitest";
import { addDays, daysBetween, dayNumber, inclusiveDays, monthsBetween } from "@/lib/campaigns/days";
import { checkTemplate, byPhase, dueDate, instantiate, launchKeyFor, schedule, toLaunch, toStep, type Context } from "@/lib/campaigns/launch";
import { TEMPLATES } from "@/lib/campaigns/templates";
import { launchData } from "@/lib/campaigns/schemas";
import { planGraph } from "@/lib/plan";
import type { Item } from "@/lib/types";

describe("days", () => {
  it("does arithmetic in whole days, across month ends, leap days and clock changes", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09"); // a US clock change
    expect(daysBetween("2026-12-01", "2026-12-25")).toBe(24);
    expect(inclusiveDays("2026-12-01", "2026-12-01")).toBe(1);
    expect(inclusiveDays("2026-12-02", "2026-12-01")).toBeNull();
    expect(monthsBetween("2026-11-30", "2027-01-02")).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
  it("refuses dates that do not exist", () => {
    expect(dayNumber("2026-02-30")).toBeNull();
    expect(dayNumber("2026-13-01")).toBeNull();
    expect(addDays("tomorrow", 1)).toBeNull();
  });
});

describe("every template is sound", () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s", (_id, t) => {
    expect(checkTemplate(t)).toEqual([]);
    expect(t.steps.length).toBeGreaterThanOrEqual(10);
    // every statement of a platform's rules has its source or says it is to be checked
    for (const s of t.steps.filter((x) => x.platformRule)) expect(Boolean(s.source) !== Boolean(s.check)).toBe(true);
  });
  it("has the templates the plan names", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["kickstarter", "amazon", "own-site", "retail", "soft"]);
  });
  it("Kickstarter has its six phases", () => {
    const phases = new Set(TEMPLATES[0].steps.map((s) => s.phase));
    expect([...phases]).toEqual(["Pre-launch list building", "Page review", "Launch day", "Mid-campaign", "Last 48 hours", "Fulfilment updates"]);
  });
  it("sources only point at the platform's own pages over https", () => {
    for (const t of TEMPLATES) for (const s of t.steps) if (s.source) expect(s.source).toMatch(/^https:\/\/(help\.kickstarter\.com|brandservices\.amazon\.com)\//);
  });
});

function item(id: number, data: Record<string, unknown>, title = `row ${id}`, status = "open"): Item {
  return { id, section: "marketing/launch", title, body: "", data, status, sort: id } as Item;
}

describe("using a template", () => {
  const t = TEMPLATES.find((x) => x.id === "kickstarter")!;
  const made = instantiate(t, { launchKey: "kickstarter", launchDate: "2027-03-15", usedKeys: new Set() });

  it("makes a launch row and one step row per template step, all valid for the section", () => {
    expect(made.launch.data).toMatchObject({ kind: "launch", launchKey: "kickstarter", template: "kickstarter", launchDate: "2027-03-15" });
    expect(made.steps).toHaveLength(t.steps.length);
    for (const s of [made.launch, ...made.steps]) expect(launchData.safeParse(s.data).success).toBe(true);
  });

  it("namespaces step keys by the launch, and turns template links into keys", () => {
    const page = made.steps.find((s) => s.data.templateStep === "page")!;
    expect(page.data.key).toBe("kickstarter-page");
    expect(page.data.after).toEqual(["kickstarter-video", "kickstarter-tiers", "kickstarter-shipping"]);
    expect(page.data.minutes).toBe(600);
  });

  it("gives a second launch of the same channel its own keys", () => {
    expect(launchKeyFor("Kickstarter", [])).toBe("kickstarter");
    expect(launchKeyFor("Kickstarter", ["kickstarter"])).toBe("kickstarter-2");
    expect(launchKeyFor("Kickstarter", ["kickstarter", "kickstarter-2"])).toBe("kickstarter-3");
  });

  it("refuses to reuse a key already in the concept", () => {
    expect(() => instantiate(t, { launchKey: "kickstarter", launchDate: "2027-03-15", usedKeys: new Set(["kickstarter-page"]) })).toThrow(/already used/);
  });

  it("marks a rule nobody sourced as something to check, in the row and in its text", () => {
    const review = made.steps.find((s) => s.data.templateStep === "platform-review")!;
    expect(review.data.check).toBe(true);
    expect(review.body).toContain("Check the platform's own current help pages");
    const pre = made.steps.find((s) => s.data.templateStep === "prelaunch-page")!;
    expect(pre.data.source).toMatch(/^https:\/\/help\.kickstarter\.com\//);
    expect(pre.data.check).toBeUndefined();
  });

  it("makes steps the order-of-operations graph reads: keyed, with minutes and links, none dropped", () => {
    const items = [item(1, made.launch.data, "launch"), ...made.steps.map((s, k) => item(10 + k, s.data, s.title))];
    const g = planGraph(items);
    // the launch row has no key, so it is not a step; every step is
    expect(g.nodes).toHaveLength(t.steps.length);
    expect(g.dropped).toEqual([]);
    expect(g.edges.length).toBe(t.steps.reduce((a, s) => a + (s.after?.length ?? 0), 0));
    expect(g.nodes.find((n) => n.id === "kickstarter-ship")?.minutes).toBe(2400);
  });
});

describe("moving the launch date moves every step", () => {
  const t = TEMPLATES.find((x) => x.id === "amazon")!;
  const made = instantiate(t, { launchKey: "amazon", launchDate: "2027-05-01", usedKeys: new Set() });
  const steps = made.steps.map((s, k) => toStep(item(10 + k, s.data, s.title)));
  const ctx: Context = { gate: () => true, buildStatus: () => null, buildName: () => "", today: "2027-04-01" };
  const dueOf = (date: string) => Object.fromEntries(schedule({ ...toLaunch(item(1, { ...made.launch.data, launchDate: date })), }, steps, ctx).map((s) => [s.key, s.due]));

  it("derives each due date from the launch date and the step's days", () => {
    const d = dueOf("2027-05-01");
    expect(d["amazon-launch"]).toBe("2027-05-01");
    expect(d["amazon-account"]).toBe("2027-02-20"); // 70 days before
    expect(d["amazon-day-one"]).toBe("2027-05-02"); // one day after
  });

  it("shifts every step by the same number of days when the launch date moves", () => {
    const a = dueOf("2027-05-01");
    const b = dueOf("2027-05-20");
    for (const k of Object.keys(a)) expect(daysBetween(a[k]!, b[k]!)).toBe(19);
  });

  it("has no date for a step when the launch has none", () => {
    expect(dueDate("", 10)).toBeNull();
    expect(dueDate("2027-05-01", null)).toBeNull();
  });
});

describe("what blocks a step", () => {
  const steps = [
    toStep(item(1, { kind: "step", key: "x-a", launch: "x", daysBefore: 20, requires: [{ kind: "gate", ref: "prototype" }] }, "Film it")),
    toStep(item(2, { kind: "step", key: "x-b", launch: "x", daysBefore: 10, after: ["x-a"], requires: [{ kind: "build", ref: "77", label: "EVT" }] }, "Ship samples")),
    toStep(item(3, { kind: "step", key: "x-c", launch: "x", daysBefore: 30, after: ["x-a"] }, "Written before what it waits on")),
    toStep(item(4, { kind: "step", key: "x-d", launch: "other", daysBefore: 5 }, "Another launch's step")),
  ];
  const launch = toLaunch(item(9, { kind: "launch", launchKey: "x", launchDate: "2027-06-30", channel: "X" }, "X launch"));
  const base: Context = { gate: () => true, buildStatus: () => "passed", buildName: () => "EVT", today: "2027-06-01" };

  it("says a step cannot be done before an unpassed gate", () => {
    const s = schedule(launch, steps, { ...base, gate: () => false }).find((x) => x.key === "x-a")!;
    expect(s.blockers.map((b) => b.text)).toEqual(["Cannot be done before the Prototype gate is passed."]);
  });
  it("says a step cannot be done before a build passes, naming the build and its state", () => {
    const s = schedule(launch, steps, { ...base, buildStatus: () => "testing" }).find((x) => x.key === "x-b")!;
    expect(s.blockers[0].text).toBe('Cannot be done before the build "EVT" passes (it is testing).');
    const none = schedule(launch, steps, { ...base, buildStatus: () => null }).find((x) => x.key === "x-b")!;
    expect(none.blockers[0].text).toContain("not in the concept");
  });
  it("blocks nothing once the gate and the build are passed, or the step is done", () => {
    expect(schedule(launch, steps, base).every((s) => s.blockers.length === 0)).toBe(true);
    const done = steps.map((s) => (s.key === "x-a" ? { ...s, status: "done" } : s));
    expect(schedule(launch, done, { ...base, gate: () => false }).find((x) => x.key === "x-a")!.blockers).toEqual([]);
  });
  it("leaves a gate that could not be read alone", () => {
    expect(schedule(launch, steps, { ...base, gate: () => null }).every((s) => s.blockers.length === 0)).toBe(true);
  });
  it("flags a step due before a step it waits on", () => {
    const s = schedule(launch, steps, base).find((x) => x.key === "x-c")!;
    expect(s.conflicts).toEqual(["x-a"]);
  });
  it("marks overdue steps, ignores other launches' steps, and sorts by due date", () => {
    const list = schedule(launch, steps, { ...base, today: "2027-06-15" });
    expect(list.map((s) => s.key)).toEqual(["x-c", "x-a", "x-b"]);
    expect(list.find((s) => s.key === "x-a")).toMatchObject({ overdue: true, daysAway: -5, due: "2027-06-10" });
    expect(list.find((s) => s.key === "x-b")?.overdue).toBe(false);
  });
  it("groups by phase in due order", () => {
    expect(byPhase(schedule(launch, steps, base)).map((p) => p.phase)).toEqual(["Steps"]);
  });
});
