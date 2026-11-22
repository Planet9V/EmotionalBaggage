// The Admin API: credentials, settings, printers, the integrations report, the printer status route and the
// first-run status. Connection tests are in tests/admin/connection.test.ts.
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { pool, q } from "@/lib/db";
import { getCredential } from "@/lib/settings";
import { GET as listCredentials } from "@/app/api/admin/credentials/route";
import { PUT as putCredentials } from "@/app/api/admin/credentials/[provider]/route";
import { DELETE as deleteCredential } from "@/app/api/admin/credentials/[provider]/[field]/route";
import { GET as auditLog } from "@/app/api/admin/credentials/audit/route";
import { GET as getSettings, PUT as putSettings } from "@/app/api/admin/settings/route";
import { GET as listPrinters, POST as addPrinter } from "@/app/api/admin/printers/route";
import { DELETE as deletePrinter, PATCH as patchPrinter } from "@/app/api/admin/printers/[id]/route";
import { GET as families } from "@/app/api/admin/printer-families/route";
import { POST as runTest } from "@/app/api/admin/test/route";
import { GET as status } from "@/app/api/admin/status/route";
import { GET as integrations } from "@/app/api/integrations/route";
import { GET as printerStatus } from "@/app/api/printer/route";
import { audit, AUDIT_LIMIT, readAudit } from "@/lib/admin/audit";
import { plannerUrl } from "@/lib/admin/planner";
import { PROVIDERS } from "@/lib/settings";
import type { ProviderView } from "@/lib/admin/credentials";
import type { PrinterView } from "@/lib/admin/printers";
import type { Integration } from "@/lib/integrations";
import type { StatusItem } from "@/lib/admin/status";
import * as octoprint from "../standins/octoprint";
import * as moonraker from "../standins/moonraker";
import type { StandIn } from "../standins/core";
import { clearAdmin, restore, snapshot } from "../admin/fixture";
import { asAdministrator, ctx, json, read, SEEDED } from "./helpers";

// This file changes Admin settings or keys, which the public demo account (default password) may not.
asAdministrator();

type Snap = Awaited<ReturnType<typeof snapshot>>;
let snap: Snap;
const standins: StandIn<unknown>[] = [];

beforeAll(async () => {
  snap = await snapshot();
  await clearAdmin();
});

afterAll(async () => {
  await Promise.all(standins.map((s) => s.close()));
  await restore(snap);
  await pool().end();
});

const prov = (provider: string) => ({ params: Promise.resolve({ provider }) });
const provField = (provider: string, field: string) => ({ params: Promise.resolve({ provider, field }) });

async function providers() {
  return (await read<{ providers: ProviderView[] }>(await listCredentials(json("GET")))).body.providers;
}
async function field(provider: string, name: string) {
  return (await providers()).find((p) => p.id === provider)!.fields.find((f) => f.name === name)!;
}
const put = (provider: string, fields: Record<string, unknown>) => putCredentials(json("PUT", { fields }), prov(provider));

