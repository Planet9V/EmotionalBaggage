import { readFileSync, appendFileSync } from "node:fs";
const DIR = process.env.WALK_DIR ?? process.cwd();
const mode = (): Record<string, unknown> => {
  try { return JSON.parse(readFileSync(`${DIR}/mode.json`, "utf8")); } catch { return {}; }
};
const log = (s: string) => appendFileSync(`${DIR}/standin.log`, s + "\n");

const J = (o: unknown) => JSON.stringify(o);
/** the drafting engine asks for { rows: [ <the generator's own output> ] } */
const W = (o: unknown) => JSON.stringify({ rows: [o] });
const ids = (re: RegExp, s: string) => [...s.matchAll(re)].map((m) => m[1]);

function adFields(system: string, variant: number, name: string, m: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  const re = /^- "(\w+)" \((array of strings|string)(, required)?\): ([^\n]*)$/gm;
  for (const x of system.matchAll(re)) {
    const [, key, kind, , rest] = x;
    const maxM = /at most (\d+) characters/.exec(rest);
    const max = maxM ? Number(maxM[1]) : 80;
    const items = /(\d+) to (\d+) items/.exec(rest);
    const choices = /one of: ([^.]*)/.exec(rest);
    const mk = (base: string) => (base.length > max ? base.slice(0, max).trim() : base);
    const word = key.toLowerCase();
    let v: string;
    if (choices) v = choices[1].split("|")[0].trim();
    else if (/asin/.test(word)) v = "B0TESTASIN";
    else if (/url|link/.test(word)) v = "";
    else if (/headline|title/.test(word)) v = mk(`${name} ${["keeps it simple", "built to last", "made for daily use", "a calmer way", "less fuss"][variant % 5]}`);
    else if (/cta|call/.test(word)) v = mk("Learn More");
    else v = mk(`${name}: a plain, practical answer to the problem. Take ${['A','B','C','D','E'][variant % 5]}.`);
    if ((m.adOverLimit as boolean) && /headline|title/.test(word) && max < 400) v = "X".repeat(max + 20);
    if ((m.adNumber as boolean) && /primary|text|description|body/.test(word) && variant === 0) v = mk(`${name} cuts setup time by 40% and is the best in class.`);
    fields[key] = kind === "array of strings" ? Array.from({ length: Math.min(items ? Number(items[1]) + 1 : 3, items ? Number(items[2]) : 5) }, (_, i) => mk(`${v || word} ${['one','two','three','four','five','six'][i]}`.slice(0, max))) : v;
  }
  return fields;
}

