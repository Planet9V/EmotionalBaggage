// The supported-printer list (plan 6.0, decision D14). Models released from November 2024 onward, plus earlier models still sold or
// widely owned, each with the adapter that drives it, what must be switched on at the printer, and the page every fact came from.
//
// Rules this file keeps:
//   - Built from the makers' own pages (and, where a maker publishes none for a protocol, the named community notes), read on 21 Nov 2026
//     with a plain HTTP fetch of each page. Not from memory.
//   - A fact that could not be sourced is left out (the field is absent), never guessed. Every Fact carries its own source URL.
//   - A model whose connection could not be confirmed is "file-only": the app gives the file and the steps, and does not talk to it.
//   - `confirmed` says how far the connection claim reaches: "model" (the source names this model), "series" (the source names its
//     series or firmware family, not this model), or "none" (file-only, or a generic class).
//   - Nothing here was tested against a real printer. See docs in the report; the Test button in Admin, Printers is the check.
//   - `tests/printers/models.test.ts` fails if an entry has no source URL, no adapter, or a fact with no source.

export type Fact<T> = { value: T; source: string };

/** The adapters. "file-only" has none: the person gets the file and the steps. */
export type AdapterKind = "bambu" | "prusalink" | "moonraker" | "octoprint" | "duet" | "file-only";

/** The families saved in Admin, Printers. creality and elegoo use the Moonraker adapter and carry the experimental label. */
export type FamilyId = "octoprint" | "moonraker" | "prusalink" | "duet" | "bambu" | "creality" | "elegoo" | "file-only";

export type Volume = { x: number; y: number; z: number; note?: string };

export type PrinterModel = {
  id: string;
  maker: string;
  model: string;
  kind: "fdm" | "resin" | "generic";
  family: FamilyId;
  adapter: AdapterKind;
  experimental: boolean;
  confirmed: "model" | "series" | "none";
  /** the maker's page for this model (or, for a generic class, the protocol's documentation) */
  source: string;
  /** YYYY-MM, with the page that says so */
  released?: Fact<string>;
  volume?: Fact<Volume>;
  nozzles?: Fact<number[]>;
  materials?: Fact<string[]>;
  /** what must be switched on at the printer, in order, with the page that says so */
  atPrinter?: Fact<string[]>;
  /** For Bambu: what changed in firmware and what it means for control and for status */
  firmwareNote?: Fact<string>;
  /** A sentence about this model's connection that the person should read, with its source */
  note?: Fact<string>;
};

const S = {
  bambuDev: "https://wiki.bambulab.com/en/knowledge-sharing/enable-developer-mode",
  bambuLan: "https://wiki.bambulab.com/en/knowledge-sharing/enable-lan-mode",
  bambu3p: "https://wiki.bambulab.com/en/software/third-party-integration",
  bambuSn: "https://wiki.bambulab.com/en/general/find-sn",
  bambuBlog: "https://blog.bambulab.com/updates-and-third-party-integration-with-bambu-connect",
  bambuAuth: "https://blog.bambulab.com/p/a1a5ea3f-ee11-4788-90b0-35f3420713cc/",
  openBambu: "https://github.com/Doridian/OpenBambuAPI/blob/main/mqtt.md",
  prusaHa: "https://www.home-assistant.io/integrations/prusalink",
  prusaSpec: "https://github.com/prusa3d/Prusa-Link-Web/blob/master/spec/openapi.yaml",
  moonraker: "https://moonraker.readthedocs.io/en/latest/external_api/introduction/",
  octoprint: "https://docs.octoprint.org/en/main/api/general.html",
  duet: "https://github.com/Duet3D/RepRapFirmware/wiki/HTTP-requests",
  duetDsf: "https://github.com/Duet3D/DuetSoftwareFramework/wiki/REST-API",
};
const bambuStore = (slug: string) => `https://store.bambulab.com/products/${slug}`;