describe("credentials", () => {
  beforeEach(clearAdmin);

  it("lists every provider and field from the registry, nothing set", async () => {
    const list = await providers();
    expect(list.map((p) => p.id)).toEqual([...PROVIDERS]);
    const amazon = list.find((p) => p.id === "amazon-sp")!;
    expect(amazon.fields.map((f) => f.name)).toEqual(["refreshToken", "clientId", "clientSecret"]);
    expect(amazon.configured).toBe(false);
    for (const p of list) for (const f of p.fields) expect(f).toMatchObject({ set: false, source: null, last4: null, value: null, updatedAt: null });
    // a local model host needs no key, so it counts as configured with nothing set
    expect(list.find((p) => p.id === "ollama")!.configured).toBe(true);
  });

  it("saves a key and shows only its last four characters", async () => {
    const secret = "sk-or-v1-recognisable-0123456789abcdWXYZ";
    const r = await read<{ provider: ProviderView }>(await put("openrouter", { apiKey: secret }));
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain(secret);
    expect(r.body.provider.configured).toBe(true);
    expect(r.body.provider.fields[0]).toMatchObject({ name: "apiKey", set: true, source: "admin", last4: "WXYZ", value: null });
    expect(typeof r.body.provider.fields[0].updatedAt).toBe("string");
    expect(await getCredential("openrouter", "apiKey")).toBe(secret);
  });

  it("applies the last-four rule only at 12 characters or more", async () => {
    await put("openrouter", { apiKey: "abcdefg1234" }); // 11
    expect((await field("openrouter", "apiKey")).last4).toBeNull();
    await put("openrouter", { apiKey: "abcdefgh1234" }); // 12
    expect((await field("openrouter", "apiKey")).last4).toBe("1234");
    await put("openrouter", { apiKey: "short" });
    const f = await field("openrouter", "apiKey");
    expect(f.set).toBe(true);
    expect(f.last4).toBeNull();
  });

  it("returns a non-secret field in full", async () => {
    await put("instagram", { accessToken: "IGQ-long-access-token-0000", accountId: "17841400000000" });
    const ig = (await providers()).find((p) => p.id === "instagram")!;
    expect(ig.fields.find((f) => f.name === "accountId")).toMatchObject({ secret: false, value: "17841400000000", last4: null });
    expect(ig.fields.find((f) => f.name === "accessToken")).toMatchObject({ secret: true, value: null, last4: "0000" });
    expect(ig.configured).toBe(true);
  });

  it("leaves blank and absent fields unchanged, and trims values", async () => {
    await put("amazon-sp", { refreshToken: "  Atzr|refresh-token-1111  ", clientId: "amzn1.client-2222" });
    expect(await getCredential("amazon-sp", "refreshToken")).toBe("Atzr|refresh-token-1111");
    const r = await read<{ provider: ProviderView }>(await put("amazon-sp", { refreshToken: "", clientSecret: "client-secret-value-3333" }));
    expect(r.status).toBe(200);
    expect(await getCredential("amazon-sp", "refreshToken")).toBe("Atzr|refresh-token-1111");
    expect(await getCredential("amazon-sp", "clientId")).toBe("amzn1.client-2222");
    expect(r.body.provider.configured).toBe(true);
  });

  it("refuses whitespace-only values, unknown providers and unknown fields with 400", async () => {
    const ws = await read<{ error: string; issues: { field: string }[] }>(await put("openrouter", { apiKey: "   " }));
    expect(ws.status).toBe(400);
    expect(ws.body.issues[0].field).toBe("fields.apiKey");
    expect(await getCredential("openrouter", "apiKey")).toBeNull();

    const unknownField = await read<{ issues: { field: string }[] }>(await put("openrouter", { nope: "x" }));
    expect(unknownField.status).toBe(400);
    expect(unknownField.body.issues[0].field).toBe("fields.nope");

    const unknownProvider = await read<{ error: string }>(await put("anthropic", { apiKey: "x" }));
    expect(unknownProvider.status).toBe(400);
    expect(unknownProvider.body.error).toMatch(/anthropic/);

    expect((await putCredentials(json("PUT", { fields: { apiKey: 42 } }), prov("openrouter"))).status).toBe(400);
    expect((await putCredentials(json("PUT", {}), prov("openrouter"))).status).toBe(400);
    expect((await putCredentials(json("PUT", "not json"), prov("openrouter"))).status).toBe(400);
  });

  it("removing a saved value lets the environment fallback apply again", async () => {
    process.env.PERPLEXITY_API_KEY = "pplx-from-environment-9876";
    try {
      expect(await field("perplexity", "apiKey")).toMatchObject({ set: true, source: "environment", last4: "9876", updatedAt: null });
      await put("perplexity", { apiKey: "pplx-saved-in-admin-5555" });
      expect(await field("perplexity", "apiKey")).toMatchObject({ source: "admin", last4: "5555" });

      const r = await read<{ provider: ProviderView }>(await deleteCredential(json("DELETE"), provField("perplexity", "apiKey")));
      expect(r.status).toBe(200);
      expect(r.body.provider.fields[0]).toMatchObject({ set: true, source: "environment", last4: "9876" });
      expect(JSON.stringify(r.body)).not.toContain("pplx-from-environment-9876");

      // nothing saved any more
      expect((await deleteCredential(json("DELETE"), provField("perplexity", "apiKey"))).status).toBe(404);
    } finally {
      delete process.env.PERPLEXITY_API_KEY;
    }
  });

  it("answers 404 for an unknown provider or field on removal", async () => {
    expect((await deleteCredential(json("DELETE"), provField("nobody", "apiKey"))).status).toBe(404);
    expect((await deleteCredential(json("DELETE"), provField("openrouter", "nope"))).status).toBe(404);
  });
});

