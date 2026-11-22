// One "rig" per printer family: a stand-in, plus the adapter set up against it in the ways the tests need (working, wrong key,
// nothing listening, too slow). The tests in adapters.test.ts run the same interface checks against every rig.
import type { AdapterOptions, PrinterAdapter } from "@/lib/printers/adapter";
import { BambuAdapter } from "@/lib/printers/bambu";
import { DuetAdapter } from "@/lib/printers/duet";
import { MoonrakerAdapter } from "@/lib/printers/moonraker";
import { OctoPrintAdapter } from "@/lib/printers/octoprint";
import { PrusaLinkAdapter } from "@/lib/printers/prusalink";
import * as bambu from "../standins/bambu";
import * as duet from "../standins/duet";
import * as moonraker from "../standins/moonraker";
import * as octoprint from "../standins/octoprint";
import * as prusalink from "../standins/prusalink";

const CLOSED = "http://127.0.0.1:1";

export type Rig = {
  name: string;
  /** a file name this family accepts */
  file: string;
  /** every secret the rig uses, so tests can scan for them */
  secrets: string[];
  /** false when the stand-in cannot say that a pause with no print running is refused */
  refusesIdleControl: boolean;
  up(): Promise<RigRun>;
};

export type RigRun = {
  good(o?: AdapterOptions): PrinterAdapter;
  wrongSecret(o?: AdapterOptions): PrinterAdapter;
  nothingListening(o?: AdapterOptions): PrinterAdapter;
  /** the stand-in starts answering late (or, for Bambu, silently), so a 150 ms limit is hit */
  makeSlow(): void;
  /** what the stand-in was sent that mentions a file name or a secret, as text, for scanning */
  seen(): string;
  /** how many times the stand-in was asked to start printing (a start command, or an upload with print on) */
  startsSeen(): number;
  close(): Promise<void>;
};

const OCTO_KEY = "octo-secret-KEY-7391";
const MOON_KEY = "moon-secret-KEY-5528";
const PRUSA_PW = "prusa-secret-PW-4410";
const PRUSA_KEY = "prusa-secret-APIKEY-8873";
const DUET_PW = "duet-secret-PW-2206";
const BAMBU_CODE = "bambu-code-90417263";

const dump = (reqs: { method: string; path: string; query: Record<string, string>; headers: Record<string, unknown>; body: unknown; rawBody: Buffer }[]) =>
  JSON.stringify(reqs.map((r) => ({ m: r.method, p: r.path, q: r.query, h: r.headers, b: r.rawBody.toString("latin1") })));

