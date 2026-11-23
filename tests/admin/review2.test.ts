// The second review of the admin area, items fixed with the platform administrator wired in (accounts slice 2):
// S1 audit lines, S2 the plan catalogue, S4 unbound credentials, S6 voice in the short list, S8 environment values,
// S10 the credentials PUT answer, S5 the allow-list (with tests/admin/guardLists.test.ts). The hook is stood in here, as
// in platform.test.ts: hook.admin decides who is the platform administrator.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pool, q, audit as auditLine } from "@/lib/db";
import { GET as auditGet } from "@/app/api/admin/audit/route";
import { GET as auditExport } from "@/app/api/admin/audit/export/route";
import { GET as plansGet } from "@/app/api/admin/plans/route";
import { GET as envGet } from "@/app/api/admin/environment/route";
import { PUT as credPut } from "@/app/api/admin/credentials/[provider]/route";
import { PUT as settingsPut } from "@/app/api/admin/settings/route";
import { POST as testPost } from "@/app/api/admin/test/route";
import { readAudit } from "@/lib/admin/audit";
import { builtInCatalogue } from "@/lib/admin/planSchema";
import { boundOrigin } from "@/lib/secretOrigin";
import { json, read } from "../api/helpers";

const hook = vi.hoisted(() => ({ admin: false }));
vi.mock("@/lib/admin/platformAdminHook", () => ({ platformAdminFromAuth2: async () => hook.admin }));

type Row = Record<string, unknown>;
let savedSettings: Row[] = [];
let savedCreds: Row[] = [];
const U = (p: string) => `http://test.local${p}`;

beforeAll(async () => {
  savedSettings = await q("SELECT key, value FROM settings");
  savedCreds = await q("SELECT provider, field, value, bound_origin FROM credentials");
});
afterAll(async () => {
  await q("DELETE FROM settings");
  await q("DELETE FROM credentials");
  for (const r of savedSettings) await q("INSERT INTO settings (key, value) VALUES ($1, $2)", [r.key, JSON.stringify(r.value)]);
  for (const c of savedCreds) await q("INSERT INTO credentials (provider, field, value, bound_origin) VALUES ($1,$2,$3,$4)", [c.provider, c.field, c.value, c.bound_origin]);
  await pool().end();
});
beforeEach(async () => {
  hook.admin = false;
  await q("DELETE FROM settings");
  await q("DELETE FROM credentials");
});

describe("S1: the install-wide audit log", () => {
  it("leaves out the new sections' and the new sign-in's lines for anyone but the platform administrator", async () => {
    const tag = `s1-${Date.now()}`;
    await auditLine({ action: "setting.changed", summary: `${tag} mail`, detail: { key: "mail.smtp", value: { host: "mail.internal.example", port: 587 } } });
    await auditLine({ action: "setting.changed", summary: `${tag} voice`, detail: { key: "voice.tts", value: { baseUrl: "http://kokoro.internal:8880" } } });
    await auditLine({ action: "setting.changed", summary: `${tag} plans`, detail: { key: "plans.catalogue", value: builtInCatalogue() } });
    await auditLine({ action: "credential.set", summary: `${tag} stripe`, detail: { provider: "stripe", field: "secretKey", boundTo: "https://api.stripe.com" } });
    await auditLine({ action: "credential.tested", summary: `${tag} voice`, detail: { provider: "voice", field: null } });
    await auditLine({ action: "platform.user_created", summary: `${tag} platform`, detail: {} });
    await auditLine({ action: "workspace.invited", summary: `${tag} workspace`, detail: {} });
    await auditLine({ action: "setting.changed", summary: `${tag} planner`, detail: { key: "planner.url", value: "http://planner:8000" } });
    const seen = async () => {
      const r = await read<{ entries: { summary: string }[] }>(await auditGet(json("GET", undefined, U(`/api/admin/audit?q=${tag}&limit=50`))));
      return r.body.entries.map((e) => e.summary.replace(`${tag} `, "")).sort();
    };
    expect(await seen()).toEqual(["planner"]);
    const file = await (await auditExport(json("GET", undefined, U(`/api/admin/audit/export?q=${tag}`)))).text();
    expect(file).not.toContain("mail.internal.example");
    expect(file).toContain(`${tag} planner`);
    hook.admin = true;
    expect(await seen()).toEqual(["mail", "planner", "plans", "platform", "stripe", "voice", "voice", "workspace"]);
  });
});

describe("S2: the plan catalogue", () => {
  it("anyone but the platform administrator reads only what /welcome shows", async () => {
    const cat = builtInCatalogue();
    cat.showPrices = false;
    cat.tiers[0] = { ...cat.tiers[0], priceMonthly: 19, stripePriceMonthly: "price_SECRETPLAN1" };
    cat.tiers[1] = { ...cat.tiers[1], shown: false, name: "HiddenTier", priceMonthly: 777 };
    await q("INSERT INTO settings (key, value) VALUES ('plans.catalogue', $1)", [JSON.stringify(cat)]);
    const plain = await (await plansGet(json("GET", undefined, U("/api/admin/plans")))).text();
    for (const secret of ["price_SECRETPLAN1", "HiddenTier", "777", '"priceMonthly":19']) expect(plain, secret).not.toContain(secret);
    hook.admin = true;
    const full = await (await plansGet(json("GET", undefined, U("/api/admin/plans")))).text();
    expect(full).toContain("price_SECRETPLAN1");
    expect(full).toContain("HiddenTier");
  });
});