describe("credentials audit", () => {
  beforeEach(clearAdmin);

  it("records set, replaced and removed, never a value", async () => {
    await put("x", { accessToken: "x-token-first-value-1" });
    await put("x", { accessToken: "x-token-second-value-2" });
    await deleteCredential(json("DELETE"), provField("x", "accessToken"));
    const r = await read<{ entries: { action: string; provider: string; field: string; at: string }[] }>(await auditLog(json("GET")));
    expect(r.status).toBe(200);
    expect(r.body.entries.slice(0, 3).map((e) => e.action)).toEqual(["removed", "replaced", "set"]);
    expect(r.body.entries[0]).toMatchObject({ provider: "x", field: "accessToken" });
    expect(Date.parse(r.body.entries[0].at)).not.toBeNaN();
    const text = JSON.stringify(r.body);
    expect(text).not.toContain("x-token-first-value-1");
    expect(text).not.toContain("x-token-second-value-2");
  });

  it("keeps only the most recent 200 entries, newest first", async () => {
    for (let i = 0; i < 21; i++) await audit(Array.from({ length: 10 }, (_, j) => ({ action: "set" as const, provider: "x", field: `f${i * 10 + j}` })));
    const entries = await readAudit();
    expect(entries.length).toBe(AUDIT_LIMIT);
    expect(entries[0].field).toBe("f209");
    expect(entries[AUDIT_LIMIT - 1].field).toBe("f10");
  });

  it("two saves at once both land in the audit", async () => {
    await Promise.all([put("x", { accessToken: "concurrent-a-000000" }), put("perplexity", { apiKey: "concurrent-b-000000" })]);
    const top = (await readAudit()).slice(0, 2).map((e) => e.provider).sort();
    expect(top).toEqual(["perplexity", "x"]);
  });
});

type SettingsBody = { settings: { reasoningModel: unknown; embeddingModel: unknown; plannerUrl: string | null; plannerEffective: { url: string | null; source: string | null }; defaultConcept: string | null; defaultBaseUrl: Record<string, string> } };

