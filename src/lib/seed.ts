// Seed project: Baggage Claims MK1.
// Every line below is taken from the Rev A documents in the Google Drive folder
// "Emotional baggage" (read 20 Nov 2026). Outside facts are carried as
// "unverified" claims; nothing here has been checked against outside sources.

export type SeedItem = {
  section: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  status?: string;
};

export const SEED_PROJECT = {
  id: "baggage-claims",
  name: "Baggage Claims MK1",
  oneLiner:
    "A motion-reactive audio gadget that straps to any suitcase and heckles the travel experience.",
};

const SRC = {
  prd: "PRD Rev A",
  play: "Marketing Playbook Rev A",
  plan: "Website Platform Plan Rev A",
  guide: "Build Guide Rev A",
  idea: "Original idea chat",
};

// Geometry in millimetres. x = width, y = height, z = depth; origin at the centre of
// the enclosure floor. basis "doc" = dimension stated in the source documents;
// "typical" = a common size for that kind of part, not stated in the documents and
// not measured. The internal layout is illustrative.
type Geometry = {
  shape: "box" | "cylinder" | "shell";
  size: number[];
  pos: number[];
  explode: number[];
  basis: "doc" | "typical";
  count?: number;
  print?: boolean;
};

const GEOMETRY: Record<string, Geometry> = {
  ENC1: { shape: "shell", size: [80, 42, 60], pos: [0, 21, 0], explode: [0, 0, 0], basis: "doc", print: true },
  BT1: { shape: "box", size: [58, 17, 48], pos: [0, 10.5, 0], explode: [0, -34, 0], basis: "typical" },
  BAT: { shape: "cylinder", size: [14.5, 50.5], pos: [0, 10.5, 0], explode: [0, -62, 0], basis: "typical", count: 3 },
  PCB1: { shape: "box", size: [70, 1.6, 50], pos: [0, 22, 0], explode: [0, 8, 0], basis: "doc" },
  U1: { shape: "box", size: [23, 5, 18], pos: [-21, 25.3, 8], explode: [0, 30, 0], basis: "typical" },
  U2: { shape: "box", size: [21, 3, 16], pos: [5, 24.3, -12], explode: [0, 42, 0], basis: "typical" },
  U3: { shape: "box", size: [20, 8, 20], pos: [22, 26.8, 10], explode: [0, 54, 0], basis: "typical" },
  SPK1: { shape: "cylinder", size: [36, 5], pos: [0, 36, 0], explode: [0, 74, 0], basis: "doc" },
  S1: { shape: "box", size: [4, 4, 9], pos: [-38, 14, 0], explode: [-26, 0, 0], basis: "typical" },
  S2: { shape: "box", size: [6, 5, 6], pos: [38, 28, 14], explode: [26, 0, 0], basis: "typical" },
  STR1: { shape: "box", size: [25, 1.5, 96], pos: [0, -1.5, 0], explode: [0, -84, 0], basis: "doc", count: 2 },
};

/**
 * Part kinds and library entries for the example (plan 5.1). Only entries that are the same part
 * as the bill of materials line; U1 (a Waveshare board) has no library entry, so its pins stay the
 * names its wires use until someone describes it.
 */
const PART_TYPE: Record<string, { kind: string; library?: string }> = {
  U1: { kind: "microcontroller" },
  U2: { kind: "sensor", library: "gy-521-mpu6050" },
  U3: { kind: "module", library: "dfplayer-mini" },
  SPK1: { kind: "speaker", library: "speaker-small" },
  BT1: { kind: "battery", library: "battery-holder-3xaa" },
  S1: { kind: "switch", library: "slide-switch-spst" },
  S2: { kind: "button", library: "tactile-button-6mm" },
  R1: { kind: "resistor", library: "resistor-axial" },
  R2: { kind: "resistor", library: "resistor-axial" },
  PCB1: { kind: "circuit board" },
  HW1: { kind: "mechanical" },
  ENC1: { kind: "enclosure" },
  STR1: { kind: "mechanical" },
};