// What the Bambu wiki says to do, by series (enable-developer-mode page; menu names differ by series).
const BAMBU_STEPS: Record<"H2" | "X" | "P" | "A", string[]> = {
  H2: ["On the printer screen open Settings, then LAN Only, and turn LAN Only mode on.", "Turn on Developer Mode, read the notice, tick the confirmation and select Enable Developer Mode.", "Note the access code the printer shows, and the serial number.", "Enter the printer's IP address, access code and serial number here."],
  X: ["On the printer screen open Settings, then LAN Only, and turn LAN Only mode on.", "Turn on Developer Mode, read the notice, tick the confirmation and select Enable Developer Mode.", "Note the access code the printer shows, and the serial number.", "Insert a microSD card: the wiki says starting a print from the network on X1 series needs one.", "Enter the printer's IP address, access code and serial number here."],
  P: ["On the printer screen open Settings, then WLAN, choose Lan Only mode and select Yes.", "With Lan Only mode ON, scroll down to Developer Mode, read the notice, scroll to the end and select Enable.", "Note the access code the printer shows, and the serial number.", "Enter the printer's IP address, access code and serial number here."],
  A: ["On the printer screen open Settings, then LAN Only Mode, and turn it on.", "Turn on Developer Mode, read the notice, tick the confirmation and select Enable.", "Note the access code the printer shows, and the serial number.", "Enter the printer's IP address, access code and serial number here."],
};
const bambuSteps = (series: keyof typeof BAMBU_STEPS): Fact<string[]> => ({ value: BAMBU_STEPS[series], source: S.bambuDev });
const BAMBU_FW: Fact<string> = {
  value:
    "Bambu added an authorization check to firmware in 2025: control (starting a print from other software, movement, temperatures, AMS) needs Bambu Connect unless Developer Mode is on. X-series first (beta announced 17 Jan 2025: firmware 01.08.03.00 or above; the release thread is titled 01.08.05.00), then P-series and A-series in later firmware (no version number for P and A was found on a Bambu page). Developer Mode works as the earlier firmware did, needs no authorization, and cannot be used with Bambu Cloud. Bambu says its MQTT status pushes are not affected by the check, but whether status works without Developer Mode on the newest firmware was not confirmed: use the Test button. Bambu does not support Developer Mode.",
  source: S.bambu3p,
};

const bambu = (m: Omit<PrinterModel, "kind" | "family" | "adapter" | "experimental" | "atPrinter" | "firmwareNote" | "confirmed"> & { series: keyof typeof BAMBU_STEPS; confirmed?: PrinterModel["confirmed"] }): PrinterModel => {
  const { series, confirmed, ...rest } = m;
  return { ...rest, maker: "Bambu Lab", kind: "fdm", family: "bambu", adapter: "bambu", experimental: false, confirmed: confirmed ?? "series", atPrinter: bambuSteps(series), firmwareNote: BAMBU_FW };
};

const fileOnly = (m: Omit<PrinterModel, "family" | "adapter" | "experimental" | "confirmed" | "kind"> & { kind?: PrinterModel["kind"] }): PrinterModel => ({
  kind: "fdm", ...m, family: "file-only", adapter: "file-only", experimental: false, confirmed: "none",
});