describe("settings", () => {
  beforeEach(clearAdmin);
  const putS = async (b: unknown) => read<SettingsBody & { issues?: { field: string }[] }>(await putSettings(json("PUT", b)));

  it("starts empty and offers the default addresses", async () => {
    const r = await read<SettingsBody>(await getSettings(json("GET")));
    expect(r.body.settings).toMatchObject({ reasoningModel: null, embeddingModel: null, plannerUrl: null, defaultConcept: null });
    expect(r.body.settings.defaultBaseUrl.ollama).toBe("http://host.docker.internal:11434/v1");
  });

  it("saves both models, the planner address and the default concept", async () => {
    const r = await putS({
      reasoningModel: { provider: "ollama", baseUrl: "http://localhost:11434/v1/", model: "qwen3:8b" },
      embeddingModel: { provider: "lmstudio", baseUrl: "http://localhost:1234/v1", model: "nomic-embed", dims: 768 },
      plannerUrl: "http://planner:8811/",
      defaultConcept: SEEDED,
    });
    expect(r.status).toBe(200);
    expect(r.body.settings.reasoningModel).toEqual({ provider: "ollama", baseUrl: "http://localhost:11434/v1", model: "qwen3:8b" });
    expect(r.body.settings.embeddingModel).toEqual({ provider: "lmstudio", baseUrl: "http://localhost:1234/v1", model: "nomic-embed", dims: 768 });
    expect(r.body.settings.plannerUrl).toBe("http://planner:8811");
    expect(r.body.settings.plannerEffective).toEqual({ url: "http://planner:8811", source: "admin" });
    expect(r.body.settings.defaultConcept).toBe(SEEDED);

    // absent keys stay; null clears
    const r2 = await putS({ reasoningModel: null });
    expect(r2.body.settings.reasoningModel).toBeNull();
    expect(r2.body.settings.embeddingModel).not.toBeNull();
  });

  it("validates each field and names it", async () => {
    const cases: [unknown, string][] = [
      [{ embeddingModel: { provider: "ollama", baseUrl: "http://h/v1", model: "e" } }, "embeddingModel.dims"],
      [{ embeddingModel: { provider: "ollama", baseUrl: "http://h/v1", model: "e", dims: 8193 } }, "embeddingModel.dims"],
      [{ embeddingModel: { provider: "ollama", baseUrl: "http://h/v1", model: "e", dims: 0 } }, "embeddingModel.dims"],
      [{ embeddingModel: { provider: "ollama", baseUrl: "http://h/v1", model: "e", dims: 1.5 } }, "embeddingModel.dims"],
      [{ reasoningModel: { provider: "ollama", baseUrl: "http://h/v1", model: "m", dims: 8 } }, "reasoningModel.dims"],
      [{ reasoningModel: { provider: "ollama", baseUrl: "ftp://h/v1", model: "m" } }, "reasoningModel.baseUrl"],
      [{ reasoningModel: { provider: "ollama", baseUrl: "not a url", model: "m" } }, "reasoningModel.baseUrl"],
      [{ reasoningModel: { provider: "ollama", baseUrl: "http://user:pass@h/v1", model: "m" } }, "reasoningModel.baseUrl"],
      [{ reasoningModel: { provider: "anthropic", baseUrl: "http://h/v1", model: "m" } }, "reasoningModel.provider"],
      [{ reasoningModel: { provider: "ollama", baseUrl: "http://h/v1", model: " " } }, "reasoningModel.model"],
      [{ plannerUrl: "planner:8811" }, "plannerUrl"],
      [{ defaultConcept: "no-such-concept" }, "defaultConcept"],
    ];
    for (const [b, f] of cases) {
      const r = await putS(b);
      expect(r.status, JSON.stringify(b)).toBe(400);
      expect(r.body.issues?.[0].field, JSON.stringify(b)).toBe(f);
    }
    expect((await read<SettingsBody>(await getSettings(json("GET")))).body.settings.reasoningModel).toBeNull();
  });

  it("writes only its own keys", async () => {
    for (const b of [{ "seed.example": { x: 1 } }, { "audit.credentials": [] }, { seed: 1 }, {}]) {
      expect((await putSettings(json("PUT", b))).status, JSON.stringify(b)).toBe(400);
    }
    expect((await q("SELECT value FROM settings WHERE key='seed.example'")).length).toBe(1);
  });

  it("plannerUrl() uses the saved address first, then PLANNER_URL", async () => {
    process.env.PLANNER_URL = "http://env-planner:8811/";
    try {
      expect(await plannerUrl()).toBe("http://env-planner:8811");
      await putS({ plannerUrl: "http://saved-planner:8811" });
      expect(await plannerUrl()).toBe("http://saved-planner:8811");
      const r = await putS({ plannerUrl: null });
      expect(r.body.settings.plannerEffective).toEqual({ url: "http://env-planner:8811", source: "environment" });
      delete process.env.PLANNER_URL;
      expect(await plannerUrl()).toBeNull();
    } finally {
      delete process.env.PLANNER_URL;
    }
  });
});