export const SEED_ITEMS: SeedItem[] = [
  // ───────── 1 Concept
  {
    section: "concept/brief",
    title: "One-liner",
    body: "A $25 motion-reactive audio gadget that straps to any suitcase and heckles the travel experience: fat jokes at the check-in scale, groans when baggage handlers toss it, squeals on the carousel.",
    status: "done",
  },
  {
    section: "concept/brief",
    title: "Vision",
    body: "The Bluetooth speaker's funnier, cheaper cousin: a gift people buy because it made them laugh before they bought it.",
    status: "done",
  },
  {
    section: "concept/brief",
    title: "Who it is for",
    body: "P1 frequent leisure flyers 25-45. P2 gag-gift buyers (Secret Santa, Father's Day). P3 travel content creators. P4 airport gift shops and novelty retail.",
    status: "done",
  },
  {
    section: "concept/brief",
    title: "How it works",
    body: "ESP32-S3 with radios off, MPU-6050 motion sensor sampled at 100 Hz, rule-based classifier for eight travel moments, DFPlayer Mini playing MP3 clips from microSD through a 3 W speaker. Three AA alkaline cells, one button, no app.",
    status: "done",
  },
  {
    section: "concept/brief",
    title: "Claimed moats",
    body: "Trigger classifier tuned on real baggage telemetry; voice brand and talent; alkaline power allowing checked-bag use; trademark and design patent on the form factor.",
    status: "open",
  },
  {
    section: "concept/brief",
    title: "The ask and the gate",
    body: "About $750: $500 parts and $200 tooling for a 5-unit validation batch, one weekend of firmware tuning and a filmed airport test. Go to Kickstarter prep ($2-3k) only after the demo video passes 50k organic views or 500 waitlist signups.",
    status: "open",
  },
  {
    section: "concept/names",
    title: "Baggage Claims",
    body: "The name every document uses. Legal-world pun; 'file a claim' doubles as a return-policy joke.",
    data: { kind: "Name" },
    status: "shortlist",
  },
  {
    section: "concept/names",
    title: "Sass Case",
    body: "Ranked first for retail in the naming note: two syllables, giftable.",
    data: { kind: "Name" },
    status: "shortlist",
  },
  {
    section: "concept/names",
    title: "Emotional Baggage",
    body: "The naming note flags it as hard to trademark cleanly and probably contested. Trademark and domain screen not yet run.",
    data: { kind: "Name" },
    status: "shortlist",
  },
  {
    section: "concept/names",
    title: "LoudMouth Luggage",
    data: { kind: "Name" },
    status: "candidate",
  },
  {
    section: "concept/names",
    title: "Checked & Offended",
    data: { kind: "Name" },
    status: "candidate",
  },
  {
    section: "concept/names",
    title: "Your luggage finally talks back.",
    body: "Title card of the launch video.",
    data: { kind: "Tagline" },
    status: "candidate",
  },
  {
    section: "concept/names",
    title: "It knows when it's being weighed. And it is NOT happy.",
    body: "Kickstarter page headline.",
    data: { kind: "Tagline" },
    status: "candidate",
  },
  {
    section: "concept/names",
    title: "Pledge. Pack. Let the bag complain.",
    body: "Launch video tag card.",
    data: { kind: "Tagline" },
    status: "candidate",
  },
  {
    section: "concept/names",
    title: "FRAGILE — and emotionally unstable.",
    body: "Luggage tag line; also proposed as embossed shell text.",
    data: { kind: "Tagline" },
    status: "candidate",
  },
  {
    section: "concept/questions",
    title: "Which name ships?",
    body: "Documents say Baggage Claims, the project is called Emotional Baggage, the naming note prefers Sass Case for retail. Needs a USPTO and domain screen before anything is printed.",
  },
  {
    section: "concept/questions",
    title: "Which web stack for the product site?",
    body: "Three versions exist: Shopify plan, custom Next.js 15 with S3 (Blueprint Rev A), Next.js 16 with Postgres and pgvector (Blueprint Rev B). The schema and compose files on hand are still Rev A.",
  },
  {
    section: "concept/questions",
    title: "Is Austin still the home base?",
    body: "The marketing playbook assumes Austin for the SXSW Complaint Desk stunt and same-day parts pickup.",
  },
  {
    section: "concept/questions",
    title: "Kickstarter goal: $15k or 2,000 backers?",
    body: "The PRD sets a $15k goal; the playbook targets 2,000 backers, about $48k.",
  },
  {
    section: "concept/questions",
    title: "Primary sales channel",
    body: "The Rev A documents lead with Kickstarter then Shopify/TikTok Shop, with Amazon FBA as one channel at $27.95. The current direction is Amazon as the primary channel; pricing and margin need re-running on that basis.",
  },

  // ───────── 2 Research
  {
    section: "research/claims",
    title: "US gifts, novelty and souvenir market was about $32.7B in 2025, growing about 6.4% a year through 2034",
    data: { source: SRC.prd },
    status: "unverified",
  },
  {
    section: "research/claims",
    title: "Gag gifts sell in a $12-15 band on Etsy and eBay",
    data: { source: SRC.prd },
    status: "unverified",
  },
  {
    section: "research/claims",
    title: "FAA PackSafe requires lithium devices in checked bags to be fully off; alkaline AA cells face no such restriction",
    body: "The whole checked-bag use case rests on this.",
    data: { source: SRC.prd },
    status: "unverified",
  },
  {
    section: "research/claims",
    title: "Successful Kickstarter tech campaigns average about $33k raised",
    data: { source: SRC.prd },
    status: "unverified",
  },
  {
    section: "research/claims",
    title: "10% of tech backers delivered 60% of reward funding in Q3 2026",
    body: "Basis for the $49 collector tier.",
    data: { source: SRC.prd },
    status: "unverified",
  },
  {
    section: "research/claims",
    title: "Turnkey PCBA runs about $18-22 per board for a moderate BOM at 1,000 pieces",
    body: "Basis for the $19.00 landed cost at 1,000 units.",
    data: { source: SRC.prd },
    status: "unverified",
  },
  {
    section: "research/claims",
    title: "Mid-tier creators (50k-500k followers) get about 3x the engagement of mega-influencers for prop comedy",
    data: { source: SRC.play },
    status: "unverified",
  },
  {
    section: "research/claims",
    title: "2.8 billion bags are checked every year",
    body: "Spoken line in the launch video.",
    data: { source: "Launch Video Script Rev A" },
    status: "unverified",
  },
  {
    section: "research/claims",
    title: "Amazon FBA all-in take is about 30% at $27.95",
    body: "Matters more now that Amazon is the primary channel.",
    data: { source: SRC.prd },
    status: "unverified",
  },

  // ───────── 3 Design
  ...[
    ["Hard impact", "Acceleration spike above 8 g", "\"OW! I felt that in my flip-flops!\""],
    ["Weigh-in", "Lift, then 3.5-6 s dead still, then set down", "\"Are you calling me FAT?\""],
    ["Handle grab", "Sustained 25-75° tilt while moving for 10 s", "\"Are you gonna buy me dinner first?\""],
    ["Free-fall", "Below 0.15 g for at least 0.28 s, then impact", "Wilhelm scream"],
    ["Carousel", "Periodic rotation, 3-12 s period, three crossings", "\"Wheeee! Again! Again!\""],
    ["Conveyor", "Band-limited rumble for 8 s with no rotation", "\"Oh sure, I'll take the scenic route.\""],
    ["Inverted", "Upside down for 4 s", "\"I'm inverted. Somebody call Goose.\""],
    ["Dark idle", "No motion for 2 hours, checked at wake poll", "\"Hello?... Anyone? ...Cool, cool.\" then snoring"],
  ].map(([title, trigger, response]) => ({
    section: "design/requirements",
    title: `Detect: ${title}`,
    data: { trigger, response },
    status: "open",
  })),
  {
    section: "design/requirements",
    title: "Governor",
    body: "One gag per event class per journey phase, 3 s cooldown, at most 6 gags an hour. The PRD calls this the single most important UX line in the firmware.",
    data: { trigger: "Per-class latch, hourly counter", response: "Refuse the gag" },
    status: "open",
  },
  {
    section: "design/requirements",
    title: "Power",
    body: "Three AA alkaline cells, master slide switch, sleep current under 200 µA so a set lasts 3-6 months.",
    data: { trigger: "5 min without motion", response: "Sleep, 1 s wake poll" },
    status: "open",
  },
  {
    section: "design/requirements",
    title: "Controls",
    body: "One button: tap cycles volume, hold swaps voice pack, 10 s hold resets.",
    data: { trigger: "Button press length", response: "Volume / pack / reset" },
    status: "open",
  },
  {
    section: "design/requirements",
    title: "Enclosure",
    body: "About 80 × 60 × 42 mm PETG with strap channel and speaker grille. The motion sensor must be screwed rigidly to the shell, never foam mounted.",
    data: { trigger: "—", response: "—" },
    status: "open",
  },
  {
    section: "design/requirements",
    title: "Firmware sketch compiles",
    body: "The sketch source in the Drive folder uses gxDump and gzDump before they are declared, so it will likely not compile as pasted. The .ino file itself is not in the folder.",
    data: { trigger: "—", response: "—" },
    status: "blocked",
  },

  // BOM: 16 lines, straight from BOM_shopping_list.csv
  ...(
    [
      ["U1", "MCU dev board", "Waveshare ESP32-S3 Mini Dev Board, 240 MHz, 4 MB flash, onboard LDO", 1, "Micro Center", "Waveshare ESP32-S3 Mini Development Board", 8.99],
      ["U2", "IMU sensor", "HiLetgo GY-521 MPU-6050 6-axis, I2C, 3.3 V", 1, "Amazon", "HiLetgo GY-521 MPU-6050", 6.99],
      ["U3", "Audio module", "DFPlayer Mini MP3/WAV player, microSD to 32 GB, 9600 baud UART", 1, "Amazon", "DFPlayer Mini MP3 player module 2 pack", 5.5],
      ["SPK1", "Speaker", "8 Ω 3 W mini speaker with pre-tinned leads (~36 mm cavity)", 1, "Amazon", "4pcs 3W 8 ohm mini speaker", 1.75],
      ["BT1", "Battery holder", "3× AA holder with 150 mm leads and cover", 1, "Amazon", "3 AA battery holder with wire leads", 2.0],
      ["BAT", "Batteries", "AA alkaline (no lithium)", 3, "Micro Center", "AA alkaline batteries", 2.5],
      ["S1", "Power switch", "SPST mini slide switch", 1, "Micro Center", "SPST slide switch", 1.0],
      ["S2", "Mode button", "6 mm tactile push button", 1, "Micro Center", "tactile push button", 0.5],
      ["R1", "Resistor", "1 kΩ 1/4 W, series on DFPlayer RX", 1, "Micro Center", "resistor kit", 0.05],
      ["R2", "Resistor", "10 kΩ 1/4 W pull-up for mode button", 1, "Micro Center", "resistor kit", 0.05],
      ["SD1", "Storage", "microSD 8-32 GB, FAT32", 1, "Micro Center", "16GB microSD", 5.99],
      ["W1", "Wire and headers", "22-24 AWG hookup wire, dupont jumpers, pin headers", 1, "Micro Center", "jumper wire kit", 8.99],
      ["PCB1", "Carrier", "Solderable perfboard 5 × 7 cm", 1, "Micro Center", "Adafruit perma-proto breadboard PCB", 4.5],
      ["HW1", "Mounting", "M2 × 8 screws, M2 brass standoffs ×4, foam tape, zip ties", 1, "Amazon", "M2 brass standoff kit", 6.99],
      ["ENC1", "Enclosure", "3D printed PETG shell, 4 perimeters, 25% infill", 1, "Own printer", "PETG filament", 5.0],
      ["STR1", "Mount strap", "Hook-and-loop luggage strap 25 × 300 mm ×2", 1, "Amazon", "adjustable velcro luggage strap 12in", 4.0],
    ] as const
  ).map(([ref, title, spec, qty, source, search, line]) => ({
    section: "design/bom",
    title,
    body: spec,
    data: { ref, qty, source, search, line, asin: "", ...(GEOMETRY[ref] ? { geometry: GEOMETRY[ref] } : {}), ...(PART_TYPE[ref] ?? {}) },
    status: ref === "ENC1" ? "to print" : "to buy",
  })),

  // ───────── 4 Prototype
  {
    section: "prototype/printing",
    title: "Hinge clearance coupon",
    body: "Print the stepped coupon first: 1.3 / 1.4 / 1.5 mm pins against 1.7 / 1.8 / 1.9 mm bores. The pair that pops free and turns without grit sets the clearance.",
    data: { material: "PETG", settings: "0.2 mm layers", estimate: "45 min" },
    status: "queued",
  },
  {
    section: "prototype/printing",
    title: "Print-in-place clamshell",
    body: "Printed flat-open, supports off. The STL (BaggageClaims_PiP_Clamshell_RevA.stl) and its generator script are named in the build guide but are not in the Drive folder.",
    data: {
      material: "PETG, 230-235 °C, fan 50-70%",
      settings: "0.2 mm layers, 4 perimeters, 25% infill, supports off",
      estimate: "~62 g, 4-5 h",
    },
    status: "queued",
  },
  // Step order: the build guide lists the phases in sequence. The "after" links below
  // are inferred from what each phase physically needs, so printing, electronics and
  // audio prep can run in parallel. Minutes are the guide's own figures.
  ...(
    [
      ["p0", [], 15, "Phase 0 — Bench setup", "Lay out all 16 parts against the BOM, confirm the ESP32-S3 shows a serial port, iron to 350 °C."],
      ["p1", ["p0"], 345, "Phase 1 — Print the enclosure", "Coupon first, then the full clamshell; break the hinge free and exercise it 20 times. About 5 h unattended plus 45 min."],
      ["p2", ["p0"], 90, "Phase 2 — Electronics", "Power rail first and metered (4.5-4.9 V), then MPU-6050 on I2C, DFPlayer on UART with the 1 kΩ resistor on RX, then the mode button."],
      ["p3", ["p2"], 10, "Phase 3 — First power-on", "3V3 rail reads 3.28-3.35 V, sensor LED lit, no hot spots after 30 s."],
      ["p4", ["p3"], 20, "Phase 4 — Firmware", "Flash the classifier sketch; expect CAL OK, DF OK, IDLE in the serial log."],
      ["p5", ["p0"], 15, "Phase 5 — Audio", "FAT32 microSD with folders /01 /02 /03 and ten starter clips, 0001.mp3 to 0010.mp3."],
      ["p6", ["p1", "p4", "p5"], 30, "Phase 6 — Integration", "Speaker glued behind the grille, board on its four posts, battery holder in the tray, straps threaded, lid snapped."],
      ["p7", ["p6"], 30, "Phase 7 — Acceptance tests", "Run all five tests."],
      ["p8", ["p7"], 10, "Phase 8 — Pack-out", "Strap to a suitcase, compliance card inside the shell, log build time and reworks."],
    ] as const
  ).map(([key, after, minutes, title, body]) => ({
    section: "prototype/assembly",
    title,
    body,
    data: { key, after: [...after], minutes, time: `${minutes} min` },
    status: "open",
  })),
  ...[
    ["Drop", "0.5 m onto carpet gives the impact gag within 1 s"],
    ["Weigh-in", "Lift to waist, hold 4 s dead still, set down gives the weigh gag"],
    ["Carry", "Carry by the handle for 15 s gives the dinner gag"],
    ["Idle", "Untouched for 2 h gives the dark-idle gag at wake poll"],
    ["Sleep current", "After 5 min motionless, under 200 µA in series with the battery"],
  ].map(([title, pass]) => ({
    section: "prototype/tests",
    title,
    data: { pass },
    status: "not run",
  })),

  // ───────── 5 Production
  ...[
    ["Prototype", "1", "$64.80", "—", "—"],
    ["Engineering validation batch", "100", "$43.20", "—", "—"],
    ["Production run", "1,000", "$19.00", "—", "—"],
    ["Retail run", "10,000", "$11.15", "—", "—"],
  ].map(([title, volume, cogs, price, margin]) => ({
    section: "production/economics",
    title,
    data: { volume, cogs, price, margin },
    status: "estimate",
  })),
  {
    section: "production/economics",
    title: "Voice pack (DLC)",
    body: "Sold as a microSD at $7.99 against about $0.50 of parts.",
    data: { volume: "per pack", cogs: "$0.50", price: "$7.99", margin: "—" },
    status: "estimate",
  },
  ...[
    ["A — Validation", "5", "Approve the ~$750 ask"],
    ["B — Creator seeding units", "20", "Phase 1 gate passed: 50k views or 500 signups"],
    ["C — First production run", "1,000", "2,000+ emails before launch"],
  ].map(([title, units, gate]) => ({
    section: "production/batches",
    title,
    data: { units, gate },
    status: "planned",
  })),

  // ───────── 6 Marketing
  {
    section: "marketing/positioning",
    title: "Positioning",
    body: "Not a gadget: a comedy device that happens to be a gadget. All budget demonstrates, never explains.",
    status: "done",
  },
  {
    section: "marketing/positioning",
    title: "Voice rules",
    body: "The bag speaks in the first person, never the company. Deadpan host, chaotic bag. Every asset ends with one action. No celebrity voices.",
    status: "done",
  },
  ...[
    ["Gate (home)", "/", "CHECK MY BAG IN (email)", "Full-viewport departure board, hero video in a security-monitor frame."],
    ["Safety Card", "/how-it-works", "Join the list", "Six airline safety-card frames from strap-on to carousel gag; doubles as packaging art."],
    ["Moments", "/moments", "Join the list", "The eight trigger moments as animated vignettes."],
    ["Lost Baggage Hotline", "/hotline", "Email to unlock the ticket", "Three questions produce an audio complaint in the bag's voice and a shareable claim ticket."],
    ["Departure Board", "/board", "Share your link", "Referral rank shown as a boarding group."],
    ["Product", "/product", "Buy", "Spec-sheet placard, price as a scale readout, reviews as complaint tickets."],
    ["Platinum Status", "/claim", "Register the unit", "QR from the in-box card; registration grants a free voice pack."],
    ["Complaint Department", "/faq", "Self-serve answer", "All support in character, real answers under every joke."],
    ["Wholesale", "/wholesale", "Request the line sheet", "Retail buyers and the counter-display program."],
  ].map(([title, path, cta, body]) => ({
    section: "marketing/landing",
    title,
    body,
    data: { path, cta },
    status: "planned",
  })),
  ...[
    "My bag embarrassed me in front of the entire carousel. Five stars.",
    "TSA agent laughed so hard she forgot to swab my laptop. Five stars.",
    "Ruined my marriage. She took his side. The bag's side. Five stars.",
  ].map((title) => ({
    section: "marketing/ads",
    title,
    body: "Shame Ads: retargeting to video viewers who did not convert, written as five-star complaint reviews. Static image, audio autoplay off.",
    data: { channel: "Retargeting", rule: "$500 test; kill if CAC > $10" },
    status: "draft",
  })),
  ...[
    ["1 · The Four Gates", "Attention", "$0-500", "Any clip over 50k views in 72 h", "Four unbranded 15 s verticals (FAT / OW / DARK / WHEE), no logo, no link."],
    ["2 · @TheBagComplains", "Attention", "$0", "3 reply screenshots reposted by accounts over 100k", "The bag's own account replies in character to viral travel complaints."],
    ["3 · 100 Bags, 100 Reactions", "Attention", "~$1,300", "20 creators post in launch week", "20 evaluation units to mid-size travel comedians, 10% affiliate code."],
    ["4 · The Lost Baggage Hotline", "Capture", "~$500 tooling", "Email capture over 35%; 1,000 tickets pre-launch", "Interactive complaint generator with audio and a claim ticket."],
    ["5 · The Departure Board", "Capture", "in tooling", "3,000 emails before launch", "Referral program; boarding group is referral rank."],
    ["6 · The Complaint Desk", "Conversion", "~$300", "500 QR scans, 2 local news hits", "Pop-up mock airline complaint desk with a live demo unit."],
    ["7 · Kickstarter page", "Conversion", "$1k assets", "2,000 backers, conversion over 2.5%", "Tiers as cabin classes from $19 to $99; stretch goals are voice packs."],
    ["8 · The Shame Ads", "Conversion", "$500 test", "CAC under $10", "Five-star complaint reviews as retargeting ads."],
    ["9 · Platinum Status", "Retention", "—", "20% of buyers attach a voice pack in 12 months", "Unit registration unlocks a free pack; seasonal packs at $7.99."],
    ["10 · Wholesale Trojan", "Retention", "—", "Wholesale PO", "Counter display with a button that plays one gag; $14.50 wholesale, $29.95 MSRP."],
  ].map(([title, funnel, budget, kpi, body]) => ({
    section: "marketing/campaigns",
    title,
    body,
    data: { funnel, budget, kpi },
    status: "planned",
  })),
  ...[
    ["POV: your suitcase gets body-shamed at check-in", "V1 FAT: curb grab and weigh-in beats."],
    ["the suitcase screamed and the baggage handler LOST IT", "V2 OW: handler toss, scream, thud."],
    ["my luggage after 4 hours in the cargo hold", "V3 DARK: the dark-hold beat."],
    ["why is this bag having more fun than me", "V4 WHEE: carousel beat and stranger reaction."],
  ].map(([title, body]) => ({
    section: "marketing/social",
    title,
    body: `${body} Needs the filmed clip before it can post.`,
    data: { channel: "TikTok / Reels / Shorts" },
    status: "draft",
  })),

  // ───────── 7 Sales
  {
    section: "sales/listing",
    title: "Amazon listing not started",
    body: "The Rev A documents contain no Amazon title, bullets, images or keyword set. The PRD only says 'Amazon listing tuned to gag travel gift keywords'.",
    data: { field: "All" },
    status: "draft",
  },
  ...[
    ["Amazon FBA", "$27.95", "~30% all-in", "$19.55", "planned"],
    ["Kickstarter early bird", "$19", "~8-10% fees", "$17.20", "planned"],
    ["Kickstarter standard", "$24", "~8-10%", "$21.70", "planned"],
    ["DTC site / TikTok Shop", "$24.95", "~12% blended", "$21.95", "planned"],
    ["Wholesale (airport / gift retail)", "$14.50", "Retailer sets $29.95 MSRP", "$14.50", "planned"],
  ].map(([title, price, take, net, status]) => ({
    section: "sales/channels",
    title,
    data: { price, take, net },
    status,
  })),
];

