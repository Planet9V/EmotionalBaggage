// The example concept's story and its list of sources (Baggage Claims MK1).
//
// Every sentence below is taken from, or summarises, the owner's documents in the Google Drive folder
// "Emotional baggage", re-read on 21 Nov 2026. Lines in quotation marks are his documents' own words, kept as
// written (including their dashes and capitals). Market sizes, Kickstarter statistics, FAA and TSA battery rules
// and component prices are as stated in those documents and have not been checked against outside sources.
//
// The documents themselves are seeded into the concept's Files from seed/concepts/baggage-claims (seedFiles.ts),
// after this list names them; scripts/import-files.mjs loads a folder of files into any other concept.
import type { Pool } from "pg";
import { SEED_PROJECT } from "@/lib/seed";
import type { SourceData, StoryData, StoryPartKey } from "./parts";
import { SOURCES_STORE, STORY_STORE, storyPart } from "./parts";

const DRIVE = "The owner's Google Drive folder \"Emotional baggage\".";

type SeedSource = { key: string; title: string; what: string; kind: SourceData["kind"] };

/** The 21 files of the Drive folder, by the names they have there. Files the owner added later are listed in the manifest only (seedFiles.ts). */
export const SEED_SOURCES: SeedSource[] = [
  { key: "idea", title: "I have an idea for a quick gag and potential quick.md", what: "The owner's original idea, and the first proposal with the ranked gag catalogue.", kind: "chat" },
  { key: "prd", title: "BaggageClaims_PRD_Business_Proposal_RevA.pdf", what: "Product requirements document and full business proposal, Rev A: 6 pages, 13 sections.", kind: "document" },
  { key: "names", title: "What clever names for this ?.md", what: "Name candidates, a tiered naming system for the voice packs, and a ranking.", kind: "chat" },
  { key: "play", title: "BaggageClaims_Marketing_Playbook_RevA.txt", what: "Marketing playbook, Rev A: 10 campaigns in 4 funnel stages, about $4,500 budget, kill and scale rules.", kind: "document" },
  { key: "script", title: "BaggageClaims_LaunchVideo_Script_RevA.txt", what: "Kickstarter launch video script, Rev A: the 2:15 hero cut, four 15-second verticals, audio cue sheet and shot notes.", kind: "document" },
  { key: "scriptChat", title: "Write the script for the launch video.md", what: "Chat copy of the launch script with production notes.", kind: "chat" },
  { key: "mktChat", title: "Develop clever marketing campaigns for this hilari.md", what: "Chat summary of the marketing playbook.", kind: "chat" },
  { key: "prdChat", title: "Create a PRD for this with arch instructions bom a.md", what: "Chat summary of the PRD: headline economics and the decision gate.", kind: "chat" },
  { key: "guide", title: "BaggageClaims_BuildGuide_RevA.md", what: "Step-by-step build guide, Rev A: eight phases with acceptance tests and a troubleshooting sheet.", kind: "document" },
  { key: "printer", title: "Can I do a 3d printer for this integrated - if so.md", what: "3D printer choice and three levels of enclosure integration.", kind: "chat" },
  { key: "designChat", title: "Build me the low level design , inter interface co.md", what: "Chat summary of the design package.", kind: "chat" },
  { key: "design", title: "BaggageClaims_DesignPackage_RevA.pdf", what: "Low-level design, interface control document and assembly guide, Rev A: 5 pages.", kind: "document" },
  { key: "hotline", title: "Walk through the Hotline TTS audio worker flow.md", what: "Design of the Lost Baggage Hotline audio worker: fragment stitching, idempotency, failure handling, capacity.", kind: "chat" },
  { key: "platform", title: "BaggageClaims_Website_Platform_Plan_RevA.txt", what: "Website and platform plan, Rev A: strategy, sitemap, page designs, back office, compliance and phases, built on Shopify.", kind: "document" },
  { key: "bpA", title: "BaggageClaims_Web_Blueprint_RevA.md", what: "Web blueprint, Rev A: a custom build on Next.js 15.", kind: "document" },
  { key: "bpB", title: "BaggageClaims_Web_Blueprint_RevB.md", what: "Web blueprint, Rev B, which says it supersedes Rev A.", kind: "document" },
  { key: "schema", title: "db_schema.sql", what: "PostgreSQL database schema for the web platform, Rev A.", kind: "other" },
  { key: "compose", title: "docker-compose.yml", what: "Docker Compose file for the web platform, Rev A.", kind: "other" },
  { key: "bom", title: "BOM_shopping_list.csv", what: "Bill of materials as a shopping list: 16 lines with Micro Center and Amazon sources.", kind: "spreadsheet" },
  { key: "schematic", title: "schematic.png", what: "Block-level wiring schematic.", kind: "image" },
  { key: "sketch", title: "Generate the Arduino sketch for the classification.md", what: "The classifier firmware sketch, with bench caveats.", kind: "chat" },
];