describe("printers", () => {
  const addP = async (b: unknown) => read<{ printer: PrinterView; error?: string; issues?: { field: string }[] }>(await addPrinter(json("POST", b)));
  const patchP = async (id: number | string, b: unknown) => read<{ printer: PrinterView; error?: string; issues?: { field: string }[] }>(await patchPrinter(json("PATCH", b), ctx(String(id))));
  const KEY = "octoprint-api-key-ABCDEF0123456789";

  it("lists the families, with their status", async () => {
    const r = await read<{ families: { id: string; status: string; fields: { name: string; secret: boolean; required: boolean }[] }[] }>(await families(json("GET")));
    expect(r.body.families.map((f) => f.id)).toEqual(["octoprint", "moonraker", "prusalink", "duet", "bambu", "creality", "elegoo", "file-only"]);
    const by = Object.fromEntries(r.body.families.map((f) => [f.id, f]));
    expect(by.octoprint.status).toBe("supported");
    expect(by.moonraker.fields.find((f) => f.name === "apiKey")!.required).toBe(false);
    expect(by["file-only"]).toMatchObject({ status: "supported", fields: [] });
    for (const id of ["prusalink", "duet", "bambu", "creality", "elegoo"]) expect(by[id].status).toBe("supported");
    expect(by.creality.fields.map((f) => f.name)).toEqual(["address", "apiKey"]);
    expect(by.elegoo.fields.map((f) => f.name)).toEqual(["address", "apiKey"]);
    expect(by.bambu.fields.find((f) => f.name === "serial")!.required).toBe(true);
  });

  it("adds a printer, keeps the address in its column, and never returns the key", async () => {
    const r = await addP({ name: "ZZ Admin Octo", family: "octoprint", model: "MK4", access: { address: "http://octopi.local/", apiKey: KEY } });
    expect(r.status).toBe(201);
    expect(JSON.stringify(r.body)).not.toContain(KEY);
    expect(r.body.printer).toMatchObject({ name: "ZZ Admin Octo", family: "octoprint", familyLabel: "OctoPrint", status: "supported", model: "MK4", address: "http://octopi.local", enabled: true });
    expect(r.body.printer.access).toEqual({
      address: { set: true, secret: false, value: "http://octopi.local", last4: null },
      apiKey: { set: true, secret: true, value: null, last4: "6789" },
    });
    const row = (await q<{ address: string; access: Record<string, string> }>("SELECT address, access FROM printers WHERE id=$1", [r.body.printer.id]))[0];
    expect(row).toEqual({ address: "http://octopi.local", access: { apiKey: KEY } });

    const list = await read<{ printers: PrinterView[] }>(await listPrinters(json("GET")));
    expect(list.body.printers.some((p) => p.id === r.body.printer.id)).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain(KEY);
  });

  it("shows no characters of a short printer secret", async () => {
    const r = await addP({ name: "ZZ Admin Short", family: "octoprint", access: { address: "http://o.local", apiKey: "short-key" } });
    expect(r.body.printer.access.apiKey).toEqual({ set: true, secret: true, value: null, last4: null });
  });

  it("validates family, required fields, unknown fields and addresses", async () => {
    const cases: [unknown, string][] = [
      [{ name: "ZZ Admin Bad", family: "makerbot" }, "family"],
      [{ name: "ZZ Admin Bad", family: "octoprint", access: { address: "http://o.local" } }, "access.apiKey"],
      [{ name: "ZZ Admin Bad", family: "octoprint", access: { address: "o.local", apiKey: "k" } }, "access.address"],
      [{ name: "ZZ Admin Bad", family: "octoprint", access: { address: "http://u:p@o.local", apiKey: "k" } }, "access.address"],
      [{ name: "ZZ Admin Bad", family: "octoprint", access: { address: "http://o.local", apiKey: "k", serial: "1" } }, "access.serial"],
      [{ name: "ZZ Admin Bad", family: "file-only", access: { address: "http://o.local" } }, "access.address"],
      [{ name: "ZZ Admin Bad", family: "bambu", access: { address: "http://192.168.1.9", accessCode: "12345678" } }, "access.address"],
      [{ name: "ZZ Admin Bad", family: "octoprint", access: { address: "http://o.local", apiKey: "   " } }, "access.apiKey"],
      [{ name: "  ", family: "file-only" }, "name"],
      [{ family: "file-only" }, "name"],
      [{ name: "ZZ Admin Bad", family: "file-only", colour: "red" }, "(body)"],
    ];
    for (const [b, f] of cases) {
      const r = await addP(b);
      expect(r.status, JSON.stringify(b)).toBe(400);
      expect(r.body.issues?.[0].field, JSON.stringify(b)).toBe(f);
    }
    expect((await q("SELECT 1 FROM printers WHERE name='ZZ Admin Bad'")).length).toBe(0);
  });

  it("accepts file-only with no fields and Bambu with an IP address", async () => {
    expect((await addP({ name: "ZZ Admin Hand", family: "file-only" })).status).toBe(201);
    const b = await addP({ name: "ZZ Admin Bambu", family: "bambu", model: "P2S", access: { address: "192.168.1.9", accessCode: "12345678", serial: "01P00A000000000" } });
    expect(b.status).toBe(201);
    expect(b.body.printer.access.accessCode).toEqual({ set: true, secret: true, value: null, last4: null });
  });

  it("refuses a second printer with the same name, whatever the case (409)", async () => {
    await addP({ name: "ZZ Admin Twin", family: "file-only" });
    const r = await addP({ name: "zz admin TWIN", family: "file-only" });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("A printer with that name already exists.");
    const other = await addP({ name: "ZZ Admin Twin 2", family: "file-only" });
    expect((await patchP(other.body.printer.id, { name: "ZZ ADMIN twin" })).status).toBe(409);
  });

  it("patches with blank-means-unchanged, null removes an optional field, and the family can change", async () => {
    const made = await addP({ name: "ZZ Admin Patch", family: "moonraker", access: { address: "http://k.local:7125", apiKey: "moonraker-key-000011112222" } });
    const id = made.body.printer.id;

    const p1 = await patchP(id, { name: "ZZ Admin Patched", access: { apiKey: "" }, enabled: false });
    expect(p1.status).toBe(200);
    expect(p1.body.printer).toMatchObject({ name: "ZZ Admin Patched", enabled: false });
    expect(p1.body.printer.access.apiKey).toMatchObject({ set: true, last4: "2222" });

    const p2 = await patchP(id, { access: { apiKey: null } });
    expect(p2.body.printer.access.apiKey).toMatchObject({ set: false, last4: null });
    expect((await q<{ access: object }>("SELECT access FROM printers WHERE id=$1", [id]))[0].access).toEqual({});

    expect((await patchP(id, { access: { address: null } })).body.issues?.[0].field).toBe("access.address");

    // to OctoPrint: its key is required, the address carries over
    expect((await patchP(id, { family: "octoprint" })).body.issues?.[0].field).toBe("access.apiKey");
    const p3 = await patchP(id, { family: "octoprint", access: { apiKey: "octo-key-for-patch-9999" } });
    expect(p3.status).toBe(200);
    expect(p3.body.printer).toMatchObject({ family: "octoprint", address: "http://k.local:7125" });

    // to file-only: everything else is dropped
    const p4 = await patchP(id, { family: "file-only" });
    expect(p4.body.printer).toMatchObject({ family: "file-only", address: "", access: {} });

    expect((await patchP(id, {})).status).toBe(400);
    expect((await patchP(id, { family: "nope" })).body.issues?.[0].field).toBe("family");
  });

  it("answers 404 for unknown printers", async () => {
    expect((await patchP(99999999, { name: "x" })).status).toBe(404);
    expect((await patchP("abc", { name: "x" })).status).toBe(404);
    expect((await deletePrinter(json("DELETE"), ctx("99999999"))).status).toBe(404);
    expect((await deletePrinter(json("DELETE"), ctx("abc"))).status).toBe(404);
  });

  it("deletes a printer", async () => {
    const made = await addP({ name: "ZZ Admin Gone", family: "file-only" });
    const r = await deletePrinter(json("DELETE"), ctx(String(made.body.printer.id)));
    expect(r.status).toBe(200);
    expect((await q("SELECT 1 FROM printers WHERE id=$1", [made.body.printer.id])).length).toBe(0);
    expect((await deletePrinter(json("DELETE"), ctx(String(made.body.printer.id)))).status).toBe(404);
  });
});