export const MODELS: PrinterModel[] = [
  // ---- Bambu Lab: A, P, X, H series as sold in the maker's store on 21 Nov 2026 (store.bambulab.com/collections/3d-printer), plus the X1 Carbon.
  bambu({ id: "bambu-a1-mini", maker: "Bambu Lab", model: "A1 mini", series: "A", source: bambuStore("a1-mini"),
    volume: { value: { x: 180, y: 180, z: 180 }, source: bambuStore("a1-mini") }, nozzles: { value: [0.2, 0.4, 0.6, 0.8], source: bambuStore("a1-mini") },
    materials: { value: ["PLA", "PETG", "TPU", "PVA"], source: bambuStore("a1-mini") } }),
  bambu({ id: "bambu-a1", maker: "Bambu Lab", model: "A1", series: "A", source: bambuStore("a1"),
    volume: { value: { x: 256, y: 256, z: 256 }, source: bambuStore("a1") }, nozzles: { value: [0.2, 0.4, 0.6, 0.8], source: bambuStore("a1") },
    materials: { value: ["PLA", "PETG", "TPU", "PVA"], source: bambuStore("a1") } }),
  bambu({ id: "bambu-a2l", maker: "Bambu Lab", model: "A2L", series: "A", source: bambuStore("a2l"),
    released: { value: "2026-06", source: "https://www.tomshardware.com/3d-printing/bambu-lab-launches-big-bed-slinger-a2l-companys-h2s-lite-is-half-the-cost-of-h2s-at-just-usd469" },
    volume: { value: { x: 330, y: 320, z: 325 }, source: bambuStore("a2l") } }),
  bambu({ id: "bambu-p1s", maker: "Bambu Lab", model: "P1S", series: "P", source: bambuStore("p1s"), confirmed: "model",
    volume: { value: { x: 256, y: 256, z: 256 }, source: bambuStore("p1s") }, nozzles: { value: [0.2, 0.4, 0.6, 0.8], source: bambuStore("p1s") } }),
  bambu({ id: "bambu-p2s", maker: "Bambu Lab", model: "P2S", series: "H2", source: bambuStore("p2s"), confirmed: "model",
    released: { value: "2025-10", source: "https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series" },
    volume: { value: { x: 256, y: 256, z: 256 }, source: bambuStore("p2s") } }),
  bambu({ id: "bambu-x2d", maker: "Bambu Lab", model: "X2D", series: "X", source: bambuStore("x2d"),
    volume: { value: { x: 256, y: 256, z: 260 }, source: bambuStore("x2d") } }),
  bambu({ id: "bambu-x1c", maker: "Bambu Lab", model: "X1 Carbon", series: "X", source: S.bambuDev, confirmed: "series" }),
  bambu({ id: "bambu-h2d", maker: "Bambu Lab", model: "H2D", series: "H2", source: bambuStore("h2d"), confirmed: "model",
    released: { value: "2025-03", source: "https://blog.bambulab.com/bambu-lab-launches-h2d-to-rethink-personal-manufacturing" },
    volume: { value: { x: 325, y: 320, z: 325, note: "single nozzle; dual nozzle 300 x 320 x 325" }, source: bambuStore("h2d") },
    nozzles: { value: [0.2, 0.4, 0.6, 0.8], source: bambuStore("h2d") } }),
  bambu({ id: "bambu-h2s", maker: "Bambu Lab", model: "H2S", series: "H2", source: bambuStore("h2s"), confirmed: "model",
    released: { value: "2025-08", source: "https://blog.bambulab.com/h2s-the-ultimate-single-nozzle-3d-printer-now-bigger-than-ever" },
    volume: { value: { x: 340, y: 320, z: 340 }, source: bambuStore("h2s") } }),
  bambu({ id: "bambu-h2c", maker: "Bambu Lab", model: "H2C", series: "H2", source: bambuStore("h2c"), confirmed: "model",
    released: { value: "2025-11", source: "https://www.tomshardware.com/3d-printing/bambu-lab-launches-beastly-seven-nozzle-3d-printer-at-formnext-h2c-model-launches-everywhere-but-the-us-due-to-tarrifs" },
    volume: { value: { x: 330, y: 320, z: 325 }, source: bambuStore("h2c") } }),
  bambu({ id: "bambu-h3c", maker: "Bambu Lab", model: "H3C", series: "H2", source: bambuStore("h3c"),
    volume: { value: { x: 330, y: 320, z: 325 }, source: bambuStore("h3c") } }),

  // ---- Prusa: the Prusa store's 3D printer list on 21 Nov 2026 (CORE One+, CORE One L+, XL+, MK4S, MINI+).
  ...(
    [
      ["prusa-core-one", "CORE One+", "https://www.prusa3d.com/product/prusa-core-one/", { x: 250, y: 220, z: 270 }, "series"],
      ["prusa-core-one-l", "CORE One L+", "https://www.prusa3d.com/product/prusa-core-one-l-2/", { x: 300, y: 300, z: 330 }, "series"],
      ["prusa-mk4s", "MK4S", "https://www.prusa3d.com/product/original-prusa-mk4s-3d-printer/", { x: 250, y: 210, z: 220 }, "series"],
      ["prusa-xl", "XL+", "https://www.prusa3d.com/product/original-prusa-xl-single-toolhead-3d-printer/", undefined, "model"],
      ["prusa-mini", "MINI+", "https://www.prusa3d.com/product/original-prusa-mini-semi-assembled-3d-printer-enclosure-bundle-5/", undefined, "model"],
    ] as [string, string, string, Volume | undefined, PrinterModel["confirmed"]][]
  ).map(([id, model, source, vol, confirmed]): PrinterModel => ({
    id, maker: "Prusa Research", model, kind: "fdm", family: "prusalink", adapter: "prusalink", experimental: false, confirmed, source,
    ...(vol ? { volume: { value: vol, source } } : {}),
    atPrinter: {
      value: [
        "On the printer open Settings, then Network, then PrusaLink.",
        "Note the printer's IP address. On some models the user name is not shown because it is fixed to maker; the password entry may be called API key.",
        "Enter the address and the password (and the user name if shown) here. The printer signs in with HTTP digest.",
        "Firmware: the v1 interface needs 4.7.0 or later (the MINI needs 5.1.0 or later).",
      ],
      source: S.prusaHa,
    },
    note: { value: "Confirmed for the MINI/MINI+, MK3.9/MK4, XL and CORE One on Home Assistant's PrusaLink page, and the PrusaLink interface file is Prusa's own. The CORE One L, CORE One+ and MK4S are not named on either page; they run the same family of firmware, which has not been confirmed for them.", source: S.prusaHa },
  })),

  // ---- Klipper makers. The Elegoo and Creality entries are experimental: their makers publish no Moonraker documentation.
  {
    id: "sovol-sv08", maker: "Sovol", model: "SV08", kind: "fdm", family: "moonraker", adapter: "moonraker", experimental: false, confirmed: "model",
    source: "https://wiki.sovol3d.com/en/SV08",
    atPrinter: { value: ["The printer runs Mainsail and Moonraker (Sovol's firmware log names both). Find its IP address on the printer screen or your router.", "Enter the address; the port is 7125 unless changed. Add an API key only if Moonraker's authorization is on."], source: "https://wiki.sovol3d.com/en/SV08" },
  },
  {
    id: "qidi-plus4", maker: "QIDI", model: "Plus4", kind: "fdm", family: "moonraker", adapter: "moonraker", experimental: false, confirmed: "model",
    source: "https://wiki.qidi3d.com/en/PLUS4/WIFI",
    note: { value: "QIDI's wiki says the Plus4 uses Fluidd and that an API key is needed when a Fluidd account is set; its store page says the Plus4 is discontinued.", source: "https://qidi3d.com/products/plus4-3d-printer" },
    atPrinter: { value: ["Connect the printer to your network: Settings, General Settings, Network shows its IP address.", "Fluidd runs on the printer. If a Fluidd account is set, enter its API key here.", "Enter the address; the port is 7125 unless changed."], source: "https://wiki.qidi3d.com/en/PLUS4/WIFI" },
  },
  {
    id: "elegoo-neptune-4-plus", maker: "Elegoo", model: "Neptune 4 Plus", kind: "fdm", family: "elegoo", adapter: "moonraker", experimental: true, confirmed: "series",
    source: "https://us.elegoo.com/products/neptune-4-plus-fdm-3d-printer",
    note: { value: "Elegoo's wiki says the Neptune 4 series uses a customized version of Klipper and Fluidd. It does not document Moonraker access, so this is experimental: confirm with the Test button.", source: "https://wiki.elegoo.com/neptune/neptune-4-series-mcu-rpi-shutdown-force-shutdown-command" },
    atPrinter: { value: ["Connect the printer to your network and find its IP address.", "Enter the address; the port is 7125 unless changed. Do not install firmware Elegoo did not provide: its wiki says that can brick the printer."], source: "https://wiki.elegoo.com/neptune/neptune-4-series-mcu-rpi-shutdown-force-shutdown-command" },
  },
  {
    id: "creality-k1-series", maker: "Creality", model: "K1, K1C and K1 Max", kind: "fdm", family: "creality", adapter: "moonraker", experimental: true, confirmed: "series",
    source: "https://github.com/CrealityOfficial/K1_Series_Klipper",
    note: { value: "Creality publishes the Klipper project it uses on the K1 series. It does not say that Moonraker is reachable on the network without changes to the printer, so this is experimental: confirm with the Test button.", source: "https://github.com/CrealityOfficial/K1_Series_Klipper" },
    atPrinter: { value: ["Connect the printer to your network and find its IP address.", "Enter the address; Moonraker's port is 7125 unless changed. If nothing answers, the printer's own firmware may not expose Moonraker; then use file only."], source: "https://github.com/CrealityOfficial/K1_Series_Klipper" },
  },
  {
    id: "klipper-generic", maker: "Voron and other Klipper machines", model: "Any machine running Klipper with Moonraker", kind: "generic", family: "moonraker", adapter: "moonraker", experimental: false, confirmed: "none",
    source: S.moonraker,
    atPrinter: { value: ["Moonraker reachable from this machine (port 7125 by default).", "If its authorization is on, this machine's address must be a trusted client or an API key must be given."], source: "https://moonraker.readthedocs.io/en/latest/external_api/authorization/" },
  },
  {
    id: "duet-generic", maker: "Duet3D boards", model: "Any machine on a Duet board running RepRapFirmware", kind: "generic", family: "duet", adapter: "duet", experimental: false, confirmed: "none",
    source: S.duet,
    note: { value: "Standalone boards answer the rr_ interface; boards with a single-board computer answer the DSF REST interface. The app asks the board which it is.", source: S.duetDsf },
    atPrinter: { value: ["The board's network and web server on. A machine password is optional; \"reprap\" is what RepRapFirmware uses when none is sent."], source: S.duet },
  },
  {
    id: "octoprint-generic", maker: "OctoPrint", model: "Any printer behind OctoPrint", kind: "generic", family: "octoprint", adapter: "octoprint", experimental: false, confirmed: "none",
    source: S.octoprint,
    atPrinter: { value: ["OctoPrint running and reachable from this machine.", "An API key made for this app, sent in the X-Api-Key header."], source: S.octoprint },
  },

  // ---- File only: no connection that a maker page confirmed. The app gives the file and the steps.
  fileOnly({ id: "elegoo-centauri-carbon-2", maker: "Elegoo", model: "Centauri Carbon 2", source: "https://us.elegoo.com/products/centauri-carbon-2",
    volume: { value: { x: 256, y: 256, z: 256 }, source: "https://us.elegoo.com/products/centauri-carbon-2" },
    note: { value: "The SDCP network protocol Elegoo's mainboard maker publishes describes resin printers and CTB files; no FDM local interface from Elegoo was found, so this model is file only.", source: "https://github.com/cbd-tech/SDCP-Smart-Device-Control-Protocol-V3.0.0" } }),
  fileOnly({ id: "elegoo-centauri-2", maker: "Elegoo", model: "Centauri 2", source: "https://us.elegoo.com/products/centauri-2" }),
  fileOnly({ id: "creality-hi", maker: "Creality", model: "Hi", source: "https://www.creality.com/products/creality-hi-combo" }),
  fileOnly({ id: "anycubic-kobra-s1-max", maker: "Anycubic", model: "Kobra S1 Max", source: "https://store.anycubic.com/products/kobra-s1-max",
    volume: { value: { x: 350, y: 350, z: 350 }, source: "https://store.anycubic.com/products/kobra-s1-max" } }),
  fileOnly({ id: "anycubic-kobra-4", maker: "Anycubic", model: "Kobra 4", source: "https://store.anycubic.com/products/kobra-4-3d-printer" }),
  fileOnly({ id: "anycubic-kobra-x", maker: "Anycubic", model: "Kobra X", source: "https://store.anycubic.com/products/kobra-x" }),
  fileOnly({ id: "anycubic-kobra-3-max-v2", maker: "Anycubic", model: "Kobra 3 Max V2", source: "https://store.anycubic.com/products/kobra-3-max-v2-3d-printer" }),
  fileOnly({ id: "qidi-q2", maker: "QIDI", model: "Q2", source: "https://qidi3d.com/products/qidi-q2",
    volume: { value: { x: 270, y: 270, z: 256 }, source: "https://qidi3d.com/products/qidi-q2" } }),
  fileOnly({ id: "qidi-max4", maker: "QIDI", model: "Max4", source: "https://qidi3d.com/products/max4" }),
  fileOnly({ id: "qidi-plus5", maker: "QIDI", model: "Plus5", source: "https://qidi3d.com/products/plus5" }),
  fileOnly({ id: "flashforge-adventurer-5m", maker: "FlashForge", model: "Adventurer 5M", source: "https://www.flashforge.com/products/adventurer-5m-3d-printer" }),
  fileOnly({ id: "anycubic-photon-p1", maker: "Anycubic", model: "Photon P1", kind: "resin", source: "https://store.anycubic.com/products/photon-p1-resin-3d-printer" }),
  fileOnly({ id: "anycubic-photon-mono-m7-max", maker: "Anycubic", model: "Photon Mono M7 Max", kind: "resin", source: "https://store.anycubic.com/products/photon-mono-m7-max" }),
  fileOnly({ id: "elegoo-saturn-4-ultra-16k", maker: "Elegoo", model: "Saturn 4 Ultra 16K", kind: "resin", source: "https://us.elegoo.com/products/saturn-4-ultra-16k-10inch-monochrome-lcd-resin-3d-printer" }),
];