type SeedPart = { part: StoryPartKey; body: string; status: string; sources: string[]; position?: string; examples?: StoryData["examples"]; claims?: (Omit<NonNullable<StoryData["claims"]>[number], "sourceIds"> & { sources: string[] })[] };

const NOT_CHECKED = "Stated in the source, not checked.";

export const SEED_STORY: SeedPart[] = [
  {
    part: "pitch",
    status: "written",
    sources: ["idea", "prd"],
    body: `Baggage Claims MK1 is a palm-sized puck that straps to any suitcase and heckles the trip. A motion sensor reads what the bag is going through: the lift onto the check-in scale, the toss onto the belt, the free-fall into a container, the conveyor's rumble, the carousel's laps, and hours of dark silence in the hold. A small speaker answers each moment with the complaint that fits.

It is a gag gift at about $25, with no app, no pairing and no Wi-Fi, and one button. The first proposal called it "the Furby of luggage". The PRD puts it this way: "the Bluetooth speaker's funnier, cheaper cousin - a gift people buy because it made them laugh before they bought it."`,
  },
  {
    part: "origin",
    status: "written",
    sources: ["idea", "names", "prd"],
    body: `It started as a joke with a business attached. The owner's first note asks for "a quick gag and potential quick buck": a device on the luggage that is "the comedic relief of all the airport luggage moments of absurdity". He already had the lines in his head. When the airline agent weighs the bag and it is too heavy, the luggage says "are you calling me fat". When someone grabs it: "are you going to buy me dinner first". And "ouch" and "groan" noises when it is tossed around.

The inspiration is a moment every traveller knows. In the first proposal's words: "every traveler has watched their bag get yeeted onto a cart or held their breath at the scale." Luggage goes through a lot that its owner never sees, and nobody speaks up for it. This product gives the bag a voice.

From that note came a first proposal with a ranked catalogue of gags, then a name ("Baggage Claims", a legal-world pun on the carousel), and on the same day, 19 November 2026, a whole Rev A package: the PRD and business proposal, the design package, a build guide, a firmware sketch, a 3D printing plan, a marketing playbook, a launch video script and plans for the website.`,
  },
  {
    part: "how",
    status: "written",
    sources: ["prd", "design", "idea", "guide", "printer"],
    body: `You strap a puck about the size of a hockey puck (about 80 by 60 by 42 mm) to the suitcase handle with two Velcro straps, switch it on, and forget about it. Inside, a motion sensor (an MPU-6050) is read 100 times a second by a small processor (an ESP32-S3 with its radios turned off). Simple rules recognise eight moments of a journey, and an MP3 player (a DFPlayer Mini) plays a matching clip from a microSD card through a 3 W speaker behind a grille.

| The moment | How it is recognised | What the bag says |
|---|---|---|
| Heaved onto the belt at check-in | A hard jolt, 8 to 14 g | "OW! I felt that in my flip-flops!" |
| Lifted onto the scale | Lifted, held dead still for 3.5 to 6 seconds, set down | "Are you calling me FAT?" |
| Grabbed by the handle at the curb | Tilted and carried for about 10 seconds | "Are you gonna buy me dinner first?" |
| Thrown from cart to container | A quarter of a second of free-fall, then a thud | Wilhelm scream |
| Riding the carousel | Turning round and round, a lap every 3 to 12 seconds | "Wheeee! Again! Again!" |
| A long ride on a tarmac cart | A steady rumble for 8 seconds or more | "Oh sure, I will take the scenic route." |
| Stowed upside down | Upside down for 4 seconds | "I am inverted. Somebody call Goose." |
| Hours in the dark hold | Two hours without moving | "Hello?... Anyone? ...Cool, cool." then snoring |

A governor keeps it funny rather than annoying: one gag per kind of moment per stage of the journey, three seconds of quiet after each, and never more than six an hour. The PRD calls this "the single most important UX line in the firmware."

The one button sets the volume with a tap, swaps between three voice packs (Family, Salty and New Yorker) with a hold, and resets the unit after ten seconds. The clips live on the microSD card as plain numbered files, so new voice packs and seasonal editions need no new hardware.

It runs on three AA alkaline batteries, on purpose. The documents say lithium devices in checked bags must be fully off in the hold, which would kill the joke; alkaline cells carry no such rule. The shell is printed in PETG; the 3D printing note proposes a one-piece print-in-place clamshell, or a flexible TPU boot that doubles as drop protection, "which is deliciously on-brand for a device that yells OW".`,
  },
  {
    part: "why",
    status: "written",
    sources: ["prd", "idea", "prdChat"],
    body: `The bet is that the joke sells itself on sight. The PRD puts the reasoning in one line: "Every row converts a recognizable shared misery into a punchline - that conversion IS the product." The moments are ones every traveller recognises, the reaction is immediate, and the product's demonstration is the same thing as its marketing: a fifteen-second clip of a suitcase complaining at a baggage handler. In the first proposal's words, "This video is the business plan."

The economics are meant to work at gift prices: parts that are cheap in volume, a price in the gag-gift band, and voice packs that cost almost nothing to make and sell for $7.99. The alkaline batteries turn a regulation into a feature: "This is the rare case where regulation improves the product."

Nothing has been built or measured yet. Every claim below is either stated in a source document (and not yet checked) or an assumption the first test has to settle.`,
    claims: [
      { text: "Travel moments like the weigh-in, the toss and the carousel are recognised by everyone, so the gags need no explanation.", basis: "assumption", note: "The first test (the unbranded videos) is meant to show whether people share them.", sources: ["idea", "prd"] },
      { text: "Short-form travel comedy is one of the most reliable viral content genres.", basis: "assumption", note: "Stated in the PRD without a source.", sources: ["prd"] },
      { text: "The hard-impact gag is detected 100% of the time.", basis: "assumption", note: "Stated in the first proposal; no unit has been built or tested.", sources: ["idea"] },
      { text: "The US gifts, novelty and souvenir market was worth about $32.7B in 2025, growing about 6.4% a year through 2034.", basis: "sourced", note: NOT_CHECKED, sources: ["prd", "prdChat"] },
      { text: "Gag gifts sell in a proven $12 to $15 band on Etsy and eBay.", basis: "sourced", note: NOT_CHECKED, sources: ["prd", "idea"] },
      { text: "Lithium devices in checked bags must be fully off in the hold (FAA PackSafe); alkaline AA cells carry no such restriction.", basis: "sourced", note: NOT_CHECKED, sources: ["prd", "design", "idea"] },
      { text: "Landed cost falls from $64.80 for the first prototype to $43.20 at 100 units, $19.00 at 1,000 and $11.15 at 10,000.", basis: "sourced", note: "The PRD's own estimate from published turnkey rates; not checked.", sources: ["prd", "prdChat"] },
      { text: "Successful Kickstarter tech campaigns average about $33k raised, and 10% of tech backers delivered 60% of reward funding in Q3 2026.", basis: "sourced", note: NOT_CHECKED, sources: ["prd", "prdChat"] },
      { text: "A voice pack costs about $0.50 to make and sells for $7.99.", basis: "sourced", note: NOT_CHECKED, sources: ["prd"] },
      { text: "The moats are soft but real: a classifier tuned on real baggage telemetry, the voice talent, the alkaline compliance trick, and a trademark and design patent.", basis: "assumption", note: "Claimed in the PRD; none of the four exists yet.", sources: ["prd"] },
    ],
  },
  {
    part: "who",
    status: "written",
    sources: ["prd", "play"],
    body: `- **Frequent leisure flyers, 25 to 45.** They buy it to show some personality, to prank the people they travel with, and for the moments worth filming.
- **Gag-gift buyers.** Secret Santa, Father's Day, the Q4 gifting rush. The PRD puts their problem plainly: they need "a $20-30 gift that is NOT another candle".
- **Travel content creators.** A prop that makes clips; the playbook seeds 20 units with mid-size travel comedians and asks for only one thing: "film the first genuine reaction."
- **Airport gift shops and novelty retail.** An impulse buy at the checkout, sold from a counter display with a big red button that plays a gag.

There is a fifth audience that never pays: the baggage handlers and bystanders. "The bag talks back; handlers become the audience and the viral content engine."

The moment they want it is the moment it speaks: at the scale, on the belt, at the carousel. The launch script ends its carousel beat with a stranger asking "Where did you GET that?"`,
  },
  {
    part: "positioning",
    status: "written",
    sources: ["prd", "idea", "play", "platform"],
    position: "not a gadget - a comedy device that happens to be a gadget.",
    body: `The PRD's positioning line is the rule for everything else: "All budget demonstrates, never explains."

**What it sits next to.** The Bluetooth speaker, as its "funnier, cheaper cousin". The novelty sound gadgets that sell for $13 to $15 on Etsy and eBay. The Furby. On an airport gift-shop counter it is, in the playbook's pitch to buyers, "the only product in your store that demos itself to people who are already mad about bags."

**What it is not.** Not an app and not a tracker: there is nothing to pair and the radios are off. Not a lithium gadget that has to be switched off before check-in. Not a celebrity impression: the documents insist on an original voice ("an original sassy voice is safer and more ownable as a brand").

**Where it sells.** Kickstarter first, aimed at Q4 gifting, then TikTok Shop and Shopify, an Amazon listing, and airport gift-shop wholesale. It is sold both as a checked-bag comedy device and as a carry-on strap-on. If it takes off, the trigger engine can be licensed to luggage brands, and voice packs and holiday editions bring buyers back.`,
  },
  {
    part: "voice",
    status: "written",
    sources: ["play", "idea", "script", "names", "design", "platform", "mktChat"],
    body: `The bag is the star, and it speaks for itself. The playbook's brand rules: "the BAG speaks first person, never the company. Deadpan host, chaotic bag. Every asset ends with ONE action. No celebrity voices." The website plan adds a fourth character to the cast: "host, agent, bag, WEBSITE", where every page "masquerades as a piece of airport infrastructure": a departure board, a scale readout, a complaint form, a frequent-flyer portal.

The humour is the indignity of being luggage, played straight. The bag is vain about its weight, fussy about being handled, thrilled by the carousel and lonely in the hold. It is never mean to the traveller; it complains to whoever is in earshot.

Three voice packs set how rude it is: Family Friendly, Salty and New Yorker. The naming note turns them into a ladder of cabin classes, "Coach (Family Friendly) → Premium Sass (Salty) → First Class (New Yorker)", with the $49 collector edition as "Black Card: Checked & Offended Edition". The Kickstarter tiers follow the same joke: Checked, Carry-On, Overhead Bin, First Class and The Whole Cargo Hold.

Name candidates, as the naming note ranks them: "Baggage Claims" ("Legal-world pun"), "Sass Case" ("\"suitcase\" with the attitude baked in"), "Emotional Baggage" ("Tagline writes itself: \"Now available as literal luggage.\""), "LoudMouth Luggage" and "Checked & Offended" ("the funniest bumper sticker of the bunch").`,
    examples: [
      { text: "OW! ...I felt that in my flip-flops.", context: "Hard impact on the belt" },
      { text: "Are you calling me FAT?", context: "Held still on the check-in scale" },
      { text: "Whoa whoa whoa — are you gonna buy me dinner first?", context: "Lifted by the handle" },
      { text: "Wheeee! Again! Again!", context: "The carousel" },
      { text: "Is this the Tilt-A-Whirl?", context: "The carousel, another take" },
      { text: "Oh sure, I'll take the scenic route.", context: "The conveyor or a tarmac cart" },
      { text: "I'm— I'm inverted. Somebody call Goose.", context: "Upside down" },
      { text: "Hello? ...Anyone? ...Cool, cool. I'll just be here.", context: "Two hours in the dark hold, then snoring" },
      { text: "IT FITS IF YOU PUSH— okay okay it doesn't fit.", context: "Shoved into an overhead bin" },
      { text: "Was that a beep of judgment?", context: "A scanner's beep (a stretch goal)" },
      { text: "I... hun...ger", context: "Low battery" },
      { text: "Sixty-two pounds? That's mostly SOUVENIRS.", context: "Back at the scale, the launch video's last line" },
      { text: "crew rested me on the WET tarmac?? sir I am luggage", context: "@TheBagComplains replying to an airline meltdown post" },
      { text: "My bag embarrassed me in front of the entire carousel. Five stars.", context: "A retargeting ad written as a review" },
      { text: "TSA agent laughed so hard she forgot to swab my laptop. Five stars.", context: "A retargeting ad written as a review" },
      { text: "Ruined my marriage. She took his side. The bag's side. Five stars.", context: "A retargeting ad written as a review" },
      { text: "Q: Will TSA confiscate it? A: Alkaline AA. No lithium. We checked. The bag insists you switch it OFF before checking.", context: "The Kickstarter FAQ, in character" },
      { text: "Claimant alleges being called FAT at Terminal C...", context: "The Lost Baggage Hotline's claim ticket" },
      { text: "Your luggage finally talks back.", context: "Launch video title card" },
      { text: "It knows when it's being weighed. And it is NOT happy.", context: "Kickstarter headline" },
      { text: "Pledge. Pack. Let the bag complain.", context: "Launch video tag card" },
      { text: "FRAGILE — and emotionally unstable.", context: "The luggage tag" },
      { text: "No celebrity voices were harmed in this production.", context: "The launch video's small print" },
    ],
  },
  {
    part: "open",
    status: "written",
    sources: ["prd", "names", "play", "platform", "guide", "design", "idea", "bom"],
    body: `**Decided in the documents.** Alkaline AA power, so the bag can talk in the hold. Radios off. An original, contracted voice actor, never a celebrity impression. Three voice packs on microSD, sold as add-ons. The governor: one gag per moment per phase, three seconds apart, six an hour at most. A cheap test before any Kickstarter money is spent.

**Still open, because the documents disagree.**

- **The name.** Every document says Baggage Claims; the project is called Emotional Baggage; the naming note ranks Sass Case first for retail and warns that Emotional Baggage "attracts pre-existing novelty trademarks". The domains named are BaggageClaims.com and SassCase.com. No trademark or domain screen has been run.
- **The web stack.** The website plan builds on Shopify with Klaviyo, Viral Loops, Supabase and Vercel. Two web blueprints (Rev A on Next.js 15, Rev B on Next.js 16, which says it supersedes Rev A) describe custom builds, and the schema and Compose files in the folder are the Rev A versions.
- **Home base.** The playbook's Complaint Desk stunt and the design chat's same-day parts pickup assume Austin.
- **The Kickstarter target.** The PRD sets a $15k goal; the playbook aims for 2,000 backers, about $48k.
- **Build time.** The PRD and the design package say about 90 minutes for a first build; the build guide says about 3.5 hours of hands-on work plus about 5 hours of unattended printing.
- **Firmware details.** The design package describes a 2-second history buffer, the Adafruit MPU6050 library and deep sleep at 30 to 60 µA; the PRD's firmware map describes a 10-second history, raw I2C and a 1-second light-sleep poll, with true wake-on-interrupt left to Rev B. The first proposal said two AA cells; every later document says three.
- **The firmware sketch.** The sketch exists only inside a chat document (the .ino file it names is not in the folder). As pasted, mpuSample() uses gxDump and gzDump before they are declared further down, so it will likely not compile until that declaration moves up. It has not been compiled here.
- **The parts list.** The CSV has 16 lines; the PRD groups them into 9 rows. Both total $64.80.

**Missing altogether.** No voice clips, no hotline fragment library and no voice talent yet; no logo, colours, type or product photos; and several files the documents refer to (the classifier .ino, the 3D view, the clamshell STL and its generator) are not in the folder.

The Decision tree and Open questions sections below hold the live state of each one.`,
  },
  {
    part: "gate",
    status: "written",
    sources: ["prd", "play", "prdChat", "mktChat", "script", "idea"],
    body: `The documents put a cheap kill-switch in front of everything else. About $750 (about $500 in parts and $200 in tooling) buys a five-unit validation batch, a weekend of firmware tuning and a filmed test at a real airport. The four fifteen-second clips (FAT, OW, DARK and WHEE) go up unbranded, with a pinned comment: "comment FAT for where to get one".

**Go:** a clip passes 50,000 organic views, or 500 people sign up for the waiting list. Only then is money spent on Kickstarter preparation ($2,000 to $3,000).

**Stop:** under 50,000 views and under 500 emails in 30 days. In the playbook's words: "stop, pivot creative, do NOT fund production."

**Scale:** more than 2,000 emails before launch green-lights a 1,000-unit run. The playbook's whole pre-revenue budget is about $4,500, and paid promotion only ever goes behind clips that have already proved themselves: "the creative earns the right to spend, never the reverse."

Whichever clip breaks out first tells the team which gag leads the hero video. The launch script bets on the handler beat: "the confused-look-around is the clip's money shot".`,
  },
];