export function answer(system: string, user: string): string {
  const m = mode();
  const name = /Concept: (.*?)\. /.exec(user)?.[1] ?? "The product";
  const electronics = /Product type: electronics/.test(user);
  log(`[${new Date().toISOString()}] ${system.slice(0, 90).replace(/\n/g, " ")}`);
  const has = (s: string) => system.includes(s);

  if (has("attack the positioning below once")) return "- Weakest claim: the line names a buyer too broad to reach.\n- Message 2 has no proof, only a requirement.\n- Doing nothing beats it for a buyer who tolerates the problem.\n- Not for people who want the cheapest option.\n- The phrase in message 1 is jargon.";
  if (has("You review product concepts")) return "Who pays for this, and what do they use today? What evidence says that problem is worth solving at your price?";
  if (user.includes("This is a revision, not a fresh draft")) {
    const blockTxt = user.split("Rows you may change:")[1] ?? "";
    const rows = [...blockTxt.matchAll(/^#(\d+) \[[^\]]*\] ([^:(\n]*?)(?:: ([^\n(]*?))?(?: \(([^\n]*)\))?$/gm)].map((x) => ({ id: Number(x[1]), title: x[2].trim(), body: (x[3] ?? "").trim(), f: x[4] ?? "" }));
    const fv = (f: string, k: string) => new RegExp("(?:^|; )" + k + "=([^;]*)").exec(f)?.[1] ?? "";
    if (has("candidate parts list")) return J({ rows: rows.map((r) => ({ replaces: r.id, ref: fv(r.f, "ref"), title: r.title + " (revised)", spec: r.body + " Revised for the new size.", kind: fv(r.f, "kind") || "mechanical", qty: Number(fv(r.f, "qty")) || 1 })) });
    if (has("acceptance tests a prototype must pass")) return J({ rows: rows.map((r) => ({ replaces: r.id, title: r.title + " (revised)", method: "Re-run with the new limit.", pass: "Meets the new limit", requirements: fv(r.f, "requirements").split("|").filter(Boolean) })) });
    if (has("assembly of a first prototype")) return J({ rows: rows.map((r, i) => ({ replaces: r.id, step: Number(fv(r.f, "order")) || i + 1, title: r.title, detail: r.body + " Check against the new size.", minutes: Number(fv(r.f, "minutes")) || 10 })) });
    return J({ rows: [] });
  }
  // ---- drafting chain
  if (has("press release a company would publish")) return J({ rows: [{ headline: `${name} launches`, text: `Today the makers of ${name} announced the product.\n\nIt addresses a plain problem for buyers. Prices and dates are to be confirmed.\n\n"We built it to be simple," said a company spokesperson (illustrative).\n\n"It fixed my problem," said a customer (illustrative).`, basedOn: ids(/^#(\d+) /gm, user).slice(0, 2).map(Number) }] });
  if (has("frequently asked questions")) return J({ rows: Array.from({ length: 6 }, (_, i) => ({ question: `Question ${i + 1} about ${name}?`, answer: `Answer ${i + 1}: this is not yet known and will be found out by testing.` })) });
  if (has("requirements an engineer can design")) return J({ rows: Array.from({ length: 5 }, (_, i) => ({ title: `Requirement ${i + 1}: ${["Works as described", "Is safe to handle", "Fits a bag", "Lasts a day", "Is easy to set up"][i]}`, detail: `The product shall meet this, checked by a bench test (limit to be confirmed).`, ...(i === 0 ? { trigger: "user presses start", response: "product starts" } : {}) })) });
  if (has("candidate parts list")) {
    const keys = ids(/key=(req-\d+)/g, user);
    const rows = electronics
      ? [
          { ref: "U1", title: "Microcontroller board", spec: "Dev board with 3.3 V logic", kind: "microcontroller", qty: 1, pins: [{ name: "3V3", role: "power out" }, { name: "GND", role: "ground" }, { name: "GPIO4", role: "bidirectional" }], size: { x: 25, y: 5, z: 50 }, requirements: keys.slice(0, 2) },
          { ref: "S1", title: "Sensor module", spec: "I2C sensor module", kind: "sensor", qty: 1, pins: [{ name: "VCC", role: "power in" }, { name: "GND", role: "ground" }, { name: "SDA", role: "bidirectional" }], size: { x: 20, y: 4, z: 15 }, requirements: keys.slice(0, 1) },
          { ref: "BT1", title: "Battery", spec: "Li-ion 18650", kind: "battery", qty: 1, pins: [{ name: "+", role: "power out" }, { name: "-", role: "ground" }], size: { x: 18, y: 18, z: 65 }, requirements: keys.slice(2, 4) },
        ]
      : [
          { ref: "HW1", title: "Beech panel set", spec: "Sanded beech panels, 6 mm", kind: "mechanical", qty: 1, size: { x: 120, y: 6, z: 120 }, requirements: keys.slice(0, 2) },
          { ref: "HW2", title: "Wood screws", spec: "M3 x 12 screws", kind: "fastener", qty: 8, requirements: keys.slice(2, 3) },
        ];
    return J({ rows });
  }
  if (has("propose the wires")) {
    const lines = [...user.matchAll(/^(\w+) #\d+ [^:]*: (.*)$/gm)].map((x) => ({ ref: x[1], pins: x[2].split(", ").map((p) => p.replace(/ \(.*\)$/, "")) }));
    const u1 = lines.find((l) => l.ref === "U1"), s1 = lines.find((l) => l.ref === "S1"), b = lines.find((l) => l.ref === "BT1");
    const rows: unknown[] = [];
    if (u1 && s1) { rows.push({ title: "Sensor power", from: "U1.3V3", to: "S1.VCC", net: "3V3", netClass: "power" }, { title: "Sensor ground", from: "U1.GND", to: "S1.GND", net: "GND", netClass: "ground" }, { title: "Sensor data", from: "U1.GPIO4", to: "S1.SDA", net: "SDA", netClass: "signal", note: "Check a pull-up." }); }
    if (u1 && b) rows.push({ title: "Battery ground", from: "BT1.-", to: "U1.GND", net: "GND", netClass: "ground" });
    return J({ rows });
  }
  if (has("assembly of a first prototype")) {
    const refs = ids(/ref=(\w+)/g, user);
    return J({ rows: Array.from({ length: 4 }, (_, i) => ({ step: i + 1, title: ["Lay out the parts", "Join the main parts", "Close up", "Final check"][i], detail: "Do this and check it. Time is a guess.", minutes: 20 + i * 10, parts: refs.slice(0, 2) })) });
  }
  if (has("acceptance tests a prototype must pass")) {
    const keys = ids(/key=(req-\d+)/g, user);
    return J({ rows: keys.map((k) => ({ title: `Test for ${k}`, method: "Run it on the bench and record the result.", pass: "Meets the stated limit", requirements: [k] })) });
  }
  if (has("cheaper substitutes")) { const id = Number(/^#(\d+) /m.exec(user.split("Parts (line=")[1] ?? "")?.[1] ?? 0); return J({ rows: id ? [{ replaces: id, title: "Pine panel set", spec: "Pine instead of beech", reason: "Pine costs less; it gives up hardness." }] : [] }); }
  if (has("design-for-assembly check")) {
    // merge rows that are the same part listed twice (same title)
    const rows = [...user.matchAll(/^#(\d+) \[[^\]]*\] ([^:(\n]+)/gm)].map((x) => ({ id: Number(x[1]), title: x[2].trim() }));
    const seen = new Map<string, number>(); const out: unknown[] = [];
    for (const r of rows) { const k = r.title.toLowerCase(); if (seen.has(k)) out.push({ action: "merge", replaces: seen.get(k), mergeWith: [r.id], title: `${r.title} (one row, quantity 2)`, spec: "The same part listed once", reason: "The same part is listed twice; neither moves, needs another material or comes apart for service." }); else seen.set(k, r.id); }
    return J({ rows: out });
  }
  if (has("3D print jobs")) {
    const ids = [...user.split("Print jobs")[1]?.split("\n\n")[0].matchAll(/^#(\d+) /gm) ?? []].map((x) => Number(x[1]));
    return J({ rows: ids.slice(-1).map((id) => ({ replaces: id, layerHeight: 0.28, infill: 15, reason: "Taller layers mean fewer layers; the shell is not seen up close." })) });
  }
  // ---- market
  if (has("audience personas for a product concept")) return W({ personas: [{ name: "Careful Chris", who: "A practical buyer", job: "Get the job done without fuss", trigger: "A past failure", objection: "Is it worth the price?", whereTheyLook: "Reviews and forums", theirWords: [], drewOn: ids(/\[id (\d+)/g, user).slice(0, 1).map((id) => ({ kind: "brief", id: Number(id) })) }, { name: "Busy Bea", who: "A time-poor buyer", job: "Save time", trigger: "A deadline", objection: "Will it last?", whereTheyLook: "Search and social", theirWords: [], drewOn: [] }] });
  if (has("list the competitors and alternatives it names")) {
    const urls = [...user.matchAll(/^\[\d+\] (\S+)/gm)].map((x) => x[1]);
    return W({ rows: [{ name: "Rival One", kind: "product", what: "A similar product", priceText: "$29.99", claim: "Says it is simple", weakness: "Reported to break", sourceUrl: urls[0] ?? "" }, { name: "Doing nothing", kind: "alternative", what: "Keep the current way", priceText: "", claim: "", weakness: "", sourceUrl: "" }, { name: "Rival Two", kind: "product", what: "A premium option", priceText: "$99", claim: "Premium", weakness: "", sourceUrl: "https://not-a-source.example/x" }] });
  }
  if (has("product positioning from the audience")) {
    const proof = ids(/^- \[id (\d+), [^\]]*\]/gm, (user.split("PROOF you may link")[1] ?? "")).map(Number);
    return W({ forWhom: "careful buyers", need: "a dependable answer", productIs: "simple product", thatDoes: "solves the problem plainly", unlike: "doing nothing", difference: "works the first time", messages: [{ text: "It works the first time you use it.", proofIds: proof.slice(0, 1) }, { text: "It is made to be repaired, not replaced.", proofIds: [] }, { text: "You can check how it works.", proofIds: [] }] });
  }
  if (has("suggest names and taglines")) return W({ candidates: [{ text: "Plainkit", kind: "Name", reason: "Short and plain" }, { text: "Make it work", kind: "Tagline", reason: "Says the job" }, { text: "Steady", kind: "Name", reason: "Calm" }] });
  if (has("check a piece of marketing text against a brand voice")) return W({ verdict: "Mostly on voice.", suggestions: [{ before: "amazing", after: "useful", why: "Voice avoids superlatives" }] });
  // ---- content
  const approvedMsgs = [...user.matchAll(/messageId "(\d+:\d+)": (.*)$/gm)];
  const mid = approvedMsgs[0]?.[1] ?? "0:0";
  const proofIds = ids(/^- #(\d+) (?:verified|passing|requirement|approved|[a-z ]+):/gm, user.split("Proof rows you may link")[1] ?? "").map(Number);
  const common = (n = 0) => ({ messageId: approvedMsgs[n % Math.max(1, approvedMsgs.length)]?.[1] ?? mid, proofIds: proofIds.slice(0, 1) });
  const mm = /^You write (.*?) ad variants for a product/m.exec(system);
  if (mm) return J({ rows: Array.from({ length: 3 }, (_, i) => ({ ...common(i), fields: adFields(system, i, name, m), stopRule: "Stop when cost per order stays above the ceiling after enough spend; scale when well below it." })) });
  if (has("sections of a one-page landing page")) {
    const comps = ids(/^- #(\d+) /gm, user.split("Sourced competitors you may compare against:")[1]?.split("\n\n")[0] ?? "").map(Number);
    const rows: unknown[] = [
      { ...common(), kind: "hero", content: { headline: `${name}, made plain`, subhead: "A simple answer to a real problem.", ctaLabel: "Join the list" } },
      { ...common(), kind: "problem", content: { heading: "What you live with today", points: ["It is fiddly.", "It breaks.", "It costs more than it should."] } },
      { ...common(), kind: "how", content: { heading: "How it works", steps: [{ title: "Set up", text: "Take it out of the box." }, { title: "Use", text: "Use it every day." }, { title: "Repair", text: "Fix it if it breaks." }] } },
      { ...common(), kind: "faq", content: { heading: "Questions", items: [{ q: "When does it ship?", a: "To be confirmed." }, { q: "What does it cost?", a: "To be confirmed." }, { q: "Can I fix it?", a: "Yes, that is the idea." }, { q: "Is it safe?", a: "Testing is under way." }] } },
      { ...common(), kind: "price", content: { heading: "Price", note: "To be confirmed.", ctaLabel: "Join the list", priceItemId: null } },
      { ...common(), kind: "footer", content: { text: `${name} is a concept under development.` } },
    ];
    if (proofIds.length) rows.splice(3, 0, { ...common(), kind: "proof", content: { heading: "What we can show", items: [{ claim: "Checked", evidence: "A passing test", proofItemId: proofIds[0] }] } });
    if (comps.length) rows.splice(4, 0, { ...common(), kind: "comparison", content: { heading: "Compared", ourLine: "We are simpler.", competitorIds: comps } });
    return J({ rows });
  }
  if (has("Amazon product listing")) return J({ rows: [{ ...common(), title: `${name} Simple Everyday Product, Practical Design`, bullets: ["Simple to set up in minutes", "Made for daily use", "Designed to be repaired", "Clear instructions included", "Backed by plain support"], description: "A plain product for a plain job. Dates and prices to be confirmed.", searchTerms: "simple practical everyday" }] });
  if (has("posts for a product: seven posts")) return J({ rows: Array.from({ length: 7 }, (_, i) => ({ ...common(i), text: `Day ${["one","two","three","four","five","six","seven"][i]}: a plain note about ${name}. ${(m.socialLong as boolean) && i === 0 ? "Z".repeat(400) : ""}`, mediaShotKeys: [] })) });
  if (has("launch email from the approved press release")) return J({ rows: [{ ...common(), subjects: ["It is here", "Meet it", "Now open"], previewText: "A short note", body: "Hello.\n\nIt is ready to be confirmed.\n\nSee the page for more." }] });
  if (has("short note a founder sends")) return J({ rows: [{ ...common(), subjects: ["A story for you"], body: "Hello. We make a simple product. Would you like a closer look? Details to be confirmed." }] });
  if (has("three-email launch sequence")) return J({ rows: [1, 2, 3].map((n) => ({ ...common(), step: n, sendOffsetDays: n === 1 ? -7 : n === 2 ? 0 : 7, goal: "Keep interest", subjects: [`Email ${n}`], previewText: "", body: "A short body. To be confirmed." })) });
  // ---- campaigns
  if (has("advertising and promotion campaigns for a product")) {
    const personas = ids(/^#(\d+) \[/gm, user.split("Personas:")[1]?.split("\n\n")[0] ?? "").map(Number);
    const chans = ids(/^#(\d+) /gm, user.split("Sales channels and what each earns:")[1]?.split("\n\n")[0] ?? "").map(Number);
    const msg = /\(positioning row #\d+\) (.*)$/m.exec(user)?.[1] ?? "";
    const ads = ids(/^#(\d+) /gm, user.split("Ads you may link:")[1]?.split("\n\n")[0] ?? "").map(Number);
    return J({ rows: [
      { title: "Conversion on main channel", objective: "conversion", channelId: chans[0], adChannel: "Amazon Sponsored Products", personaId: personas[0], message: msg, creativeIds: ads.slice(0, 1), budgetSharePercent: 60, startOffsetDays: 0, durationDays: 30, reasoning: "The main buyer is on this channel." },
      { title: "Awareness push", objective: "awareness", channelId: chans[0], adChannel: "Meta feed", personaId: personas[0], message: msg, creativeIds: [], budgetSharePercent: 30, startOffsetDays: -14, durationDays: 14, reasoning: "Build reach before launch." },
    ] });
  }
  if (has("You explain an advertising campaign's results")) return J({ explanation: "The figures show spend against orders as the rule reads them.", suggestion: "Wait for more spend before changing anything." });
  // ---- channels
  if (has("draft replies, for a small product company")) {
    const rows = [...user.matchAll(/^#(\d+) \[new\]/gm)].map((x) => ({ answers: Number(x[1]), text: "Thanks for writing. We will check this and come back to you.", reasoning: "Polite and no promises." }));
    return J({ rows });
  }
  if (has("tag customer reviews and questions")) return J({ rows: [...user.matchAll(/^#(\d+) /gm)].map((x) => ({ id: Number(x[1]), topic: "Setup", sentiment: "neutral" })) });
  if (has("You answer questions about one product concept")) return "Rival One is reported to break easily and costs $29.99 [1][2]. The brief lists the plain counting aim [3].";
  log("  (no marker matched; echo)");
  return J({ rows: [] });
}