/** The steps for a printer with no adapter. They are general: this app has not read each maker's manual. */
export const FILE_ONLY_STEPS: Fact<string[]> = {
  value: [
    "Download the sliced file from this app.",
    "Get it onto the printer the way its maker describes: its own slicer or app, a USB drive or an SD card.",
    "Check the filament and the bed at the printer, then start the print there.",
    "Record the result in the build here once it is done.",
  ],
  source: "this app",
};

export function findModel(id: string): PrinterModel | undefined {
  return MODELS.find((m) => m.id === id);
}

/** Models grouped by maker, in the order the list is written. */
export function modelsByMaker(): { maker: string; models: PrinterModel[] }[] {
  const out: { maker: string; models: PrinterModel[] }[] = [];
  for (const m of MODELS) {
    const g = out.find((x) => x.maker === m.maker);
    if (g) g.models.push(m);
    else out.push({ maker: m.maker, models: [m] });
  }
  return out;
}

/** Every fact in the list with its source, for the check and for the documentation page. */
export function factsOf(m: PrinterModel): { field: string; source: string }[] {
  const out = [{ field: "model", source: m.source }];
  for (const k of ["released", "volume", "nozzles", "materials", "atPrinter", "firmwareNote", "note"] as const) {
    const f = m[k] as Fact<unknown> | undefined;
    if (f) out.push({ field: k, source: f.source });
  }
  return out;
}