describe("S8 and S10", () => {
  it("environment values only for the platform administrator", async () => {
    const keep = process.env.PLANNER_URL;
    process.env.PLANNER_URL = "http://planner.internal:8000";
    try {
      const plain = await read<{ variables: { name: string; set: boolean; value: string | null }[] }>(await envGet(json("GET", undefined, U("/api/admin/environment"))));
      expect(plain.body.variables.find((v) => v.name === "PLANNER_URL")).toMatchObject({ set: true, value: null });
      hook.admin = true;
      const full = await read<{ variables: { name: string; value: string | null }[] }>(await envGet(json("GET", undefined, U("/api/admin/environment"))));
      expect(full.body.variables.find((v) => v.name === "PLANNER_URL")?.value).toBe("http://planner.internal:8000");
    } finally {
      if (keep === undefined) delete process.env.PLANNER_URL;
      else process.env.PLANNER_URL = keep;
    }
  });

  it("the credentials PUT answer shows what the caller may see, not the administrator's view", async () => {
    const r = await read<{ provider: { locked?: boolean } }>(await credPut(json("PUT", { fields: { apiKey: "pplx-anyone-0000000000" } }, U("/api/admin/credentials/perplexity")), { params: Promise.resolve({ provider: "perplexity" }) }));
    expect(r.status).toBe(200);
    expect(r.body.provider.locked).toBe(false);
  });
});

describe("S5 and S6: everything not listed open needs the platform administrator", () => {
  it("an unknown or new provider, settings key or test kind is refused to anyone else", async () => {
    // A provider the app does not know cannot be saved by anyone (400); every known one is placed (guardLists.test).
    for (const p of ["voice", "brand-new"]) expect((await credPut(json("PUT", { fields: { apiKey: "x-0000000000" } }, U(`/api/admin/credentials/${p}`)), { params: Promise.resolve({ provider: p }) })).status).toBe(400);
    expect((await credPut(json("PUT", { fields: { secretKey: "sk_test_" + "s5000000000000" } }, U("/api/admin/credentials/stripe")), { params: Promise.resolve({ provider: "stripe" }) })).status).toBe(403);
    expect((await settingsPut(json("PUT", { mail: { mode: "none" } }, U("/api/admin/settings")))).status).toBe(403);
    // A key the schema does not know is refused before the guard (400); once added to the schema it needs placing.
    expect((await settingsPut(json("PUT", { somethingNew: 1 }, U("/api/admin/settings")))).status).toBe(400);
    expect((await testPost(json("POST", { kind: "voice" }, U("/api/admin/test")))).status).toBe(403);
    // Still open, as before: a model host's key and the planner address.
    expect((await settingsPut(json("PUT", { plannerUrl: "http://127.0.0.1:9" }, U("/api/admin/settings")))).status).toBe(200);
  });

  it("the credentials short list hides voice tests' results from anyone else (S6), and keeps the planner's", async () => {
    await q(
      "INSERT INTO settings (key, value) VALUES ('audit.credentials', $1)",
      [JSON.stringify([{ at: "2026-11-22T00:00:00Z", action: "tested", provider: "voice", field: null, result: { ok: false, message: "VOICE-DETAIL kokoro.internal" } }, { at: "2026-11-22T00:00:00Z", action: "tested", provider: "planner", field: null, result: { ok: true, message: "planner fine" } }])]
    );
    const list = await readAudit({ platformAdmin: false });
    expect(JSON.stringify(list)).not.toContain("VOICE-DETAIL");
    expect(JSON.stringify(list)).toContain("planner fine");
  });
});

describe("S4: an unbound credential", () => {
  it("is bound to the provider's own address, never to an address any account can change", async () => {
    await q("INSERT INTO settings (key, value) VALUES ('models.reasoning', $1)", [JSON.stringify({ provider: "openrouter", baseUrl: "http://evil.example.test/api/v1", model: "x" })]);
    await q("INSERT INTO credentials (provider, field, value, bound_origin) VALUES ('openrouter', 'apiKey', 'sk-or-old-0000000000', NULL)");
    expect(await boundOrigin("openrouter", "apiKey")).toBe("https://openrouter.ai");
    await q("INSERT INTO credentials (provider, field, value, bound_origin) VALUES ('kokoro', 'apiKey', 'kokoro-old-0000', NULL)");
    await q("INSERT INTO settings (key, value) VALUES ('voice.tts', $1)", [JSON.stringify({ provider: "kokoro", baseUrl: "http://evil.example.test/v1", model: "k", voice: "v", speed: 1 })]);
    expect(await boundOrigin("kokoro", "apiKey")).toBeNull();
  });
});