// ───────── Decision tree. Options and consequences are the ones the source documents
// state. `chosen` is set only where Jim has said so; everything else is undecided.
const list = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

const D = (
  key: string,
  parent: string,
  title: string,
  body: string,
  options: { id: string; label: string; outcome: string }[],
  extra: { chosen?: string; dependsOn?: string; unlocks?: string; source?: string } = {}
): SeedItem => ({
  section: "concept/decisions",
  title,
  body,
  data: {
    key,
    parent,
    options,
    chosen: extra.chosen ?? "",
    dependsOn: list(extra.dependsOn),
    unlocks: list(extra.unlocks),
    source: extra.source ?? "",
  },
  status: extra.chosen ? "decided" : "open",
});

const SEED_DECISIONS: SeedItem[] = [
  D("go", "", "Spend about $750 on the validation batch?", "Five units, one weekend of firmware tuning and a filmed airport test.", [
    { id: "yes", label: "Build the 5 units", outcome: "$500 parts and $200 tooling; produces the unbranded clips the Phase 1 gate needs." },
    { id: "no", label: "Stop here", outcome: "No spend. The concept stays on paper." },
  ], { unlocks: "prototype/sourcing, prototype/printing, prototype/assembly", source: "PRD Rev A" }),
  D("name", "go", "Which name ships?", "The documents say Baggage Claims; the project is called Emotional Baggage. No trademark or domain screen has been run.", [
    { id: "baggage-claims", label: "Baggage Claims", outcome: "Matches every Rev A document, the video script and BaggageClaims.com." },
    { id: "sass-case", label: "Sass Case", outcome: "Ranked first for retail in the naming note; SassCase.com named as a redirect." },
    { id: "emotional-baggage", label: "Emotional Baggage", outcome: "The naming note warns it is hard to trademark cleanly and probably contested." },
  ], { unlocks: "marketing/landing, sales/listing", source: "Naming note" }),
  D("enclosure", "go", "Which enclosure build?", "Three levels of integration from the 3D printing note.", [
    { id: "two-piece", label: "Two-piece shell plus mid-plate", outcome: "No redesign; both halves and the plate print in one job of about 4 h, about 100 g PETG." },
    { id: "clamshell", label: "Print-in-place clamshell", outcome: "Hinge and snap latch printed in; posts, battery tray and strap slots built in; the mid-plate leaves the BOM. Needs the hinge coupon first." },
    { id: "tpu-boot", label: "One-piece TPU boot", outcome: "Flexible sleeve with built-in strap loops; needs a rigid internal sled so the motion sensor stays rigidly mounted." },
  ], { unlocks: "design/model, prototype/printing", source: "3D printing note" }),
  D("gate1", "go", "Phase 1 gate: did the unbranded clips pass?", "Four 15-second verticals posted with no logo and no link.", [
    { id: "pass", label: "50k organic views or 500 signups", outcome: "Go to Kickstarter prep ($2-3k). Any clip over 50k views in 72 h gets the $2k amplification." },
    { id: "fail", label: "Under both after 30 days", outcome: "Stop, pivot the creative, do not fund production." },
  ], { dependsOn: "go", unlocks: "marketing/campaigns", source: "PRD Rev A, Marketing Playbook Rev A" }),
  D("channel", "gate1", "Primary sales channel?", "The Rev A documents lead with Kickstarter, then Shopify and TikTok Shop, with Amazon FBA as one channel.", [
    { id: "amazon", label: "Amazon first", outcome: "$27.95 with about 30% all-in take, netting $19.55. The Rev A margin model has to be re-run on this basis." },
    { id: "kickstarter", label: "Kickstarter first", outcome: "Tiers from $19 to $99; $24 standard nets $21.70 after about 8-10% fees." },
  ], { chosen: "amazon", dependsOn: "gate1", unlocks: "sales/listing, sales/channels", source: "Stated 20 Nov 2026" }),
  D("ks-goal", "channel", "If Kickstarter runs: which goal?", "The two documents disagree.", [
    { id: "15k", label: "$15k goal", outcome: "The PRD figure." },
    { id: "2000", label: "2,000 backers", outcome: "The playbook target; about $48k at a $24 average, contributing roughly $8-12k after product, fulfilment and marketing." },
  ], { dependsOn: "channel", source: "PRD Rev A, Marketing Playbook Rev A" }),
  D("stack", "gate1", "Which web stack for the product site?", "Three versions exist in the documents.", [
    { id: "shopify", label: "Shopify plan", outcome: "About $90 a month in phase 1, $240 a month at a 5k list." },
    { id: "rev-a", label: "Custom build, Blueprint Rev A", outcome: "Next.js 15, Postgres 16, Redis, S3, Stripe, Klaviyo." },
    { id: "rev-b", label: "Custom build, Blueprint Rev B", outcome: "Next.js 16, Postgres with pgvector, no S3, Listmonk and Postiz; about $24-40 a month on one VPS." },
  ], { dependsOn: "gate1", unlocks: "marketing/landing", source: "Website Platform Plan Rev A, Web Blueprint Rev A and Rev B" }),
  D("gate2", "gate1", "Scale gate: enough emails before launch?", "Decides whether the first production run is funded.", [
    { id: "pass", label: "2,000 or more emails", outcome: "Green-light the 1,000-unit run at about $19.00 landed per unit." },
    { id: "hold", label: "Fewer than 2,000", outcome: "No production run yet." },
  ], { dependsOn: "gate1", unlocks: "production/batches", source: "Marketing Playbook Rev A" }),
];