describe("printer status route", () => {
  let octo: Awaited<ReturnType<typeof octoprint.start>>;
  let moon: Awaited<ReturnType<typeof moonraker.start>>;
  const OCTO_KEY = "octo-status-key-0123456789";

  beforeAll(async () => {
    octo = await octoprint.start({ apiKey: OCTO_KEY });
    moon = await moonraker.start();
    standins.push(octo as unknown as StandIn<unknown>, moon as unknown as StandIn<unknown>);
  });
  beforeEach(clearAdmin);

  const statusBody = async () => (await read<Record<string, unknown>>(await printerStatus(json("GET")))).body;

  it("says not configured when the table and the environment are empty", async () => {
    expect(await statusBody()).toMatchObject({ configured: false });
  });

  it("falls back to the environment settings when no printer is enabled", async () => {
    process.env.PRINTER_KIND = "moonraker";
    process.env.PRINTER_URL = moon.url;
    try {
      expect(await statusBody()).toMatchObject({ configured: true, kind: "moonraker", source: "environment", state: "standby", file: null });
    } finally {
      delete process.env.PRINTER_KIND;
      delete process.env.PRINTER_URL;
    }
  });

  it("reads the first enabled printer from the table, sending its key, and skips disabled ones", async () => {
    process.env.PRINTER_KIND = "moonraker";
    process.env.PRINTER_URL = moon.url;
    try {
      await addPrinter(json("POST", { name: "ZZ Admin Off", family: "file-only", enabled: false }));
      const made = await read<{ printer: PrinterView }>(await addPrinter(json("POST", { name: "ZZ Admin Status Octo", family: "octoprint", access: { address: octo.url, apiKey: OCTO_KEY } })));
      await addPrinter(json("POST", { name: "ZZ Admin Second", family: "file-only" }));
      const before = octo.requests.length;
      const body = await statusBody();
      expect(body).toMatchObject({ configured: true, kind: "octoprint", source: "admin", name: "ZZ Admin Status Octo", printerId: made.body.printer.id, state: "Operational", progress: null });
      expect(octo.requests.slice(before).map((r) => [r.path, r.headers["x-api-key"]])).toEqual([["/api/job", OCTO_KEY], ["/api/printer", OCTO_KEY]]);
      expect(JSON.stringify(body)).not.toContain(OCTO_KEY);
    } finally {
      delete process.env.PRINTER_KIND;
      delete process.env.PRINTER_URL;
    }
  });

  it("reports a printer that cannot be reached as an error, and file-only as print by hand", async () => {
    const duet = await read<{ printer: PrinterView }>(await addPrinter(json("POST", { name: "ZZ Admin Duet", family: "duet", access: { address: "http://duet.invalid" } })));
    expect(await statusBody()).toMatchObject({ configured: true, kind: "duet", error: expect.any(String) });
    await patchPrinter(json("PATCH", { enabled: false }), ctx(String(duet.body.printer.id)));
    await addPrinter(json("POST", { name: "ZZ Admin By Hand", family: "file-only" }));
    expect(await statusBody()).toMatchObject({ configured: true, kind: "file-only", note: expect.stringMatching(/file-only/) });
  });
});

