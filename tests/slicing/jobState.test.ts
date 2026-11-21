import { describe, expect, it } from "vitest";
import { MANUAL_TARGETS, PRINT_STATUSES, TRANSITIONS, canMove, normaliseStatus, printerFileName, printJobData } from "@/lib/slicing/jobState";
import { assertNewPrintJob, assertPrintChange } from "@/lib/slicing/rules";

const SECTION = "prototype/printing";
const was = (status: string, data: Record<string, unknown> = {}) => ({ section: SECTION, status, data });

describe("the print job state machine", () => {
  it("names the eight statuses and gives each a row", () => {
    expect([...PRINT_STATUSES]).toEqual(["queued", "slicing", "sliced", "sent", "printing", "done", "failed", "cancelled"]);
    for (const s of PRINT_STATUSES) expect(TRANSITIONS[s]).toBeDefined();
  });

  it("walks the happy path one edge at a time", () => {
    const path = ["queued", "slicing", "sliced", "sent", "printing", "done"];
    for (let i = 0; i < path.length - 1; i++) expect(canMove(path[i], path[i + 1])).toBe(true);
  });

  it("refuses every jump over a step", () => {
    expect(canMove("queued", "sent")).toBe(false);
    expect(canMove("queued", "printing")).toBe(false);
    expect(canMove("sliced", "printing")).toBe(false);
    expect(canMove("sent", "done")).toBe(false);
  });

  it("does not leave done, and refuses names it does not know", () => {
    for (const s of PRINT_STATUSES) expect(canMove("done", s)).toBe(false);
    expect(canMove("queued", "banana")).toBe(false);
    expect(canMove("banana", "queued")).toBe(false);
  });

  it("reads the three old statuses as new ones", () => {
    expect(normaliseStatus("waiting on file")).toBe("queued");
    expect(normaliseStatus("ready")).toBe("queued");
    expect(normaliseStatus("printed")).toBe("done");
    expect(normaliseStatus("sent")).toBe("sent");
  });

  it("lets a person set only queued and cancelled by hand", () => {
    expect([...MANUAL_TARGETS]).toEqual(["queued", "cancelled"]);
  });
});

describe("what a plain row write may do to a print job", () => {
  it("starts a new job only as queued, with nothing the slicer or printer writes", () => {
    expect(() => assertNewPrintJob({ section: SECTION, status: "queued", data: { fileId: 3 } })).not.toThrow();
    expect(() => assertNewPrintJob({ section: SECTION, status: "printing" })).toThrow(/starts as queued/);
    for (const k of ["slice", "sentAt", "sentName", "startedAt", "result", "sliceError"]) {
      expect(() => assertNewPrintJob({ section: SECTION, data: { [k]: 1 } })).toThrow(/written by slicing/);
    }
  });

  it("ignores rows of other sections", () => {
    expect(() => assertNewPrintJob({ section: "design/bom", status: "printing", data: { slice: 1 } })).not.toThrow();
    expect(() => assertPrintChange({ section: "design/bom", status: "x", data: {} }, { status: "printing" })).not.toThrow();
  });

  it.each(["slicing", "sliced", "sent", "printing", "done", "failed"])("refuses to move a job to %s by hand", (to) => {
    expect(() => assertPrintChange(was("queued"), { status: to })).toThrow(/by hand/);
  });

  it("allows queued again after a failure and cancelling before it is sent", () => {
    expect(() => assertPrintChange(was("failed"), { status: "queued" })).not.toThrow();
    expect(() => assertPrintChange(was("sliced"), { status: "cancelled" })).not.toThrow();
  });

  it("refuses an allowed target from a status that has no such edge", () => {
    expect(() => assertPrintChange(was("done"), { status: "queued" })).toThrow(/cannot move/);
  });

  it("refuses editing the file, printer or settings of a sliced job that is not queued", () => {
    expect(() => assertPrintChange(was("sliced", { slice: { seconds: 1 } }), { data: { infill: 40 } })).toThrow(/sliced/);
    expect(() => assertPrintChange(was("queued", { slice: { seconds: 1 } }), { data: { infill: 40 } })).not.toThrow();
    expect(() => assertPrintChange(was("sliced", { slice: { seconds: 1 } }), { data: { notes: "x" } })).not.toThrow();
  });

  it("refuses writing the server-only keys on an existing job", () => {
    expect(() => assertPrintChange(was("queued"), { data: { slice: { seconds: 5 } } })).toThrow(/written by slicing/);
    expect(() => assertPrintChange(was("sent"), { data: { result: { outcome: "good" } } })).toThrow(/written by/);
  });
});

describe("the data a job carries", () => {
  it("keeps unknown keys and checks the known ones", () => {
    expect(printJobData.safeParse({ fileId: 4, infill: 20, extra: "kept" }).success).toBe(true);
    expect(printJobData.safeParse({ infill: 400 }).success).toBe(false);
  });

  it("names the file on the printer from the title and the job id, safe for a printer's file system", () => {
    const n = printerFileName("Lid / v2: final?", ".gcode", 42);
    expect(n).toBe("Lid_v2_final-42.gcode");
    expect(printerFileName("???", ".gcode.3mf", 7)).toBe("part-7.gcode.3mf");
  });
});

describe("durations", () => {
  it("rounds to the minute, and keeps seconds under a minute and a half", async () => {
    const { duration } = await import("@/lib/slicing/format");
    expect(duration(40)).toBe("40 s");
    expect(duration(1191.2)).toBe("20 min");
    expect(duration(4740)).toBe("1 h 19 min");
    expect(duration(3600)).toBe("1 h 00 min");
    expect(duration(-5)).toBe("0 s");
  });
});