/**
 * Puts the story and the source list into the example concept, once per database, on an install that already has
 * the example (seedOnce runs first). Parts or sources that already exist are left as they are. Runs inside ready()
 * on a pool client, never tx(), and is guarded by the event "seed.story" and an advisory lock.
 */
export async function seedStory(db: Pool) {
  const id = SEED_PROJECT.id;
  const has = await db.query("SELECT 1 FROM projects WHERE id=$1", [id]);
  if (!has.rowCount) return;
  if ((await db.query("SELECT 1 FROM events WHERE project_id=$1 AND kind='seed.story'", [id])).rowCount) return;
  const { logEventIn } = await import("@/lib/db");
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`seed.story:${id}`]);
    if ((await c.query("SELECT 1 FROM events WHERE project_id=$1 AND kind='seed.story'", [id])).rowCount) {
      await c.query("ROLLBACK");
      return;
    }
    // Story and sources go before every other row of the example (its seeded rows start at sort 0).
    const ids = new Map<string, number>();
    let added = 0;
    for (let i = 0; i < SEED_SOURCES.length; i++) {
      const s = SEED_SOURCES[i];
      const found = await c.query<{ id: string }>("SELECT id FROM items WHERE project_id=$1 AND section=$2 AND title=$3 ORDER BY id LIMIT 1", [id, SOURCES_STORE, s.title]);
      if (found.rowCount) {
        ids.set(s.key, Number(found.rows[0].id));
        continue;
      }
      const data: SourceData = { kind: s.kind, origin: DRIVE, fileName: s.title, fileId: null };
      const r = await c.query<{ id: string }>(
        "INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,$2,$3,$4,$5,'not uploaded',$6) RETURNING id",
        [id, SOURCES_STORE, s.title, s.what, JSON.stringify(data), -500 + i]
      );
      ids.set(s.key, Number(r.rows[0].id));
      added++;
    }
    const map = (keys: string[]) => [...new Set(keys.map((k) => ids.get(k)).filter((n): n is number => typeof n === "number"))];
    let parts = 0;
    for (let i = 0; i < SEED_STORY.length; i++) {
      const p = SEED_STORY[i];
      if ((await c.query("SELECT 1 FROM items WHERE project_id=$1 AND section=$2 AND data->>'part'=$3", [id, STORY_STORE, p.part])).rowCount) continue;
      const data: StoryData = {
        part: p.part,
        sourceIds: map(p.sources),
        ...(p.position ? { position: p.position } : {}),
        ...(p.examples ? { examples: p.examples } : {}),
        ...(p.claims ? { claims: p.claims.map(({ sources, ...cl }) => ({ ...cl, sourceIds: map(sources) })) } : {}),
      };
      await c.query("INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)", [
        id,
        STORY_STORE,
        storyPart(p.part)!.heading,
        p.body,
        JSON.stringify(data),
        p.status,
        -1000 + i,
      ]);
      parts++;
    }
    await logEventIn(c, id, "seed.story", `Wrote the concept story (${parts} parts) and listed ${added} source documents from the owner's Drive folder`, { parts, sources: added, seeded: true });
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}