describe("integrations report", () => {
  beforeEach(clearAdmin);
  const report = async () => (await read<{ integrations: Integration[]; database: { connected: boolean }; planner: { connected: boolean; source: string | null } }>(await integrations(json("GET")))).body;
  const row = (r: { integrations: Integration[] }, key: string) => r.integrations.find((i) => i.key === key)!;

  it("keeps the fields the browser reads and adds source and admin", async () => {
    const r = await report();
    expect(r.database.connected).toBe(true);
    for (const i of r.integrations) {
      expect(Object.keys(i).sort()).toEqual(["admin", "built", "configured", "env", "key", "name", "note", "purpose", "source"]);
    }
    expect(r.integrations.map((i) => i.key)).toEqual(expect.arrayContaining(["perplexity", "printer", "amazon-buy", "amazon-sell", "x", "instagram", "reasoning-model", "embedding-model"]));
  });

  it("reflects credentials saved in Admin, and environment values as environment", async () => {
    let r = await report();
    expect(row(r, "perplexity")).toMatchObject({ configured: false, source: null });
    await put("perplexity", { apiKey: "pplx-admin-key-000000" });
    await put("instagram", { accessToken: "ig-token-0000000000" });
    process.env.INSTAGRAM_ACCOUNT_ID = "1784";
    try {
      r = await report();
      expect(row(r, "perplexity")).toMatchObject({ configured: true, source: "admin", admin: "credentials" });
      expect(row(r, "instagram")).toMatchObject({ configured: true, source: "mixed" });
      expect(row(r, "amazon-sell")).toMatchObject({ configured: false });
    } finally {
      delete process.env.INSTAGRAM_ACCOUNT_ID;
    }
  });

  it("reflects the saved models, and an OpenRouter model without a key is not configured", async () => {
    await putSettings(json("PUT", { reasoningModel: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", model: "some/model" }, embeddingModel: { provider: "ollama", baseUrl: "http://localhost:11434/v1", model: "nomic-embed-text", dims: 768 } }));
    let r = await report();
    expect(row(r, "reasoning-model")).toMatchObject({ configured: false, source: "admin" });
    expect(row(r, "reasoning-model").note).toMatch(/no OpenRouter key/);
    expect(row(r, "embedding-model")).toMatchObject({ configured: true, source: "admin" });
    await put("openrouter", { apiKey: "sk-or-integration-000000" });
    r = await report();
    expect(row(r, "reasoning-model")).toMatchObject({ configured: true });
  });

  it("reflects printers saved in Admin and the saved planner address", async () => {
    expect(row(await report(), "printer")).toMatchObject({ configured: false });
    await addPrinter(json("POST", { name: "ZZ Admin Integ", family: "file-only" }));
    expect(row(await report(), "printer")).toMatchObject({ configured: true, source: "admin" });

    await putSettings(json("PUT", { plannerUrl: inject("plannerUrl") }));
    expect((await report()).planner).toMatchObject({ connected: true, source: "admin" });
    await putSettings(json("PUT", { plannerUrl: null }));
    expect((await report()).planner).toMatchObject({ connected: false, source: null });
  });
});

describe("first-run status", () => {
  beforeEach(clearAdmin);
  const items = async () => {
    const r = await read<{ complete: boolean; items: StatusItem[] }>(await status(json("GET")));
    return { complete: r.body.complete, by: Object.fromEntries(r.body.items.map((i) => [i.key, i])) as Record<string, StatusItem> };
  };

  it("lists the five things, each with what it enables", async () => {
    const s = await items();
    expect(Object.keys(s.by)).toEqual(["reasoningModel", "embeddingModel", "research", "printer", "planner"]);
    expect(s.complete).toBe(false);
    for (const i of Object.values(s.by)) {
      expect(i.configured).toBe(false);
      expect(i.explanation.length).toBeGreaterThan(20);
      expect(i.state.length).toBeGreaterThan(3);
    }
  });

  it("says whether the published default password is still in use", async () => {
    const r = await read<{ defaultPassword: boolean }>(await status(json("GET")));
    const [{ n }] = await q<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE password_changed_at IS NULL");
    expect(r.body.defaultPassword).toBe(n > 0);
  });

  it("is complete once everything is set and the planner answers", async () => {
    await putSettings(json("PUT", {
      reasoningModel: { provider: "ollama", baseUrl: "http://localhost:11434/v1", model: "qwen3" },
      embeddingModel: { provider: "ollama", baseUrl: "http://localhost:11434/v1", model: "nomic-embed-text", dims: 768 },
      plannerUrl: inject("plannerUrl"),
    }));
    await put("perplexity", { apiKey: "pplx-status-0000000000" });
    await addPrinter(json("POST", { name: "ZZ Admin First Run", family: "file-only" }));
    const s = await items();
    expect(Object.fromEntries(Object.entries(s.by).map(([k, v]) => [k, v.configured]))).toEqual({ reasoningModel: true, embeddingModel: true, research: true, printer: true, planner: true });
    expect(s.complete).toBe(true);
  });
});

describe("no full secret in any response", () => {
  const SECRET = "ZZ-RECOGNISABLE-SECRET-7f3a9c2e5b1d";
  const ENV_SECRET = "ZZ-ENVIRONMENT-SECRET-4e8b2a6c0f9d";

  it("scans every admin GET, the integrations and printer routes, and the test answers", async () => {
    await clearAdmin();
    const octo = await octoprint.start({ apiKey: SECRET });
    standins.push(octo as unknown as StandIn<unknown>);
    process.env.X_ACCESS_TOKEN = ENV_SECRET;
    try {
      // the model address first: a key is bound to the host in use when it is saved (moving it later removes the key)
      await putSettings(json("PUT", { reasoningModel: { provider: "openrouter", baseUrl: "http://127.0.0.1:9/api/v1", model: "m" } }));
      for (const p of ["openrouter", "perplexity", "ollama", "lmstudio"]) await put(p, { apiKey: SECRET });
      await put("amazon-sp", { refreshToken: SECRET, clientId: SECRET, clientSecret: SECRET });
      await put("instagram", { accessToken: SECRET });
      const printer = await read<{ printer: PrinterView }>(await addPrinter(json("POST", { name: "ZZ Admin Scan", family: "octoprint", access: { address: octo.url, apiKey: SECRET } })));
      await addPrinter(json("POST", { name: "ZZ Admin Scan Bambu", family: "bambu", access: { address: "10.0.0.9", accessCode: SECRET } }));

      const answers: Response[] = [
        await listCredentials(json("GET")),
        await auditLog(json("GET")),
        await getSettings(json("GET")),
        await listPrinters(json("GET")),
        await families(json("GET")),
        await status(json("GET")),
        await integrations(json("GET")),
        await printerStatus(json("GET")),
        await putCredentials(json("PUT", { fields: { apiKey: "" } }), prov("openrouter")),
        await patchPrinter(json("PATCH", { model: "MK4S" }), ctx(String(printer.body.printer.id))),
        await runTest(json("POST", { kind: "printer", id: printer.body.printer.id })),
        await runTest(json("POST", { kind: "printer", family: "octoprint", access: { address: octo.url, apiKey: SECRET } })),
        await runTest(json("POST", { kind: "perplexity" })),
        await runTest(json("POST", { kind: "model", provider: "openrouter", baseUrl: octo.url })),
      ];
      for (const a of answers) {
        expect(a.status, a.url).toBeLessThan(500);
        const text = await a.text();
        expect(text).not.toContain(SECRET);
        expect(text).not.toContain(ENV_SECRET);
      }
      // and the last four do show where they should
      expect((await field("openrouter", "apiKey")).last4).toBe(SECRET.slice(-4));
      expect((await field("x", "accessToken"))).toMatchObject({ source: "environment", last4: ENV_SECRET.slice(-4) });
    } finally {
      delete process.env.X_ACCESS_TOKEN;
    }
  });
});