const ADAPTERS: AdapterKind[] = ["bambu", "prusalink", "moonraker", "octoprint", "duet", "file-only"];
const FAMILIES: FamilyId[] = ["octoprint", "moonraker", "prusalink", "duet", "bambu", "creality", "elegoo", "file-only"];

/** Problems with the list; empty when it is sound. Used by the test and by the build check. */
export function validateModels(models: PrinterModel[] = MODELS): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const m of models) {
    const at = `${m.maker} ${m.model}`;
    if (ids.has(m.id)) problems.push(`${at}: duplicate id ${m.id}`);
    ids.add(m.id);
    if (!ADAPTERS.includes(m.adapter)) problems.push(`${at}: no adapter`);
    if (!FAMILIES.includes(m.family)) problems.push(`${at}: unknown family ${m.family}`);
    for (const f of factsOf(m)) if (!/^https:\/\/\S+$/.test(f.source) && f.source !== "this app") problems.push(`${at}: ${f.field} has no source page`);
    if (m.adapter !== "file-only" && !m.atPrinter) problems.push(`${at}: says what to switch on at the printer? missing`);
    if (m.adapter === "file-only" && m.family !== "file-only") problems.push(`${at}: file-only model with family ${m.family}`);
    if ((m.family === "creality" || m.family === "elegoo") && !m.experimental) problems.push(`${at}: Creality and Elegoo are experimental`);
    if (m.released && !/^\d{4}-(0[1-9]|1[0-2])$/.test(m.released.value)) problems.push(`${at}: release month must be YYYY-MM`);
    if (m.adapter === "bambu" && !m.firmwareNote) problems.push(`${at}: Bambu models say which firmware changed the rules`);
  }
  return problems;
}