// ───────── Wiring, from the PRD pin table and Build Guide Phase 2. `order` is the
// build guide's soldering sequence: power rail, motion sensor, audio module, button.
// A series resistor is its own part with a wire to each of its pins (docs/design/wiring.md).
// Pin names follow the library entry each part names (see PART_TYPE above).
const W = (
  order: number,
  title: string,
  net: string,
  netClass: "power" | "ground" | "signal" | "audio",
  from: string,
  fromPin: string,
  to: string,
  toPin: string,
  note = ""
): SeedItem => ({
  section: "design/wiring",
  title,
  body: note,
  data: { order, net, netClass, from, fromPin, to, toPin },
  status: "to solder",
});

const SEED_WIRING: SeedItem[] = [
  W(1, "Battery positive to switch", "BAT+", "power", "BT1", "+", "S1", "1"),
  W(2, "Switch to VIN", "VIN", "power", "S1", "2", "U1", "5V/VIN", "Meter VIN to GND with the switch on: expect 4.5-4.9 V. Do not go on outside 4.2-5.2 V."),
  W(3, "Battery negative to ground", "GND", "ground", "BT1", "-", "U1", "GND", "Ground star point at one corner of the board."),
  W(4, "Sensor power", "3V3", "power", "U1", "3V3", "U2", "VCC"),
  W(5, "Sensor ground", "GND", "ground", "U1", "GND", "U2", "GND"),
  W(6, "I2C clock", "I2C_SCL", "signal", "U1", "GPIO8", "U2", "SCL", "400 kHz, address 0x68."),
  W(7, "I2C data", "I2C_SDA", "signal", "U1", "GPIO9", "U2", "SDA"),
  W(8, "Motion interrupt", "MPU_INT", "signal", "U2", "INT", "U1", "GPIO6", "Latched."),
  W(9, "Audio module power", "VIN", "power", "U1", "5V/VIN", "U3", "VCC", "4.5-5 V, not 3.3 V."),
  W(10, "Audio module ground", "GND", "ground", "U1", "GND", "U3", "GND"),
  W(11, "UART to the series resistor", "UART_TX", "signal", "U1", "GPIO17", "R1", "1", "The resistor is mandatory; without it the module triggers at random."),
  W(11, "Series resistor to audio module RX", "UART_TX_R", "signal", "R1", "2", "U3", "RX"),
  W(12, "UART from audio module", "UART_RX", "signal", "U3", "TX", "U1", "GPIO16", "9600 baud, 8N1."),
  W(13, "Busy line", "BUSY", "signal", "U3", "BUSY", "U1", "GPIO4"),
  W(14, "Speaker lead 1", "SPK_P", "audio", "U3", "SPK_1", "SPK1", "+", "Either polarity."),
  W(15, "Speaker lead 2", "SPK_N", "audio", "U3", "SPK_2", "SPK1", "-"),
  W(16, "Mode button to GPIO", "MODE", "signal", "S2", "1", "U1", "GPIO5"),
  W(17, "Mode button to ground", "GND", "ground", "S2", "2", "U1", "GND"),
  W(18, "Pull-up from 3V3", "3V3", "power", "U1", "3V3", "R2", "1", "10 kΩ between GPIO5 and 3V3."),
  W(18, "Pull-up to the mode GPIO", "MODE", "signal", "R2", "2", "U1", "GPIO5"),
];