export const RIGS: Rig[] = [
  {
    name: "OctoPrint", file: "part.gcode", secrets: [OCTO_KEY], refusesIdleControl: true,
    async up() {
      const s = await octoprint.start({ apiKey: OCTO_KEY });
      const mk = (key: string, url = s.url) => (o?: AdapterOptions) => new OctoPrintAdapter({ address: url, apiKey: key }, o);
      return {
        good: mk(OCTO_KEY), wrongSecret: mk("not-the-key-0000"), nothingListening: mk(OCTO_KEY, CLOSED),
        makeSlow: () => s.set({ delayMs: 700 }),
        seen: () => dump(s.requests),
        startsSeen: () =>
          s.requests.filter((r) => (r.method === "POST" && r.path === "/api/job" && (r.body as { command?: string })?.command === "start") || (r.path === "/api/files/local" && (r.body as { fields?: Record<string, string> })?.fields?.print === "true")).length,
        close: () => s.close(),
      };
    },
  },
  {
    name: "Moonraker", file: "part.gcode", secrets: [MOON_KEY], refusesIdleControl: true,
    async up() {
      const s = await moonraker.start({ apiKey: MOON_KEY });
      const mk = (key: string, url = s.url) => (o?: AdapterOptions) => new MoonrakerAdapter({ address: url, apiKey: key }, o);
      return {
        good: mk(MOON_KEY), wrongSecret: mk("not-the-key-0000"), nothingListening: mk(MOON_KEY, CLOSED),
        makeSlow: () => s.set({ delayMs: 700 }),
        seen: () => dump(s.requests),
        startsSeen: () => s.requests.filter((r) => r.path === "/printer/print/start" || (r.path === "/server/files/upload" && (r.body as { fields?: Record<string, string> })?.fields?.print === "true")).length,
        close: () => s.close(),
      };
    },
  },
  {
    name: "Creality (Moonraker, experimental)", file: "part.gcode", secrets: [MOON_KEY], refusesIdleControl: true,
    async up() {
      const s = await moonraker.start({ apiKey: MOON_KEY });
      const mk = (key: string, url = s.url) => (o?: AdapterOptions) => new MoonrakerAdapter({ address: url, apiKey: key }, { ...o, experimental: true, family: "creality" });
      return {
        good: mk(MOON_KEY), wrongSecret: mk("not-the-key-0000"), nothingListening: mk(MOON_KEY, CLOSED),
        makeSlow: () => s.set({ delayMs: 700 }),
        seen: () => dump(s.requests),
        startsSeen: () => s.requests.filter((r) => r.path === "/printer/print/start").length,
        close: () => s.close(),
      };
    },
  },
  {
    name: "PrusaLink (digest)", file: "part.bgcode", secrets: [PRUSA_PW], refusesIdleControl: true,
    async up() {
      const s = await prusalink.start({ auth: "digest", password: PRUSA_PW });
      const mk = (pw: string, url = s.url) => (o?: AdapterOptions) => new PrusaLinkAdapter({ address: url, username: "maker", password: pw }, o);
      return {
        good: mk(PRUSA_PW), wrongSecret: mk("not-the-password"), nothingListening: mk(PRUSA_PW, CLOSED),
        makeSlow: () => s.set({ delayMs: 700 }),
        seen: () => dump(s.requests),
        startsSeen: () => s.requests.filter((r) => r.method === "POST" && r.path.startsWith("/api/v1/files/")).length + s.requests.filter((r) => r.method === "PUT" && r.headers["print-after-upload"] === "?1").length,
        close: () => s.close(),
      };
    },
  },
  {
    name: "PrusaLink (API key)", file: "part.gcode", secrets: [PRUSA_KEY], refusesIdleControl: true,
    async up() {
      const s = await prusalink.start({ auth: "key", apiKey: PRUSA_KEY, versionOpen: false });
      const mk = (key: string, url = s.url) => (o?: AdapterOptions) => new PrusaLinkAdapter({ address: url, apiKey: key }, o);
      return {
        good: mk(PRUSA_KEY), wrongSecret: mk("not-the-key-0000"), nothingListening: mk(PRUSA_KEY, CLOSED),
        makeSlow: () => s.set({ delayMs: 700 }),
        seen: () => dump(s.requests),
        startsSeen: () => s.requests.filter((r) => r.method === "POST" && r.path.startsWith("/api/v1/files/")).length,
        close: () => s.close(),
      };
    },
  },
  ...(["standalone", "sbc"] as const).map(
    (mode): Rig => ({
      name: `Duet (${mode})`, file: "part.gcode", secrets: [DUET_PW], refusesIdleControl: true,
      async up() {
        const s = await duet.start({ mode, password: DUET_PW });
        const mk = (pw: string, url = s.url) => (o?: AdapterOptions) => new DuetAdapter({ address: url, password: pw }, o);
        return {
          good: mk(DUET_PW), wrongSecret: mk("not-the-password"), nothingListening: mk(DUET_PW, CLOSED),
          makeSlow: () => s.set({ delayMs: 700 }),
          seen: () => dump(s.requests),
          startsSeen: () => s.requests.filter((r) => /M32/i.test(r.query.gcode ?? "") || /M32/i.test(r.rawBody.toString())).length,
          close: () => s.close(),
        };
      },
    })
  ),
  {
    name: "Bambu (MQTT over TLS, FTPS)", file: "part.3mf", secrets: [BAMBU_CODE], refusesIdleControl: false,
    async up() {
      const s = await bambu.start({ accessCode: BAMBU_CODE });
      const mk = (code: string, mqttPort = s.mqttPort) => (o?: AdapterOptions) =>
        new BambuAdapter({ address: s.host, accessCode: code, serial: s.serial }, { ...o, mqttPort, ftpPort: s.ftpPort });
      return {
        good: mk(BAMBU_CODE), wrongSecret: mk("not-the-code-0000"), nothingListening: mk(BAMBU_CODE, 1),
        makeSlow: () => s.set({ silent: true }),
        seen: () => JSON.stringify(s.events),
        startsSeen: () => s.commands.filter((c) => c.command === "project_file" || c.command === "gcode_file").length,
        close: () => s.close(),
      };
    },
  },
];