/** Stores added after the first release; seeded into an existing example concept when empty. */
export const SEED_ADDITIONS: Record<string, SeedItem[]> = {
  "concept/decisions": SEED_DECISIONS,
  "design/wiring": SEED_WIRING,
};

/**
 * The links the example's own texts support, between its requirements, acceptance tests and parts. Each entry
 * says why in the words of the rows themselves; nothing here is a guess about what "probably" serves what.
 * Requirements with no entry (Free-fall, Carousel, Conveyor, Inverted, Governor tests, Controls, Enclosure and
 * Firmware tests) have no test written for them yet: that is the honest state of the example, and the gap the
 * Traceability page is for.
 */
export type SeedLink = { requirement: string; tests: string[]; parts: string[]; because: string };

const AUDIO = ["U3", "SPK1", "SD1"];
const DETECT_BECAUSE = "its response is a spoken gag, played by the DFPlayer from the microSD through the speaker, and it is detected by the IMU";

export const SEED_LINKS: SeedLink[] = [
  { requirement: "Detect: Hard impact", tests: ["Drop"], parts: ["U2", ...AUDIO], because: `the Drop test's pass text is the impact gag within 1 s; ${DETECT_BECAUSE}` },
  { requirement: "Detect: Weigh-in", tests: ["Weigh-in"], parts: ["U2", ...AUDIO], because: `the Weigh-in test holds the unit dead still for 4 s inside the 3.5-6 s window; ${DETECT_BECAUSE}` },
  { requirement: "Detect: Handle grab", tests: ["Carry"], parts: ["U2", ...AUDIO], because: `the Carry test is the handle carry that gives the dinner gag; ${DETECT_BECAUSE}` },
  { requirement: "Detect: Free-fall", tests: [], parts: ["U2", ...AUDIO], because: DETECT_BECAUSE },
  { requirement: "Detect: Carousel", tests: [], parts: ["U2", ...AUDIO], because: DETECT_BECAUSE },
  { requirement: "Detect: Conveyor", tests: [], parts: ["U2", ...AUDIO], because: DETECT_BECAUSE },
  { requirement: "Detect: Inverted", tests: [], parts: ["U2", ...AUDIO], because: DETECT_BECAUSE },
  { requirement: "Detect: Dark idle", tests: ["Idle"], parts: ["U2", ...AUDIO], because: `the Idle test is two hours untouched and the dark-idle gag at the wake poll; ${DETECT_BECAUSE}` },
  { requirement: "Governor", tests: [], parts: ["U1"], because: "the per-class latch and the hourly counter run in the firmware on the MCU" },
  { requirement: "Power", tests: ["Sleep current"], parts: ["BT1", "BAT", "S1"], because: "the Sleep current test measures the 200 µA limit; the requirement names the three AA cells and the master slide switch" },
  { requirement: "Controls", tests: [], parts: ["S2", "R2"], because: "the one button is S2, and R2 is its pull-up (the bill of materials says so)" },
  { requirement: "Enclosure", tests: [], parts: ["ENC1", "HW1", "STR1", "SPK1", "U2"], because: "the shell is ENC1, the sensor is screwed to it with HW1, the strap channel takes STR1 and the grille faces the speaker" },
  { requirement: "Firmware sketch compiles", tests: [], parts: ["U1"], because: "the sketch is for the ESP32-S3 on U1" },
];
