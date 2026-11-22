# Baggage Claims MK1: what the documents hold that the app does not

**Totals.** 491 rows are proposed against 174 rows the example has today. By stage: Concept 136, Research 70, Design 57, Prototype 54, Production 50, Marketing 93, Sales 10, Unmapped (web platform) 21. By action: 266 add, 101 enrich, 6 replace, 55 conflicts for your decision, 63 new claims to verify (on top of the 9 claims already listed, 7 of which get their cited source added). 176 rows need a decision from you before they can be entered; 417 rows are stated plainly in a document, 58 are combined or summarised, 16 are inferred. All 21 files in `seed/concepts/baggage-claims/files/` were read in full: the 18 text files directly, the two PDFs through `pdftotext -layout` (6 and 5 pages), and `schematic.png` by eye. None was unreadable. This is a review sheet (22 Nov 2026): nothing has been changed in the application, the seed data or the database, and the full detail of every row is in `baggage-claims-content-proposal.csv`, beside this file.

## How to read this

- Each row has an id (P001 onward) that is the same here and in the CSV. This file gives the title and a one-line gist; the CSV gives the full text to enter, what the app has now, the source file, the place in it, and up to 25 words copied exactly from the source so you can find it.
- **Actions.** *add*: a new row. *enrich*: an existing row keeps its text and gains what is listed. *replace*: an existing row or sentence is wrong or in the wrong shape and is swapped. *flag-conflict*: two or more documents disagree; the row lists each value with its source and nothing is chosen. *add-claim*: an outside fact a document asserts and nobody has checked.
- **Confidence.** high: the source states it plainly. medium: I combined or summarised several lines. low: I inferred it; the row says so.
- **"Mine".** Where a note says a sum, a count or a reading is mine, the documents do not state it; I worked it out from their figures. Check those first.
- **Existing rows** are counted from `src/lib/seed.ts` and `src/lib/story/seed.ts`, which is what a fresh install seeds. I did not read the live database, so anything typed into the running app since is not counted.
- Where a document's own wording contains a long dash, this file shows a hyphen. The CSV keeps the exact characters.
- Conflicts are filed under Concept, Open questions, and listed once, in "Conflicts for your decision". New claims are filed under Research, Claims to verify, and listed once, in "Claims to verify".

## Concept (136 rows proposed)

### Concept story (`concept/story`): 9 existing, 2 proposed

Existing: The pitch; Where the idea came from; What it is and how it works; Why it should work; Who it is for, and the moment they want it; Positioning; Voice, humour and personality; Decided and still open; What it costs to find out.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P001 | replace | Decided and still open: the parts list sentence | Replace "The CSV has 16 lines; the PRD groups them into 9 rows. Both total \$64.80." with: "The CSV has 16 lines that add up to ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P002 | enrich | Decided and still open: conflicts the story does not list | Add to the "still open" list, one line each, the conflicts found in this pass that the story omits: switched off or performing in ... | BaggageClaims_DesignPackage_RevA.pdf |

### Files (`concept/files`): 21 existing, 0 proposed

Existing: the 21 source files, one row each.

Nothing to add: all 21 files are listed. Files the documents name that are not in the folder are in their own section below.

### Brief (`concept/brief`): 6 existing, 23 proposed

Existing: One-liner; Vision; Who it is for; How it works; Claimed moats; The ask and the gate.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P003 | add | Why now | Body: The US gifts, novelty and souvenir market was worth about \$32.7B in 2025 and is forecast to grow at about 6.4% a year ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P004 | add | Stakeholder: traveler (buyer) | Body: Pain: airports are stressful, anonymous, boring. Relief: turns dead travel time into a shared joke at weigh-in, belt and ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P005 | add | Stakeholder: gift-giver | Body: Pain: needs a \$20-30 gift that is NOT another candle. Relief: instant novelty; gag price band proven at \$12-15 on Etsy and ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P006 | add | Stakeholder: baggage handler and bystander | Body: Pain: invisible labor. Relief: the bag talks back; handlers become the audience and the viral content engine. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P007 | add | Stakeholder: retailer | Body: Pain: the gag shelf churns on meme cycles. Relief: seasonal voice packs refresh the SKU without new hardware. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P008 | enrich | Who it is for | Add each segment's signal and job. P1 frequent leisure flyers 25-45: core gifting demographic; express personality, prank travel ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P009 | enrich | How it works | Add: MPU-6050 gives 16-bit acceleration at +/-8 g (covers drop peaks) and gyro at +/-500 dps (covers carousel rotation), 100 Hz ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P010 | add | Data flow and firmware states | Body: IMU 100 Hz > ring buffer > feature extractor > state machine (BOOT / CALIBRATE / IDLE / ACTIVE_SAMPLE / CLASSIFY / DISPATCH ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P011 | add | Power strategy | Body: 3xAA alkaline; deep sleep about 30-60 uA with a 1 s wake poll plus a latched IMU motion interrupt gives 3-6 months per ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P012 | add | Form and first principles (first proposal) | Body: A palm-sized puck (think an old-school tape measure or a hockey puck) that straps to a luggage handle or drops into an ... | I have an idea for a quick gag and potential quick.md |
| P013 | enrich | Claimed moats | Add the PRD's detail: (1) the trigger-pattern classifier is "hard to copy well without flying duffel bags around"; (3) the ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P014 | enrich | The ask and the gate | Add: Phase 1 "Proof of funny" runs weeks 1-3: build the 5-unit EV batch, film the hero set (real suitcase talking back at a real ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P015 | add | Road to the quick buck (first proposal) | Body: 1. Prototype in a weekend and film a 30-second video of the bag getting tossed and yelling at the carousel: "This video is ... | I have an idea for a quick gag and potential quick.md |
| P016 | add | Realistic ceiling | Body: "The realistic ceiling on a single gag run is a viral 5-figure-to-low-6-figure seasonal product", and the worst case is ... | I have an idea for a quick gag and potential quick.md |
| P017 | add | Scale or exit | Body: Phase 3 always-on: TikTok Shop and Shopify DTC; an Amazon listing tuned to gag travel gift keywords; an airport gift-store ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P018 | add | Success metrics: phase gate and launch | Body: Phase gate: demo video 50k views or 500 signups. Launch: 2,000 backers, CAC under \$8, visitor-to-backer conversion over ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P019 | add | Success metrics: product and business | Body: Product: idle false positives under 1 a day, return rate under 4%, 4.3+ stars. Business: 45% blended gross margin on the ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P020 | add | Risk: lithium-in-checked-bags optics (High) | Body: Mitigation: alkaline-only by design plus a compliance card (switch OFF before checking); carry-on mode in marketing. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P021 | add | Risk: annoyance and airline complaints (Medium) | Body: Mitigation: governed output: 6/hour cap, 3 s cooldown, 85 dBA ceiling, volume button. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P022 | add | Risk: imitators (Medium) | Body: Mitigation: speed, brand and VO talent; design patent and trademark; classifier as trade secret. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P023 | add | Risk: voice rights and publicity claims (Medium) | Body: Mitigation: contracted original VO with releases; no celebrity impressions. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P024 | add | Risk: seasonality, Q4-heavy (Low-Med) | Body: Mitigation: voice-pack DLC; spring-break and summer editions; wedding and bachelor gag angle. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P025 | add | Risk: single-source codec clones (Low) | Body: Mitigation: dual-source YX5200/KT148A; the SPI flash path removes the module dependency in Rev C. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |

### Press release (`concept/press`): 0 existing, 1 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P026 | add | Press angles on file (no release has been written) | Body: The documents hold three press lines and no release text. (1) PRD PR angle: "the world's sassiest suitcase". (2) Naming ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |

### FAQ (`concept/faq`): 0 existing, 8 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P027 | add | Will TSA confiscate it? | Body (the playbook's in-character answer, verbatim): "Alkaline AA. No lithium. We checked. The bag insists you switch it OFF ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P028 | add | Can it ride in a checked bag? | Body: The documents' answer: it runs on alkaline AA only, never lithium. The compliance card in the shell reads "Alkaline AA ... | BaggageClaims_DesignPackage_RevA.pdf |
| P029 | add | Will it annoy everyone around me? | Body: The governor allows one gag per kind of moment per journey phase, a 3 s cooldown and at most 6 gags an hour, at no more ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P030 | add | Does it need an app or pairing? | Body: No. The host's line in the launch video: "Three double-A batteries. No app. No pairing. One button. It just knows." The ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P031 | add | How long do the batteries last? | Body: The PRD states 3-6 months per set of three AA alkaline cells, from deep sleep at about 30-60 uA. Not measured. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P032 | add | Can I change what it says or how loud it is? | Body: One button: a short press cycles the volume (50 / 75 / 100%), a long press swaps the voice pack (Family / Salty / New ... | BaggageClaims_DesignPackage_RevA.pdf |
| P033 | add | What does it react to? | Body: Eight travel moments: a hard impact, the weigh-in, a handle grab, free-fall, the carousel, a conveyor or cart ride, being ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P034 | add | FAQ house style: the Complaint Department | Body: All support is in character ("Our agents are currently on a tarmac delay"), with the real answer under every joke; ... | BaggageClaims_Website_Platform_Plan_RevA.txt |

### Names and taglines (also shown under Marketing) (`concept/names`): 9 existing, 28 proposed

Existing: Baggage Claims; Sass Case; Emotional Baggage; LoudMouth Luggage; Checked & Offended; Your luggage finally talks back.; It knows when it's being weighed. And it is NOT happy.; Pledge. Pack. Let the bag complain.; FRAGILE - and emotionally unstable..

| id | action | title | gist | source file |
|---|---|---|---|---|
| P035 | enrich | Baggage Claims | Body in the note's words: "the incumbent. Legal-world pun, instantly says 'luggage with complaints,' and 'file a claim' doubles ... | What clever names for this ?.md |
| P036 | enrich | Sass Case | Body in the note's words: "'suitcase' with the attitude baked in. Two syllables, giftable, and the voice packs (Family / Salty / ... | What clever names for this ?.md |
| P037 | enrich | Emotional Baggage | Body in the note's words: "the obvious one, but obvious works for gag gifts. Tagline writes itself: 'Now available as literal ... | What clever names for this ?.md |
| P038 | enrich | LoudMouth Luggage | Body in the note's words: "alliterative, retail-shelf friendly, reads great on an airport gift-shop counter display." | What clever names for this ?.md |
| P039 | enrich | Checked & Offended | Body in the note's words: "the checked-bag journey plus the personality. Slightly long, but it's the funniest bumper sticker of ... | What clever names for this ?.md |
| P040 | add | Bellyaching | kind: Name. Body: "cargo 'belly' + complaining. Deep cut, but rewarding." Status: candidate. | What clever names for this ?.md |
| P041 | add | The Mouthful | kind: Name. Body: "plays on 'a mouthful of luggage'... okay, this one's a stretch, skip it." Status: rejected (the note itself ... | What clever names for this ?.md |
| P042 | add | HeavyBag | kind: Name. Body: "deadpan, airline-scale joke embedded (overweight fees), short and trademarkable." Status: candidate. | What clever names for this ?.md |
| P043 | add | Unclaimed | kind: Name. Body: "carousel-native. Dark humor angle: the bag that refuses to shut up until somebody claims it." Status: ... | What clever names for this ?.md |
| P044 | add | Freightened | kind: Name. Body: "freight + frightened. Cute, but reads better in print than out loud." Status: candidate. | What clever names for this ?.md |
| P045 | add | Sass Case (product) with Baggage Claims (product line) | kind: Name. Body: the note's way out if torn: "product name Sass Case, product line Baggage Claims, and the tag covers both: ... | What clever names for this ?.md |
| P046 | add | Voice pack ladder: Coach, Premium Sass, First Class | kind: Name (voice packs). Body: name the packs as a ladder so the DLC feels like a product line: Coach (Family Friendly), Premium ... | What clever names for this ?.md |
| P047 | add | Black Card: Checked & Offended Edition | kind: Name (the \$49 collector edition). Status: candidate. | What clever names for this ?.md |
| P048 | add | Kickstarter tier names: Checked, Carry-On, Overhead Bin, First Class, The Whole Cargo Hold | kind: Name (reward tiers as cabin classes). CHECKED \$19 early bird, CARRY-ON \$24, OVERHEAD BIN \$34 two-pack, FIRST CLASS \$49 ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P049 | add | Seasonal and stretch voice pack names | kind: Name (voice packs). Holiday Heckler, Summer Breakdown, Bachelor Party Layover (quarterly drops at \$7.99); International ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P050 | add | @TheBagComplains | kind: Name (the bag's own account on TikTok, X and Instagram). Status: candidate. Handle availability not checked. | BaggageClaims_Marketing_Playbook_RevA.txt |
| P051 | add | Now available as literal luggage. | kind: Tagline. Body: the line the naming note attaches to the name Emotional Baggage. Status: candidate. | What clever names for this ?.md |
| P052 | add | the suitcase that talks back | kind: Tagline. Body: the first proposal's marketing line for gags ranked 2 and 3. Status: candidate. | I have an idea for a quick gag and potential quick.md |
| P053 | add | It's the Furby of luggage. | kind: Tagline. Status: candidate. Names another company's product; check before any public use. | I have an idea for a quick gag and potential quick.md |
| P054 | add | AA-powered. No lithium. Airline-legit. | kind: Tagline (compliance badge strip on the home page). Status: candidate. | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P055 | add | AA POWER - checked-bag legal. No lithium, no drama. | kind: Tagline (launch video lower third). The source has a long dash after POWER. Status: candidate. | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P056 | add | Because somebody at the airport should be honest about what's happening to your stuff. | kind: Tagline. Body: the host's closing line in the launch video, after "Baggage Claims." Status: candidate. | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P057 | add | the only product in your store that demos itself to people who are already mad about bags. | kind: Tagline (pitch line to retail buyers). Status: candidate. | BaggageClaims_Marketing_Playbook_RevA.txt |
| P058 | add | the world's sassiest suitcase | kind: Tagline (PR angle). The naming note extends it: "the world's sassiest suitcase files its first claim". Status: candidate. | What clever names for this ?.md |
| P059 | add | CHECK MY BAG IN | kind: Tagline (the home page's single call to action, styled as a check-in kiosk button with an email field). Status: candidate. | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P060 | add | \$24.95 - UNDER THE LIMIT | kind: Tagline (the product page shows the price as a scale readout). The source has a long dash. Status: candidate. | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P061 | add | Your bag filed its complaint | kind: Tagline (subject of the Hotline reveal email). Status: candidate. | Walk through the Hotline TTS audio worker flow.md |
| P062 | enrich | Screening still owed on every name | Add to each finalist's row: run the USPTO TESS database and a domain check before printing anything ("One caveat worth 15 ... | What clever names for this ?.md |

### Decision tree (`concept/decisions`): 8 existing, 14 proposed

Existing: Spend about \$750 on the validation batch?; Which name ships?; Which enclosure build?; Phase 1 gate: did the unbranded clips pass?; Primary sales channel?; If Kickstarter runs: which goal?; Which web stack for the product site?; Scale gate: enough emails before launch?.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P063 | enrich | Which name ships? | Add a fourth option: id "split", label "Sass Case as product name, Baggage Claims as product line", outcome "The naming note's ... | What clever names for this ?.md |
| P064 | enrich | Which enclosure build? | Add costs and a fourth option. two-piece: about 100 g, about \$2 a unit in filament, about 4 h. clamshell: about 62 g PETG, 4-5 h ... | BaggageClaims_DesignPackage_RevA.pdf |
| P065 | enrich | Phase 1 gate: did the unbranded clips pass? | Add the mechanics: posted raw at 6-8 am local commuter slots; pinned reply "comment FAT for where to get one" with a keyword ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P066 | enrich | If Kickstarter runs: which goal? | Add the other figures on file: the first proposal says "a \$15-20k Kickstarter"; the playbook's stretch goals sit at \$25k ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P067 | enrich | Which web stack for the product site? | Add what each document claims about the others: Blueprint Rev A "Supersedes 'Shopify system-of-record' for the custom build path; ... | BaggageClaims_Web_Blueprint_RevA.md |
| P068 | add | Which 3D printer? | key: printer. parent: enclosure. options: (a1) "Bambu Lab A1", outcome "\$259.99 at Micro Center, 256 mm bed, direct drive (needed ... | Can I do a 3d printer for this integrated - if so.md |
| P069 | add | Rev A sleep: light-sleep poll or deep sleep with interrupt wake? | key: sleep. options: (light) "1 s light-sleep poll with the latched motion interrupt", outcome "What the sketch does; true wake ... | Generate the Arduino sketch for the classification.md |
| P070 | add | Audio storage: microSD or SPI flash, and in which revision? | key: audio-storage. options: (sd) "microSD card", outcome "Rev A as built; packs sold as microSD at \$7.99; \$2 card"; (flash) "SPI ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P071 | add | Stretch gags: overhead-bin shake and scanner beep | key: stretch-gags. options: (keep8) "Ship the eight moments only", outcome "Matches every Rev A document after the first ... | I have an idea for a quick gag and potential quick.md |
| P072 | add | Who records the first clips? | key: voice. options: (self) "Record 10 starter gags yourself", outcome "What the build guide and design package tell the builder ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P073 | add | Sensor mount: mid-plate on standoffs or printed posts? | key: mount. parent: enclosure. options: (mid-plate) "Mid-plate on M2 brass standoffs", outcome "PRD and design package: U2 screws ... | BaggageClaims_BuildGuide_RevA.md |
| P074 | add | Creator terms: how many, and what share? | key: creators. options: (prd) "3-5 mid-size travel comedians at 10-20% revenue share", outcome "PRD Phase 2"; (playbook) "20 ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P075 | add | Collector tier: capped at 100 or uncapped? | key: collector-cap. options: (cap) "100 cap", outcome "As the tier ladder is written: FIRST CLASS \$49 collector (Gold Voice, ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P076 | add | Dark idle: add a light sensor? | key: light-sensor. options: (none) "Motion only", outcome "What the sketch and the parts list do"; (light) "No motion and no ... | BaggageClaims_DesignPackage_RevA.pdf |

### Open questions (`concept/questions`): 5 existing, 60 proposed

Existing: Which name ships?; Which web stack for the product site?; Is Austin still the home base?; Kickstarter goal: \$15k or 2,000 backers?; Primary sales channel.

55 of the 60 are conflicts (P082 to P136), listed in "Conflicts for your decision". The other 5:

| id | action | title | gist | source file |
|---|---|---|---|---|
| P077 | enrich | Is Austin still the home base? | Add the evidence: the design chat's shopping plan says "Micro Center (same-day, Austin)"; the playbook's stunt is "(Austin ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P078 | enrich | Primary sales channel | Add the PRD's own order: Kickstarter in weeks 4-12, then "TikTok Shop + Shopify DTC; Amazon listing tuned to gag travel gift ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P079 | add | Is there an EU or Dutch audience at launch? | Body: the website plan says "NL/EU audience = strict GDPR defaults", and the Kickstarter stretch goal is an International pack ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P080 | add | Who writes and records the lines, and how many are needed? | Body: the documents hold lines for the eight moments, the low-battery rasp and a few alternates. The plan needs 128 clips for ... | BaggageClaims_DesignPackage_RevA.pdf |
| P081 | add | How does a unit get its serial number? | Body: registration, entitlement, recall messages and the /claim page all depend on a unit serial "printed on compliance card" ... | db_schema.sql |

## Research (70 rows proposed)

### Claims to verify (`research/claims`): 9 existing, 70 proposed

Existing: US gifts, novelty and souvenir market was about \$32.7B in 2025, growing about 6.4% a year through 2034; Gag gifts sell in a \$12-15 band on Etsy and eBay; FAA PackSafe requires lithium devices in checked bags to be fully off; alkaline AA cells face no such restriction; Successful Kickstarter tech campaigns average about \$33k raised; 10% of tech backers delivered 60% of reward funding in Q3 2026; Turnkey PCBA runs about \$18-22 per board for a moderate BOM at 1,000 pieces; Mid-tier creators (50k-500k followers) get about 3x the engagement of mega-influencers for prop comedy; 2.8 billion bags are checked every year; Amazon FBA all-in take is about 30% at \$27.95.

63 of the 70 are new claims (P144 to P206), listed in "Claims to verify". The other 7 add the cited source to claims already in the app:

| id | action | title | gist | source file |
|---|---|---|---|---|
| P137 | enrich | US gifts, novelty and souvenir market was about \$32.7B in 2025, growing about 6.4% a year ... | Add to the body where the chat summary says the figure comes from: footnote 4, ... | Create a PRD for this with arch instructions bom a.md |
| P138 | enrich | Gag gifts sell in a \$12-15 band on Etsy and eBay | Add: the first proposal gives a different band, "similar novelty sound gadgets sell on Etsy and eBay for \$13-15", and cites two ... | I have an idea for a quick gag and potential quick.md |
| P139 | enrich | FAA PackSafe requires lithium devices in checked bags to be fully off; alkaline AA cells ... | Add the cited pages: https://www.faa.gov/hazmat/packsafe/portable-electronic-devices-with-batteries, ... | I have an idea for a quick gag and potential quick.md |
| P140 | enrich | Successful Kickstarter tech campaigns average about \$33k raised | Add the cited source: footnote 6, a LinkedIn article ("I researched Kickstarter [an] entire week, here's [the] cheat sheet"). Add ... | Create a PRD for this with arch instructions bom a.md |
| P141 | enrich | 10% of tech backers delivered 60% of reward funding in Q3 2026 | Add the cited source: footnote 7, a LinkedIn post by "tcf-team" on tech and gadget Kickstarter campaigns. Add the playbook's use ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P142 | enrich | Turnkey PCBA runs about \$18-22 per board for a moderate BOM at 1,000 pieces | Add the rest of the PRD's sentence, which is also unverified: "\$1-5 per board at high volume, 2-layer PCB \$0.50-1.50 at 1k+". ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P143 | enrich | Mid-tier creators (50k-500k followers) get about 3x the engagement of mega-influencers ... | Add: the playbook gives no source for the 3x figure. | BaggageClaims_Marketing_Playbook_RevA.txt |

## Design (57 rows proposed)

### Requirements (`design/requirements`): 13 existing, 31 proposed

Existing: Detect: Hard impact; Detect: Weigh-in; Detect: Handle grab; Detect: Free-fall; Detect: Carousel; Detect: Conveyor; Detect: Inverted; Detect: Dark idle; Governor; Power; Controls; Enclosure; Firmware sketch compiles.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P207 | enrich | Detect: Hard impact | trigger: "Peak \|a\| > T after free-fall or rest; 8-14 g peak, under 50 ms" (design package); sketch constant IMPACT_G = 8.0 g on ... | BaggageClaims_DesignPackage_RevA.pdf |
| P208 | enrich | Detect: Weigh-in | trigger: "Lift 1.2-2.0 m/s up, hold still, then set down; 3.5-6 s stationary at +0.8-1.2 m height" (design package). Sketch: ... | BaggageClaims_DesignPackage_RevA.pdf |
| P209 | enrich | Detect: Handle grab | trigger: "Sustained tilt + steady carry accel RMS; carry-mode 10-90 s" (design package). Sketch: tilt between 25 and 75 degrees ... | BaggageClaims_DesignPackage_RevA.pdf |
| P210 | enrich | Detect: Free-fall | trigger: "\|a\| < 0.15 g, persisting at least 0.28 s, then impact". Sketch: FREEFALL_G 0.15, FREEFALL_MIN_MS 280, and the impact ... | Generate the Arduino sketch for the classification.md |
| P211 | enrich | Detect: Carousel | trigger: "Periodic rotation: gyro Z sinusoid + centripetal accel; over 25 s, period 3-12 s" (design package). Sketch: gyro above ... | BaggageClaims_DesignPackage_RevA.pdf |
| P212 | enrich | Detect: Conveyor | trigger: "Low-freq rumble, accel variance in band; over 8 s" (design package). Sketch: variance of the last 8 s of magnitude ... | BaggageClaims_DesignPackage_RevA.pdf |
| P213 | enrich | Detect: Inverted | trigger: "\|a_z + 1g\| < 0.1 g (upside down) for over 4 s" (design package). Sketch: z acceleration below -0.9 g for 4 s. response: ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P214 | enrich | Detect: Dark idle | trigger: "No motion, no light (optional); idle over 2 h, sampled at the wake window". Sketch: DARK_IDLE_MS is 2 h since the last ... | Generate the Arduino sketch for the classification.md |
| P215 | add | Detect: Overhead-bin stuffing (stretch) | trigger: "Rapid repeated shaking". response: "IT FITS IF YOU PUSH - okay okay it doesn't fit." (the source has a long dash). ... | I have an idea for a quick gag and potential quick.md |
| P216 | add | Detect: Scanner or scale beep by microphone (stretch) | trigger: "Detectable beep pattern via mic (optional)". response: "Was that a beep of judgment?" Body: ranked 10, score 5. ... | I have an idea for a quick gag and potential quick.md |
| P217 | enrich | Governor | Add to body: one gag per event class per journey phase; in the sketch a new journey phase begins after 60 minutes without motion ... | Generate the Arduino sketch for the classification.md |
| P218 | enrich | Power | Add to body: bus 4.5-4.9 V into the DevKit VIN pin, onboard LDO to 3.3 V; 300 mA typical, 1.8 A audio peak, 60 uA sleep ... | BaggageClaims_DesignPackage_RevA.pdf |
| P219 | enrich | Controls | Add to body: short press cycles volume 50 / 75 / 100%, sent as player volume 15 / 23 / 30; the sketch starts at 23. Long press ... | BaggageClaims_DesignPackage_RevA.pdf |
| P220 | enrich | Enclosure | Add to body: two-piece PETG with a strap channel and a tuned speaker grille; mid-plate on M2 standoffs; the speaker faces the ... | BaggageClaims_DesignPackage_RevA.pdf |
| P221 | enrich | Firmware sketch compiles | Add to body, with line numbers in the chat file: mpuSample() at line 82 uses gxDump and gzDump; they are declared at line 126. ... | Generate the Arduino sketch for the classification.md |
| P222 | add | Sensor configuration | Body: MPU-6050 at I2C address 0x68, 400 kHz. ACCEL_CONFIG (0x1C) +/-8 g, written as 0x10 (4096 LSB/g). GYRO_CONFIG (0x1B) +/-500 ... | BaggageClaims_DesignPackage_RevA.pdf |
| P223 | add | Feature extraction | Body: from the 100 Hz samples the firmware derives magnitude, jerk, variance, orientation and periodicity (design package); the ... | BaggageClaims_DesignPackage_RevA.pdf |
| P224 | add | Firmware state machine | Body: BOOT -> CALIBRATE (gravity vector) -> IDLE (sleep, interrupt wake) -> ACTIVE_SAMPLE -> CLASSIFY -> DISPATCH (plays the ... | BaggageClaims_DesignPackage_RevA.pdf |
| P225 | add | Boot calibration | Body: at power-on, with the unit at rest, measure the gravity vector and log "CAL OK g=(x,y,z)"; the build guide expects (0.00, ... | BaggageClaims_BuildGuide_RevA.md |
| P226 | add | Low battery | Body: when the pack falls below 3.3 V, play the low-battery rasp ("I... hun...ger", clip 0010) once, then go to a brownout-safe ... | BaggageClaims_DesignPackage_RevA.pdf |
| P227 | add | Audio content format | Body: pre-rendered MP3 on a FAT32 microSD (8-32 GB); up to 128 clips per voice pack, about 64 kbps mono, under 150 MB in all; ... | BaggageClaims_DesignPackage_RevA.pdf |
| P228 | add | Audio command interface | Body: UART 9600 8N1, YX5200 command set (0x7E frame). Set volume: 0x06 v (0-30). Play folder file: 0x0F f i, where f is the voice ... | BaggageClaims_DesignPackage_RevA.pdf |
| P229 | add | Loudness limit | Body: no more than 85 dBA at 1 m, "to stay a novelty, not a nuisance". 3 W into 8 ohms. No measurement method is given. Status: ... | BaggageClaims_DesignPackage_RevA.pdf |
| P230 | add | Environment | Body: storage -10 C to +45 C (cargo holds); 0-95% relative humidity, non-condensing; survive shocks to 40 g, work to 14 g; splash ... | BaggageClaims_DesignPackage_RevA.pdf |
| P231 | add | Radios off | Body: Wi-Fi and Bluetooth are disabled in firmware, to save power and to keep the device out of RF certification scope; no ... | BaggageClaims_DesignPackage_RevA.pdf |
| P232 | add | Battery chemistry and the compliance card | Body: alkaline AA only, never lithium. A card inside the shell reads: "Alkaline AA only. Switch OFF before checking bag per ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P233 | add | Rigid sensor mount | Body: U2 must be screwed down through its two holes, never foam mounted: "Mounting compliance destroys jerk signatures." In a ... | Can I do a 3d printer for this integrated - if so.md |
| P234 | add | Service and debug port | Body: USB-C on the dev board (IF-7) for flashing and a 115200 baud debug console. The serial log prints one "EVT:" line per ... | BaggageClaims_DesignPackage_RevA.pdf |
| P235 | add | Content ships independently of firmware | Body: clips swap per voice pack, so seasonal editions, DLC and localization need no new hardware and no firmware change; a pack ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P236 | add | Idle false positives under one a day | Body: product metric and Rev A1 exit criterion: fewer than one false gag a day while idle. No test method is given. Status: open. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P237 | add | Rev B hardware scope | Body: custom PCB consolidating an ESP32-S3-WROOM module, the MPU-6050 and a YX5200-class codec in place of the three dev modules; ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |

### Schematic; Wiring and soldering (`design/wiring`): 20 existing, 9 proposed

Existing: Battery positive to switch; Switch to VIN; Battery negative to ground; Sensor power; Sensor ground; I2C clock; I2C data; Motion interrupt; Audio module power; Audio module ground; UART to the series resistor; Series resistor to audio module RX; UART from audio module; Busy line; Speaker lead 1; Speaker lead 2; Mode button to GPIO; Mode button to ground; Pull-up from 3V3; Pull-up to the mode GPIO.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P238 | enrich | Switch to VIN | Add to the note the design package's check: with the switch open VIN reads 0 V, closed about 4.7 V. Add: never battery-power the ... | BaggageClaims_DesignPackage_RevA.pdf |
| P239 | enrich | Battery negative to ground | Add: the design package's pin map puts the ground star at battery negative; its assembly step and the build guide put it at one ... | BaggageClaims_DesignPackage_RevA.pdf |
| P240 | enrich | I2C data | Add to the note: 4.7k pull-ups are on the GY-521 board, so none are added. Digital 3.3 V. | BaggageClaims_DesignPackage_RevA.pdf |
| P241 | enrich | Sensor power | Add to the note the design package's check: never connect GND to VCC; the MPU-6050 board's LED is lit when powered. | BaggageClaims_DesignPackage_RevA.pdf |
| P242 | enrich | Motion interrupt | Add to the note: wake source for sleep ("Falls out of deep sleep on motion"); in Rev A the sketch polls it every second instead. | BaggageClaims_DesignPackage_RevA.pdf |
| P243 | enrich | UART from audio module | Add to the note: carries status and ACK frames. | BaggageClaims_DesignPackage_RevA.pdf |
| P244 | enrich | Busy line | Add to the note: LOW while playing; gates the dispatcher. If it floats, sleep current is high (troubleshooting). | BaggageClaims_BuildGuide_RevA.md |
| P245 | enrich | Speaker lead 1 | Add to the note: differential drive from SPK_1 / SPK_2, 8 ohm, no more than 3 W (interface IF-4); route the leads down the side ... | BaggageClaims_BuildGuide_RevA.md |
| P246 | add | Schematic image: what it shows and what it leaves out | Body: schematic.png is a block diagram with U1, U2, U3, SPK1, R1, S1, S2, BT1 and J1 (USB-C on the dev board, for programming and ... | schematic.png |

### Bill of materials (also Physical layout, Sourcing, Part prices) (`design/bom`): 16 existing, 16 proposed

Existing: MCU dev board; IMU sensor; Audio module; Speaker; Battery holder; Batteries; Power switch; Mode button; Resistor; Resistor; Storage; Wire and headers; Carrier; Mounting; Enclosure; Mount strap.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P247 | enrich | All 16 parts: unit price and speed option | Add the CSV's two dropped columns to every part. unit (USD): U1 8.99, U2 6.99, U3 5.50, SPK1 1.75, BT1 2.00, BAT 2.50, S1 1.00, ... | BOM_shopping_list.csv |
| P248 | enrich | MCU dev board (U1) | Add: search term "SKU 699323"; PRD wording "(radios off in firmware)". Product page cited in the design chat: ... | BOM_shopping_list.csv |
| P249 | enrich | IMU sensor (U2) | Add to search: "sold \$6.99 1-pk or \$11.79 3-pk". | BOM_shopping_list.csv |
| P250 | enrich | Batteries (BAT) | Restore the specification: "AA alkaline (no lithium = checked-bag legal per FAA PackSafe)"; search "Any AA alkaline 4/8-pack". | BOM_shopping_list.csv |
| P251 | enrich | Power switch (S1) and mode button (S2) | Restore the specifications: S1 "SPST mini slide switch, through-hole or panel snap", search "'SPST slide switch' (MC variety ... | BOM_shopping_list.csv |
| P252 | enrich | Resistor R1 | Restore the CSV's reason: "1k ohm 1/4W (UART level tolerance)"; search "MC resistor kit / single". The design package gives a ... | BOM_shopping_list.csv |
| P253 | enrich | Storage (SD1) | Restore: "microSD 8-32GB FAT32 (voice clips, 001.mp3 naming)". | BOM_shopping_list.csv |
| P254 | enrich | Wire and headers (W1) | Restore the search term: "'jumper wire kit' + 'hookup wire spool'". The assembly uses 2.54 mm female headers so the modules are ... | BOM_shopping_list.csv |
| P255 | enrich | Enclosure (ENC1) | Restore: specification "3D print bottom/top shell (PETG, 4 perimeters, 25% infill) or RadioShack-style project box 80x60x40mm"; ... | BOM_shopping_list.csv |
| P256 | enrich | Speaker (SPK1) | Add: the speaker faces a tuned grille in the top shell and gives about 85 dBA at 1 m; sold as a four-pack for \$6.99. | BaggageClaims_DesignPackage_RevA.pdf |
| P257 | add | M2 self-tapping screws | ref: none assigned. Body: the build guide fixes the sensor and the perfboard to printed posts with M2 self-tapping screws. The ... | BaggageClaims_BuildGuide_RevA.md |
| P258 | add | Printed mid-plate | ref: none assigned. Body: the two-piece design carries the electronics on a printed mid-plate on M2 standoffs; it prints with the ... | Can I do a 3d printer for this integrated - if so.md |
| P259 | add | Hydrophobic mesh for the speaker grille | ref: none assigned. Body: named in the environmental limits as the splash protection. No size, source or price. | BaggageClaims_DesignPackage_RevA.pdf |
| P260 | add | Printed items in the box: compliance card, luggage tag, frequent-flyer card | ref: none assigned. Body: compliance card inside the shell (with the unit serial); luggage tag "FRAGILE - and emotionally ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P261 | add | Field kit: spare AAs and a tiny screwdriver | ref: none assigned. Body: "Field kit: pre-loaded microSD, spare AAs, tiny screwdriver." The build guide bags the spare AAs and ... | BaggageClaims_DesignPackage_RevA.pdf |
| P262 | add | Consumables: solder, hot glue, optional 3M VHB pad | ref: none assigned. Body: hot glue fixes the speaker behind the grille; solder for every joint; a VHB pad is an optional mount. ... | BaggageClaims_BuildGuide_RevA.md |

### Enclosure (`design/enclosure`): 0 existing, 1 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P263 | add | Enclosure settings the documents do state | params.lidType: "snap" (the clamshell closes with a snap latch released by pinching the front wall); params.screwSize: "M2". ... | BaggageClaims_BuildGuide_RevA.md |

## Prototype (54 rows proposed)

### 3D printing (`prototype/printing`): 2 existing, 6 proposed

Existing: Hinge clearance coupon; Print-in-place clamshell.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P264 | enrich | Hinge clearance coupon | Add to body: the pin and bore pairs are edited as pin_r / sock_ir in pip_clamshell_gen.py; squeeze each pair once; the pair that ... | BaggageClaims_BuildGuide_RevA.md |
| P265 | enrich | Print-in-place clamshell | Add to body: sliced in Bambu Studio; printed flat-open. Design rules from the 3D printing note: teardrop hinge profile (not ... | BaggageClaims_BuildGuide_RevA.md |
| P266 | add | Two-piece shell and mid-plate, one plate (Level 1) | material: "PETG". settings: "0.2 mm layers, 4 perimeters, 25% infill" (design package). estimate: "about 100 g, about 4 h, about ... | Can I do a 3d printer for this integrated - if so.md |
| P267 | add | One-piece TPU boot (Level 3) | material: "TPU 95A". settings: not stated; needs a direct-drive extruder. estimate: "about \$3 a unit"; time and mass not stated. ... | Can I do a 3d printer for this integrated - if so.md |
| P268 | add | Collector edition shell | material: "PETG-CF, or silk dual-colour through the AMS". estimate: "about \$4 a unit". Body: premium shelf look for the \$49 ... | Can I do a 3d printer for this integrated - if so.md |
| P269 | add | Batch plates for the 100-unit run | material: "PETG". estimate: "4-6 shells per plate, run overnight". Body: for the 100-unit EV batch the printer runs overnight in ... | Can I do a 3d printer for this integrated - if so.md |

### Assembly (`prototype/assembly`): 9 existing, 22 proposed

Existing: Phase 0 - Bench setup; Phase 1 - Print the enclosure; Phase 2 - Electronics; Phase 3 - First power-on; Phase 4 - Firmware; Phase 5 - Audio; Phase 6 - Integration; Phase 7 - Acceptance tests; Phase 8 - Pack-out.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P270 | add | Tools and materials on the bench | Body: soldering iron and solder, flush cutters, small Phillips screwdriver, tweezers, hot glue, multimeter, USB-C cable, a PC ... | BaggageClaims_BuildGuide_RevA.md |
| P271 | enrich | Phase 0 - Bench setup | Replace the body with the four steps: 1. Lay out all 16 BOM line items; verify against BOM_shopping_list.csv. 2. Flash check the ... | BaggageClaims_BuildGuide_RevA.md |
| P272 | enrich | Phase 1 - Print the enclosure | Replace the body with steps 5 to 9: 5. Slice the clamshell STL in Bambu Studio (PETG, 0.2 mm layers, 4 perimeters, 25% infill, ... | BaggageClaims_BuildGuide_RevA.md |
| P273 | enrich | Phase 2 - Electronics | Add to body the layout target: 5 x 7 cm perfboard, components on female headers (socketed, not soldered directly, so modules are ... | BaggageClaims_BuildGuide_RevA.md |
| P274 | add | Phase 2, step 10 - Power rail (do first, test before anything else) | Body: a. Solder the 3xAA holder RED lead to one leg of slide switch S1. b. Other S1 leg to the perfboard VIN rail to the ESP32-S3 ... | BaggageClaims_BuildGuide_RevA.md |
| P275 | add | Phase 2, step 11 - Motion sensor on I2C | Body: VCC to the 3V3 rail, GND to the GND star, SCL to GPIO8, SDA to GPIO9, INT to GPIO6. IMPORTANT: mount U2 by its two screw ... | BaggageClaims_BuildGuide_RevA.md |
| P276 | add | Phase 2, step 12 - Audio module, UART and speaker | Body: a. VCC to the VIN rail (4.5-5 V, NOT 3.3 V). b. GND to the GND star. c. ESP32 GPIO17 (TX) through a 1 k ohm resistor to ... | BaggageClaims_BuildGuide_RevA.md |
| P277 | add | Phase 2, step 13 - Mode button | Body: one leg to GPIO5, the other leg to GND, plus a 10 k ohm pull-up from GPIO5 to 3V3. The button must be reachable through the ... | BaggageClaims_BuildGuide_RevA.md |
| P278 | add | Phase 2, step 14 - Dress the wires and check every net | Body: dress wires flat, zip-tie the bundles, re-run continuity on every net against schematic.png. Check for shorts between VIN ... | BaggageClaims_BuildGuide_RevA.md |
| P279 | enrich | Phase 3 - First power-on | Replace the body with steps 15 to 17: 15. Modules seated, switch ON, meter the 3V3 rail: expect 3.28-3.35 V. 16. MPU-6050 power ... | BaggageClaims_BuildGuide_RevA.md |
| P280 | enrich | Phase 4 - Firmware | Replace the body with steps 18 to 22: 18. Arduino IDE: install the "esp32" boards core 3.x; Library Manager: DFRobotDFPlayerMini ... | BaggageClaims_BuildGuide_RevA.md |
| P281 | enrich | Phase 5 - Audio | Replace the body with steps 23 to 25: 23. Format the microSD FAT32; create folders /01 /02 /03 (voice packs). 24. Record 10 ... | BaggageClaims_BuildGuide_RevA.md |
| P282 | enrich | Phase 6 - Integration | Replace the body with steps 26 to 31: 26. Hot-glue the speaker to the inside of the TOP shell, cone over the honeycomb grille. ... | BaggageClaims_BuildGuide_RevA.md |
| P283 | enrich | Phase 8 - Pack-out | Replace the body with steps 37 to 40: 37. Strap the device to the suitcase handle; bag the spare AAs and the tiny screwdriver. ... | BaggageClaims_BuildGuide_RevA.md |
| P284 | add | Threshold tuning on the bench | Body: no shake table needed. Put the unit in a duffel bag; drop onto carpet from 0.3, 0.6 and 1.0 m; play a luggage-carousel ... | BaggageClaims_DesignPackage_RevA.pdf |
| P285 | add | Gyro axis check on a turntable | Body: the carousel rule reads one gyro axis. Spin the mounted puck slowly, watch the serial log, and reassign gz_ to whichever ... | Generate the Arduino sketch for the classification.md |
| P286 | add | Rev A1: threshold tuning on real flights | Body: roadmap step A1, weeks 2-4: tune the thresholds on real flights and record the 128-clip voice-over with a contracted voice ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P287 | add | Troubleshooting: boot loop | Body: cause: battery and USB both connected. Fix: use one source only. | BaggageClaims_BuildGuide_RevA.md |
| P288 | add | Troubleshooting: no gags, but the log shows events | Body: check the microSD format, the folder names and the file numbering. | BaggageClaims_BuildGuide_RevA.md |
| P289 | add | Troubleshooting: gags at random | Body: cause: the 1 k ohm resistor on the DFPlayer RX line is missing (step 12c). | BaggageClaims_BuildGuide_RevA.md |
| P290 | add | Troubleshooting: weigh-in never fires | Body: cause: U2 is mounted on foam or is loose. Fix: remount it rigidly (step 11). | BaggageClaims_BuildGuide_RevA.md |
| P291 | add | Troubleshooting: high sleep current | Body: cause: the DFPlayer BUSY line is floating. Fix: check step 12e, and that the DFPlayer is idle. | BaggageClaims_BuildGuide_RevA.md |

### Acceptance tests (`prototype/tests`): 5 existing, 20 proposed

Existing: Drop; Weigh-in; Carry; Idle; Sleep current.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P292 | enrich | Idle | Add to the pass text: for a quick run, temporarily set DARK_IDLE_MS = 120000 (two minutes). The design package calls it a "2h ... | BaggageClaims_BuildGuide_RevA.md |
| P293 | enrich | Sleep current | Add: the design package attaches a "one week shelf-life check" to this test. If the reading is high, check the BUSY pin wiring ... | BaggageClaims_DesignPackage_RevA.pdf |
| P294 | add | Power rail voltage | pass: "With three AA cells in and the switch on, VIN to GND reads 4.5-4.9 V; switch open reads 0 V. Stop if outside 4.2-5.2 V." ... | BaggageClaims_BuildGuide_RevA.md |
| P295 | add | No shorts on the rails | pass: "VIN to GND and 3V3 to GND both read open; continuity on every net matches schematic.png." Status: not run. | BaggageClaims_BuildGuide_RevA.md |
| P296 | add | 3.3 V rail | pass: "With modules seated and the switch on, the 3V3 rail reads 3.28-3.35 V." Status: not run. | BaggageClaims_BuildGuide_RevA.md |
| P297 | add | First power-on: no heat | pass: "MPU-6050 power LED lit; no hot spots by touch after 30 s." Status: not run. | BaggageClaims_BuildGuide_RevA.md |
| P298 | add | Boot log | pass: "Serial at 115200 shows 'CAL OK g=(0.00,0.00,1.00)' within 0.05, then 'DF OK'." Status: not run. | BaggageClaims_BuildGuide_RevA.md |
| P299 | add | Events appear in the log | pass: "Waving the board prints 'EVT:' lines with the event class as thresholds fire." Status: not run. | BaggageClaims_BuildGuide_RevA.md |
| P300 | add | Hinge and latch | pass: "After the hinge is broken free and exercised 20 times, the snap latch clicks shut and releases by pinching the front ... | BaggageClaims_BuildGuide_RevA.md |
| P301 | add | Strap fit | pass: "Both 25 mm straps pass through the strap slots before any wiring is done." Status: not run. | BaggageClaims_DesignPackage_RevA.pdf |
| P302 | add | Calibration drops at three heights | pass: not stated; the documents give the procedure only: in a duffel bag, drop onto carpet from 0.3, 0.6 and 1.0 m and log the ... | Generate the Arduino sketch for the classification.md |
| P303 | add | Free-fall | pass (derived from the rule, not written as a test): "A fall of at least 0.28 s followed by an impact plays the Wilhelm scream, ... | BaggageClaims_DesignPackage_RevA.pdf |
| P304 | add | Carousel | pass (derived, not written as a test): "On a turntable or carousel turning once every 3-12 s, the carousel gag plays." The sketch ... | Generate the Arduino sketch for the classification.md |
| P305 | add | Conveyor | pass (derived, not written as a test): "Steady rumble for more than 8 s with no rotation plays the conveyor gag." Status: not run. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P306 | add | Inverted | pass (derived, not written as a test): "Held upside down for more than 4 s, the inverted gag plays." Status: not run. | BaggageClaims_DesignPackage_RevA.pdf |
| P307 | add | Governor | pass (derived, not written as a test): "The same event class does not replay within one journey phase; no gag starts within 3 s ... | Generate the Arduino sketch for the classification.md |
| P308 | add | Controls | pass (derived, not written as a test): "A tap steps the volume 15, 23, 30 and the log shows 'BTN: vol='; a hold over 1.5 s steps ... | Generate the Arduino sketch for the classification.md |
| P309 | add | Loudness | pass (derived from the limit): "No more than 85 dBA at 1 m at full volume." No method or meter is named. Status: not run. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P310 | add | Shock survival and drop tests (Rev B exit) | pass (derived): "Unit survives shocks to 40 g and works to 14 g." The roadmap's Rev B exit says "drop tests pass" without heights ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P311 | add | Idle false positives | pass (from the product metric): "Fewer than one gag a day while the unit sits idle." Duration and setting are not given. Status: ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |

### Builds (`prototype/builds`): 0 existing, 6 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P312 | add | Rev A - dev-module prototype | Body (the goal): dev-module prototype and this document set; "now". criteria: [{"text": "Bench acceptance tests pass", "met": ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P313 | add | Validation batch - 5 units | Body: five units of the Rev A build for the filmed airport test, about \$750 (\$500 parts, \$200 tooling), with one weekend of ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P314 | add | Rev A1 - tuned and voiced | Body: threshold tuning on real flights; 128-clip voice-over with a contracted voice actor; weeks 2-4. criteria: [{"text": "False ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P315 | add | Rev B - custom PCB | Body: custom PCB consolidation; ext1 deep-sleep wake; battery ADC; SPI flash audio; months 2-3. criteria: [{"text": "100-unit EV ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P316 | add | Rev C - 1,000-unit Kickstarter fulfillment run | Body: 1,000-unit Kickstarter fulfillment run; soft tooling; months 4-6. criteria: [{"text": "45% blended margin", "met": false}, ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P317 | add | Rev D - retail display model | Body: retail display model; voice-pack SD DLC; licensing talks; month 9 onward. criteria: [{"text": "Wholesale PO or licensing ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |

## Production (50 rows proposed)

### Unit economics (`production/economics`): 5 existing, 16 proposed

Existing: Prototype; Engineering validation batch; Production run; Retail run; Voice pack (DLC).

| id | action | title | gist | source file |
|---|---|---|---|---|
| P318 | add | Electronics (PCB + PCBA + parts) | kind: other-unit. amount by volume: 1 unit \$34.30; 100 units \$22.00; 1,000 units \$8.50; 10,000 units \$4.80. Status: estimate. ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P319 | add | Speaker + storage | kind: other-unit. amount by volume: 1 unit \$3.75; 100 units \$3.20; 1,000 units \$1.40 (SPI flash); 10,000 units \$1.10. Status: ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P320 | add | Battery holder, switches, hardware | kind: other-unit. amount by volume: 1 unit \$7.05; 100 units \$4.50; 1,000 units \$2.10; 10,000 units \$1.40. Status: estimate. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P321 | add | Enclosure | kind: print-material at 1 and 100 units, other-unit above. amount by volume: 1 unit \$5.00 (FDM); 100 units \$4.00 (print farm); ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P322 | add | Strap + packaging + booklet | kind: packaging. amount by volume: 1 unit \$8.70; 100 units \$5.50; 1,000 units \$2.80; 10,000 units \$2.10. Status: estimate. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P323 | add | Assembly & test labor | kind: labour. amount by volume: 1 unit "(DIY)", no figure; 100 units \$4.00; 1,000 units \$1.60; 10,000 units \$0.90. Status: ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P324 | enrich | Prototype | Add the driver from the chat summary: "Dev modules at retail - Micro Center same-day + Amazon" (long dash in the source). Note ... | Create a PRD for this with arch instructions bom a.md |
| P325 | enrich | Engineering validation batch | Add the driver: "Hand assembly, printed enclosures". The chat summary rounds the figure to about \$43. | Create a PRD for this with arch instructions bom a.md |
| P326 | enrich | Production run | Add the driver: custom PCB consolidation, consistent with published turnkey PCBA rates of roughly \$18-22 a board. Add the PRD's ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P327 | enrich | Retail run | Add the driver: "Injection-molded enclosure, SPI flash instead of microSD, offshore assembly". Add: the PRD's whole pricing ... | Create a PRD for this with arch instructions bom a.md |
| P328 | add | Margin targets | Body: target blended margin 45% at launch, "expanding past 55% on repeat batches as COGS compresses and DLC voice packs ... ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P329 | add | Validation batch tooling | kind: tooling. amount: 200. Body: the ask is about \$750: \$500 parts and \$200 tooling for the 5-unit batch. What the tooling is, ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P330 | add | 3D printer | kind: tooling. amount: 259.99 (Bambu Lab A1) or 299.99 (A1 mini Combo with AMS lite); AMS Lite upgrade +100. Body: not in the ... | Can I do a 3d printer for this integrated - if so.md |
| P331 | add | Printed enclosure, filament | kind: print-material. grams: 100 (two halves plus mid-plate) or 62 (clamshell); pricePerKg: 20. Body: about \$2 a unit in PETG; ... | Can I do a 3d printer for this integrated - if so.md |
| P332 | enrich | Voice pack (DLC) | Add: also sold as a Kickstarter add-on at checkout and in the cart on the product page; stretch-goal packs cost "\$0.50/unit to ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P333 | add | Kickstarter preparation | kind: other (a one-off, not per unit). amount: 2,000 to 3,000. Body: "Kickstarter prep (\$2-3k)", spent only after the Phase 1 ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |

### Batch plan (`production/batches`): 3 existing, 6 proposed

Existing: A - Validation; B - Creator seeding units; C - First production run.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P334 | enrich | A - Validation | Add: build "Rev A". Purpose: firmware tuning over one weekend and the filmed airport test in weeks 1-3. Cost about \$750. ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P335 | enrich | B - Creator seeding units | Add: the playbook calls them 20 "evaluation units", about \$1.3k COGS; shipped to mid-size travel comedians so that all 20 post ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P336 | add | EV batch - 100 units | units: 100. build: "Rev B". Body: hand assembly and printed enclosures (print farm, or 4-6 shells per plate overnight on the A1); ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P337 | enrich | C - First production run | Add: build "Rev C"; months 4-6; soft tooling; landed about \$19.00 a unit; it is the Kickstarter fulfillment run. Exit: 45% ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P338 | add | Retail run - 10,000 units | units: 10000. Body: injection-molded enclosure (mold amortized), SPI flash instead of microSD, offshore assembly; landed \$11.15 a ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P339 | add | Units promised by caps and stunts | Body: allocations the playbook fixes ahead of any batch: 300 early-bird units at \$19; 100 collector units at \$49 (signed, Gold ... | BaggageClaims_Marketing_Playbook_RevA.txt |

### Suppliers (`production/suppliers`): 0 existing, 6 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P340 | add | Micro Center | code: microcenter. supplies: "U1 dev board (SKU 699323), AA cells, slide switch, tactile button, resistors, 16 GB microSD, wire ... | Build me the low level design , inter interface co.md |
| P341 | add | Amazon | code: amazon. supplies: "U2 motion sensor, U3 DFPlayer Mini, SPK1 speakers (4-pack), BT1 battery holder, HW1 M2 standoff kit, ... | Build me the low level design , inter interface co.md |
| P342 | add | Turnkey PCB assembly house (not chosen) | code: pcba. supplies: "Custom PCB and assembly from Rev B: ESP32-S3-WROOM module, MPU-6050, YX5200-class codec". Body: no vendor ... | Create a PRD for this with arch instructions bom a.md |
| P343 | add | Voice actor (not chosen) | code: vo. supplies: "128-clip voice-over per pack; Hotline fragment library (3 intros, 12 locations, 15 insults, 5 outros per ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P344 | add | Enclosure tooling: print farm, soft tooling, injection molder (not chosen) | code: enclosure. supplies: "Enclosures at 100 (print farm), 1,000 (soft tooling) and 10,000 units (injection mold)". Body: named ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P345 | add | Fulfilment partner (3PL, not chosen) | code: 3pl. supplies: "Pick, pack and ship of Kickstarter and store orders". Body: the web blueprint exports batch fulfilment as a ... | BaggageClaims_Web_Blueprint_RevA.md |

### Manufacturing methods (`production/methods`): 0 existing, 8 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P346 | add | Enclosure, prototype: FDM print | method: fdm. appliesTo: ENC1. unitCost: 5.00. toolingCost: not stated. Body: PETG, 0.2 mm, 25% infill, 4 perimeters. Status: ... | BaggageClaims_DesignPackage_RevA.pdf |
| P347 | add | Enclosure, 100 units: print farm | method: fdm. appliesTo: ENC1. unitCost: 4.00. Body: "print farm" in the cost table; the 3D printing note would instead print them ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P348 | add | Enclosure, 1,000 units: soft tooling | method: other (soft tooling). appliesTo: ENC1. unitCost: 2.60. toolingCost: not stated. Status: estimate. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P349 | add | Enclosure, 10,000 units: injection molding | method: injection. appliesTo: ENC1. unitCost: 0.85 ("mold amortized"). toolingCost: not stated. Status: estimate. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P350 | add | Electronics, prototype: hand-wired perfboard with socketed modules | method: hand-assembled. appliesTo: PCB1. Body: three dev modules on female headers on a 5 x 7 cm perfboard, wired by hand per the ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P351 | add | Electronics, from Rev B: custom PCB, turnkey assembly | method: bought-in. appliesTo: PCB1 (and U1, U2, U3, which it replaces). Body: consolidated custom PCB with turnkey PCBA; about ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P352 | add | Assembly and test: hand assembly | method: hand-assembled. appliesTo: the assembly phases. unitCost: 4.00 at 100 units, 1.60 at 1,000, 0.90 at 10,000. Status: ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P353 | add | Voice pack: microSD duplication | method: bought-in. appliesTo: SD1. unitCost: 0.50. Body: "pure-margin microSD content, \$0.50 BOM, \$7.99 retail"; digital delivery ... | BaggageClaims_Website_Platform_Plan_RevA.txt |

### Compliance (`production/compliance`): 0 existing, 14 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P354 | add | Batteries in checked baggage (FAA PackSafe) | why: "Lithium devices in checked bags must be fully off in the hold; the design uses three AA alkaline cells so that rule does ... | Build me the low level design , inter interface co.md |
| P355 | add | Compliance card wording | why: "Every unit carries a card telling the owner to switch it off before checking the bag." check: "Decide the final wording; ... | BaggageClaims_BuildGuide_RevA.md |
| P356 | add | UN38.3 battery transport testing | why: "The PRD says alkaline cells need no UN38.3 testing." check: "Confirm that shipping units with or without AA cells in the ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P357 | add | FCC Part 15, unintentional radiator | why: "Radios are disabled, so the documents treat the device as an unintentional radiator, self-declared; the ESP32-S3 module is ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P358 | add | Loudness | why: "The design caps output at 85 dBA at 1 m." check: "Measure it; check whether airports or airlines restrict devices that make ... | BaggageClaims_DesignPackage_RevA.pdf |
| P359 | add | Voice rights and releases | why: "All voices are contracted original talent with releases; no celebrity impressions. Contest winners' stories are recorded as ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P360 | add | Filming at an airport | why: "The launch video films a real baggage handler, a check-in agent and a carousel." check: "Written consent from the handler ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P361 | add | Trademark and design patent | why: "Named as a moat: trademark plus a design patent on the form factor." check: "Run the USPTO search and a domain check on ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P362 | add | Kickstarter prototype disclosure | why: "The video's end card carries 'Prototype shown.'" check: "Check Kickstarter's current rules for hardware campaigns." Status: ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P363 | add | Privacy: GDPR and CCPA | why: "The site collects emails, referral data and Hotline submissions; the plan sets strict GDPR defaults for an NL/EU audience." ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P364 | add | Minors and user submissions | why: "Hotline and contest submissions are published after moderation." check: "Age attestation; minors' content auto-rejected; ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P365 | add | Website accessibility | why: "The plan sets WCAG 2.2 AA on core flows (contrast, keyboard, alt text)." check: "Audit the split-flap board, the Hotline ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P366 | add | Recall and safety contact | why: "The registration database is meant to support warranty, voice pack entitlement and recall or safety messages." check: ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P367 | add | Product safety and labelling for a battery-powered novelty | why: "The product is described as a toy-like gag gift sold through Amazon, airport retail and wholesale; no document mentions ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |

## Marketing (93 rows proposed)

### Personas (`marketing/personas`): 0 existing, 5 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P368 | add | P1 - Frequent leisure flyer, 25-45 | who: "Frequent leisure flyers aged 25-45; the core gifting demographic." job: "Express personality; prank travel companions; ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P369 | add | P2 - Gag-gift buyer | who: "Buys for Secret Santa, Father's Day and Q4 gifting." job: "A \$20-30 stocking-stuffer with an explanation-free 90-second ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P370 | add | P3 - Travel content creator | who: "Mid-size travel comedians, 50k-500k followers; high leverage, low price sensitivity." job: "A prop that generates clips; an ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P371 | add | P4 - Airport gift shop and novelty retail buyer | who: "Paradies/Hudson-style airport retail and novelty stores." job: "A high-margin impulse checkout SKU; a gag shelf that does ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P372 | add | The audience that never pays: handlers and bystanders | who: "Baggage handlers, check-in agents and people at the carousel." job: none; they are the audience. trigger: "The bag talks ... | BaggageClaims_LaunchVideo_Script_RevA.txt |

### Competitors (`marketing/competitors`): 0 existing, 4 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P373 | add | Novelty sound gadgets on Etsy and eBay | kind: alternative. what: "Similar novelty sound gadgets" found on Etsy's prank and novelty gifts pages and an eBay search. ... | I have an idea for a quick gag and potential quick.md |
| P374 | add | A Bluetooth speaker | kind: alternative. what: the product the PRD measures itself against: "the Bluetooth speaker's funnier, cheaper cousin". ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P375 | add | Another candle (any \$20-30 gift) | kind: alternative. what: the default gift the gag-gift buyer would otherwise choose. priceText: "\$20-30". basis: typed. Status: ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P376 | add | Doing nothing; imitators after launch | kind: alternative. what: the PRD expects imitators (risk, Medium) and answers with speed, brand, voice talent, a design patent, a ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |

### Positioning (`marketing/positioning`): 2 existing, 5 proposed

Existing: Positioning; Voice rules.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P377 | enrich | Positioning | Fill the statement fields from the documents' own lines. kind: statement. forWhom: "frequent leisure flyers and gag-gift buyers". ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P378 | add | Four messages from the launch video | messages: (1) "8 REAL TRAVEL MOMENTS - detected, not scripted"; (2) "3 VOICE PACKS - Family / Salty / New Yorker"; (3) "AA POWER ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P379 | add | The video is the business plan | Body: the product's demonstration is its marketing. "This video is the business plan" (first proposal); "our entire marketing ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P380 | add | Two markets: checked bag and carry-on | Body: sell it both as a checked-bag comedy device and as a carry-on strap-on ("fully legal everywhere"); the PRD's risk table ... | I have an idea for a quick gag and potential quick.md |
| P381 | enrich | Voice rules | Add the production rules from the script: the hero voice is the final contracted talent, not scratch; "never fake the AUDIO"; ... | BaggageClaims_LaunchVideo_Script_RevA.txt |

### Pricing (`marketing/pricing`): 0 existing, 11 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P382 | add | Kickstarter early bird "Checked" - \$19 | kind: price. priceMinor: 1900. currency: USD. approach: own. note: "300 cap. Net \$17.20 after about 8-10% fees; 35% gross margin ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P383 | add | Kickstarter standard "Carry-On" - \$24 | kind: price. priceMinor: 2400. currency: USD. approach: own. note: "Net \$21.70; 49% gross margin at \$11.15." Status: draft. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P384 | add | Two-pack "Overhead Bin" - \$34 | kind: price. priceMinor: 3400. currency: USD. approach: own. note: "Two units, \$17 each. No margin is worked in the documents." ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P385 | add | Collector "First Class" - \$49 | kind: price. priceMinor: 4900. currency: USD. approach: value. note: "Signed, Gold Voice pack, 100 cap. Exists to capture the 10% ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P386 | add | Four-pack "The Whole Cargo Hold" - \$99 | kind: price. priceMinor: 9900. currency: USD. approach: own. note: "Four units, \$24.75 each; 'the groomsmen/secret-santa bundle; ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P387 | add | Desk-only "Gate Agent Special" - \$18 | kind: price. priceMinor: 1800. currency: USD. approach: own. note: "Secret Kickstarter reward from the Complaint Desk ticket QR; ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P388 | add | Own store and TikTok Shop - \$24.95 | kind: price. priceMinor: 2495. currency: USD. approach: own. note: "Net \$21.95 after about 12% blended; 49% at \$11.15. Shown on ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P389 | add | Amazon FBA - \$27.95 | kind: price. priceMinor: 2795. currency: USD. approach: own. note: "Net \$19.55 after about 30% all-in; 43% at \$11.15." Status: ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P390 | add | Wholesale - \$14.50, MSRP \$29.95 | kind: price. priceMinor: 1450. currency: USD. approach: own. note: "The buyer sets a \$29.95 MSRP, a 2x markup; 23% gross margin ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P391 | add | Voice pack - \$7.99 | kind: price. priceMinor: 799. currency: USD. approach: value. note: "microSD, about \$0.50 to make; add-on at checkout; quarterly ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P392 | add | Pricing assumptions | kind: assumptions. targetMarginPercent: 45. note: "Target blended margin 45% at launch, past 55% on repeat batches. One-liner ... | I have an idea for a quick gag and potential quick.md |

### Brand kit (`marketing/brand`): 0 existing, 4 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P393 | add | Brand kit: voice | kind: kit. voiceSummary: "The BAG speaks first person, never the company. Deadpan host, chaotic bag. Every asset ends with ONE ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P394 | add | Brand kit: the cast | Body: HOST: traveler, 30s, deadpan. BAG: voice-over, sassy, high comic energy; delighted on the carousel, sleepy in the hold. ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P395 | add | Brand kit: visual language (airport infrastructure) | Body: every page masquerades as a piece of airport infrastructure: a split-flap departure board; a check-in kiosk button; a CRT ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P396 | add | Brand kit: text on the product | Body: luggage tag and shell text "FRAGILE - and emotionally unstable" (long dash in the source); with the AMS Lite the logo and ... | Can I do a 3d printer for this integrated - if so.md |

### Imagery (`marketing/imagery`): 0 existing, 15 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P397 | add | Cold open: bag hits the belt | shotKey: cold-open. purpose: "0:00-0:08. Black, sound of a suitcase hitting a conveyor; tight on the suitcase being thrown onto a ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P398 | add | Device close-up and inserts | shotKey: device-inserts. purpose: "0:09-0:18. Host packing at home, device on the handle in close-up; quick inserts of the strap ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P399 | add | Device on a turntable | shotKey: turntable. purpose: "0:31. Device rotating on a turntable under the title 'MEET: BAGGAGE CLAIMS MK1'." usedIn: launch ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P400 | add | Curb: handle grab | shotKey: curb. purpose: "0:36. Host grabs the handle; the bag's dinner line; a bystander snorts. Super: HANDLE_GRAB." usedIn: ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P401 | add | Check-in scale | shotKey: scale. purpose: "0:45. Agent lifts the bag onto the scale; stillness; the display reads 62 lbs; the FAT line; agent: ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P402 | add | Handler toss | shotKey: toss. purpose: "0:58. Wide, filmed at a distance: the bag arcs from cart to belt; mid-air freeze with the scream; thud; ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P403 | add | Dark hold | shotKey: hold. purpose: "1:10. Bag on a black luggage cart, slow push-in, nothing moves; the sleepy line, then snoring. Super: ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P404 | add | Carousel | shotKey: carousel. purpose: "1:20. Wide on the carousel; the bag rounds the bend with the device visible; the Wheeee line; the ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P405 | add | Living room payoff and feature montage | shotKey: payoff. purpose: "1:36-2:06. Host with the suitcase open on the floor, device in hand; fast feature montage with four ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P406 | add | Hero suitcase with the oversized tag | shotKey: hero-prop. purpose: "The hero suitcase with the device visible and an oversized tag reading 'FRAGILE - and emotionally ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P407 | add | Safety card, six frames | shotKey: safety-card. purpose: "Six airline safety-card frames from strap-on to carousel gag; no paragraphs; ends in a call to ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P408 | add | Claim ticket image | shotKey: claim-ticket. purpose: "A faux legal document with a claim number: 'Claimant alleges being called FAT at Terminal C...'. ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P409 | add | Shame Ads statics | shotKey: shame-ad. purpose: "A static image for each five-star complaint review, with one gag audio, autoplay off; reviews also ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P410 | add | Press kit | shotKey: press-kit. purpose: "Logos, the hero video and a founder photo." usedIn: /press. Status: draft. | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P411 | add | Exploded 3D view and schematic | shotKey: exploded-view. purpose: "The 3D exploded view of the product named in the PRD, the design package and the build guide ... | BaggageClaims_DesignPackage_RevA.pdf |

### Landing page (`marketing/landing`): 9 existing, 12 proposed

Existing: Gate (home); Safety Card; Moments; Lost Baggage Hotline; Departure Board; Product; Platinum Status; Complaint Department; Wholesale.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P412 | enrich | Gate (home) | Add to body: the split-flap board cycles "AUS -> FAT JOKES - ON TIME", "DFW -> YOUR BAG - DELAYED (AGAIN)", "BAG -> COMPLAINTS - ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P413 | enrich | Moments | Add to body: the eight vignettes are scroll-driven (Framer Motion in Blueprint Rev A); a 3-panel strip of them also sits on the ... | BaggageClaims_Web_Blueprint_RevA.md |
| P414 | enrich | Lost Baggage Hotline | Add to body the three steps and the output: Step 1 "Where did your bag suffer?" (visual airport map picker); Step 2 "What did ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P415 | enrich | Departure Board | Add to body the mechanics: 1 signup = "BOARDING GROUP D"; 3 referrals = a free voice pack at launch ("upgrade to Group B"); 10 ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P416 | enrich | Product | Add to body: price shown as a scale readout ("\$24.95 - UNDER THE LIMIT", long dash in the source); bundle builder for 1, 2 or 4 ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P417 | enrich | Platinum Status | Add to body: the QR is on the in-box frequent-flyer card; the buyer enters the unit serial printed on the compliance card; ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P418 | enrich | Wholesale | Add to body: line sheet download behind a form; the counter-display programme (a big red button that plays one random gag); the ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P419 | add | Voice-pack store | page/path: /packs. kind: price. CTA: "Buy a pack". Body: the DLC store: packs at \$7.99 with instant delivery or a physical ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P420 | add | Stories wall | page/path: /stories. kind: proof. Body: a wall of approved Hotline tickets, contest entries and handler reactions; fed by the ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P421 | add | Press | page/path: /press. kind: footer. Body: press kit with logos, the hero video and a founder photo. Status: planned. | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P422 | add | Legal pages | page/path: /legal/*. kind: footer. Body: privacy, terms, the compliance card and the voice release; the safety page hosts the FAA ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P423 | add | Kickstarter bridge page | page/path: not stated. kind: hero. Body: a bridge page for the launch month that sends visitors to the campaign, then migrates to ... | BaggageClaims_Website_Platform_Plan_RevA.txt |

### Ads (`marketing/ads`): 3 existing, 2 proposed

Existing: My bag embarrassed me in front of the entire carousel. Five stars.; TSA agent laughed so hard she forgot to swab my laptop. Five stars.; Ruined my marriage. She took his side. The bag's side. Five stars..

| id | action | title | gist | source file |
|---|---|---|---|---|
| P424 | enrich | The three Shame Ads: stop rule as numbers | On each of the three rows set: channel "Retargeting to video viewers who did not convert"; stopRule "\$500 test, kill if CAC > ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P425 | add | Amplified unbranded clip (whichever passes 50k views in 72 h) | channel: "the platform where the clip broke out (70%) and the others (30%)". stopRule: "Spend the \$2k amplification only on a ... | BaggageClaims_Marketing_Playbook_RevA.txt |

### Campaigns (`marketing/campaigns`): 10 existing, 13 proposed

Existing: 1 · The Four Gates; 2 · @TheBagComplains; 3 · 100 Bags, 100 Reactions; 4 · The Lost Baggage Hotline; 5 · The Departure Board; 6 · The Complaint Desk; 7 · Kickstarter page; 8 · The Shame Ads; 9 · Platinum Status; 10 · Wholesale Trojan.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P426 | add | Marketing plan and budget | kind: plan. planTotalMinor: 450000 (the playbook's "~\$4,500, before any Kickstarter revenue"). Budget lines: Phase 1 attention ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P427 | add | Kill and scale criteria (whole plan) | Body: KILL: the Four Gates clips under 50k views and under 500 emails in 30 days: stop, pivot the creative, do NOT fund ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P428 | enrich | 1 - The Four Gates | objective: awareness. channel: "TikTok, Reels, Shorts". budgetTotalMinor: 0 to 50000. target: 50k views on any clip in 72 h (the ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P429 | enrich | 2 - @TheBagComplains | objective: awareness. channel: "TikTok, X, Instagram". budgetTotalMinor: 0. Add to body: replies in character to airline meltdown ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P430 | enrich | 3 - 100 Bags, 100 Reactions | objective: awareness. budgetTotalMinor: 130000. Add to body: creators with 50k-500k followers, not mega-influencers; deal: free ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P431 | enrich | 4 - The Lost Baggage Hotline | objective: consideration. channel: "BaggageClaims.com or SassCase.com". budgetTotalMinor: 50000 (shared with campaign 5 and ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P432 | enrich | 5 - The Departure Board | objective: consideration. target: 3,000 emails before the Kickstarter launch. Add to body the four boarding groups and the ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P433 | enrich | 6 - The Complaint Desk | objective: conversion. channel: "Live stunt, Austin". budgetTotalMinor: 30000 (banner, tickets, blazer). target: 500 QR scans; 2 ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P434 | enrich | 7 - Kickstarter page | objective: conversion. channel: "Kickstarter". budgetTotalMinor: 100000 (prop and photo). target: 2,000 backers; ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P435 | enrich | 8 - The Shame Ads | objective: conversion. budgetTotalMinor: 50000. target: {metric: cost_per_order, value: 1000 minor}. rule: {stopAboveMinor: 1000, ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P436 | enrich | 9 - Platinum Status | objective: retention. target: 20% of buyers attach at least one voice pack in 12 months. Add to body: every unit ships with a QR ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P437 | enrich | 10 - Wholesale Trojan | objective: conversion. channel: "Airport gift retail". Add to body: post-campaign; the big red button plays one random gag; "It ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P438 | add | PRD Phase 3 - Always-on | objective: conversion. Body: after the campaign: TikTok Shop and Shopify DTC; an Amazon listing tuned to gag travel gift ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |

### Launch plan (`marketing/launch`): 0 existing, 7 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P439 | add | Launch: unbranded clips (Phase 1 gate) | kind: launch. launchKey: phase1. channel: "TikTok, Reels, Shorts". launchDate: not stated (weeks 1-3). Steps, each kind step with ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P440 | add | Launch: Kickstarter | kind: launch. launchKey: kickstarter. channel: "Kickstarter". launchDate: not stated (weeks 4-12, 30-45 days). Steps: (a) pass ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P441 | add | Web phase W0 (week 1, about \$100) | kind: step. phase: "W0". how: "Register the domain; start the Shopify trial (\$1 a month for three months); build the Gate page on ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P442 | add | Web phase W1 (weeks 2-3, about \$50 a month) | kind: step. phase: "W1". how: "Build the Hotline and Board micro-apps (Next.js and Supabase); Viral Loops Start-up at \$49 a ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P443 | add | Web phase KS (launch month) | kind: step. phase: "KS". how: "Bridge page; backer import runbook; press kit; compliance and safety pages. Cancel the referral ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P444 | add | Web phase DTC (after fulfilment, about \$140 a month) | kind: step. phase: "DTC". how: "Full /product page and bundles; Judge.me reviews; Platinum Status and the voice-pack store; ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P445 | add | Web phase SCALE | kind: step. phase: "SCALE". how: "Move up Klaviyo tiers as the list grows; affiliate software only above \$20k a month; Supabase ... | BaggageClaims_Website_Platform_Plan_RevA.txt |

### Tracked links (`marketing/links`): 0 existing, 1 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P446 | add | Links and QR codes the plans call for | Body: (1) Shame-ad click to /product with UTM tags; (2) the Complaint Desk ticket QR to the secret \$18 Kickstarter reward; (3) ... | BaggageClaims_Web_Blueprint_RevA.md |

### Social (also Posting) (`marketing/social`): 4 existing, 7 proposed

Existing: POV: your suitcase gets body-shamed at check-in; the suitcase screamed and the baggage handler LOST IT; my luggage after 4 hours in the cargo hold; why is this bag having more fun than me.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P447 | enrich | POV: your suitcase gets body-shamed at check-in | Add to body: V1 "FAT", cut from 0:36-0:51 of the hero video (curb grab and weigh-in). Posting rule for all four: raw, no logo, no ... | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P448 | enrich | the suitcase screamed and the baggage handler LOST IT | Add to body: V2 "OW", 0:58-1:09: handler toss, Wilhelm scream, thud, "OW! Ow. Ow. Owww." The script chat calls it "the likeliest ... | Write the script for the launch video.md |
| P449 | enrich | my luggage after 4 hours in the cargo hold | Add to body: V3 "DARK", 1:10-1:18: the dark-hold beat. The cut is 8 seconds, not 15. | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P450 | enrich | why is this bag having more fun than me | Add to body: V4 "WHEE", 1:20-1:34: the carousel beat and the stranger's reaction. | BaggageClaims_LaunchVideo_Script_RevA.txt |
| P451 | add | crew rested me on the WET tarmac?? sir I am luggage | channel: "TikTok / X / Instagram (@TheBagComplains)". Body: the playbook's example of an in-character reply to a viral airline ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P452 | add | comment FAT for where to get one | channel: "TikTok / Reels / Shorts". Body: the pinned reply under each unbranded clip; a comment with the keyword triggers the ... | Develop clever marketing campaigns for this hilari.md |
| P453 | add | Recurring posts the plans call for (no copy written) | Body: "Complaint of the Week" from the Hotline (the worker pushes drafts to the social tool in Rev B); seasonal voice pack drops ... | BaggageClaims_Web_Blueprint_RevB.md |

### Launch email and press note (`marketing/announce`): 0 existing, 7 proposed

Existing: none.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P454 | add | Welcome sequence (three emails, in character) | kind: sequence. step: 1 to 3. goal: "Welcome a new signup in the bag's voice; the first email carries the sign-in link and the ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P455 | add | Hotline reveal email | kind: email. subjects: ["Your bag filed its complaint"]. goal: "Send the claim ticket and the audio after a Hotline submission." ... | Walk through the Hotline TTS audio worker flow.md |
| P456 | add | Post-purchase sequence | kind: sequence. step 1: sendOffsetDays 10, goal "Register the unit". step 2: sendOffsetDays 30, goal "Ask for a review". step 3: ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P457 | add | Launch-day email to the list | kind: email. goal: "Convert 1-3% of the list on day one; the playbook's sum is 3,000 x 2% x \$24, about \$1.4k." subjects, ... | Develop clever marketing campaigns for this hilari.md |
| P458 | add | Wholesale follow-up sequence | kind: sequence. step: 1 to 3, then a sample offer. goal: "Turn a line-sheet request into a first order." Pitch line available: ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P459 | add | Press note | kind: press-note. goal: "Local and travel press at launch and at the Complaint Desk." Angles on file: "the world's sassiest ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P460 | add | Email lists | Body: seven lists: gate_signup, hotline_user, backer, buyer, registered, dlc_buyer, wholesale_lead. Not a launch piece; recorded ... | BaggageClaims_Website_Platform_Plan_RevA.txt |

## Sales (10 rows proposed)

### Amazon listing (`sales/listing`): 1 existing, 1 proposed

Existing: Amazon listing not started.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P461 | enrich | Amazon listing not started | Raw material the documents do hold, for whoever writes the listing: the one-liner; the eight moments and their lines; "Three ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |

### Channels and pricing (`sales/channels`): 5 existing, 9 proposed

Existing: Amazon FBA; Kickstarter early bird; Kickstarter standard; DTC site / TikTok Shop; Wholesale (airport / gift retail).

| id | action | title | gist | source file |
|---|---|---|---|---|
| P462 | replace | Amazon FBA | price: 27.95. platformPercent: 30 ("~30% all-in"; the split between referral fee, FBA fee and storage is not given, so ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P463 | replace | Kickstarter early bird | price: 19. platformPercent: 8 to 10 as one figure ("~8-10% fees", platform and payment together). Net \$17.20; margin 35% at ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P464 | replace | Kickstarter standard | price: 24. platformPercent: 8 to 10 as one figure. Net \$21.70; margin 49% at \$11.15. Status: planned. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P465 | replace | DTC site / TikTok Shop | price: 24.95. platformPercent: 12 ("~12% blended"). Net \$21.95; margin 49% at \$11.15. For the own site on Shopify the plan gives ... | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P466 | replace | Wholesale (airport / gift retail) | price: 14.50. platformPercent: 0. Net \$14.50; margin 23% at \$11.15; the buyer sets a \$29.95 MSRP. Status: planned. | BaggageClaims_PRD_Business_Proposal_RevA.pdf |
| P467 | add | Kickstarter bundles and collector tier | Three more Kickstarter prices with no worked margin: two-pack \$34, collector \$49 (100 cap), four-pack \$99; desk-only \$18 (200 ... | BaggageClaims_Marketing_Playbook_RevA.txt |
| P468 | add | Voice packs (add-on and store) | price: 7.99. Body: sold at Kickstarter checkout, in the cart on the product page and in the /packs store; digital or on microSD. ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P469 | add | Creator affiliate codes | adCost: 10% of the sale as a payout to the creator (PRD: 10-20% revenue share). Applies on top of the channel's own fees wherever ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P470 | add | Licensing to luggage brands | Body: license the trigger-pattern engine or co-brand with a luggage maker; "the scale-or-exit option". Rev D exit: "Wholesale PO ... | I have an idea for a quick gag and potential quick.md |

## Unmapped (web platform) (21 rows proposed)

### Web platform engineering (no section in the app): 21 proposed

The website plan, the two blueprints, the schema, the compose file and the Hotline worker note describe a website and its back office. The app's sections describe the product. Pages and campaigns are mapped above (Landing page, Campaigns, Launch plan, Compliance); the engineering below has nowhere to go. You decide whether it belongs in this concept at all, in a second concept for the website, or only in Files.

| id | action | title | gist | source file |
|---|---|---|---|---|
| P471 | add | Website Plan Rev A: stack and monthly cost | Shopify Basic as system of record; free Dawn theme with customised Liquid sections; Klaviyo for email and SMS; Viral Loops for ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P472 | add | Website Plan Rev A: back-office modules | Orders (Shopify admin; Kickstarter pledge import by CSV, tier to SKU; tags ks_checked, ks_firstclass, gate_agent_special). DLC ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P473 | add | Website Plan Rev A: data model | Eight entities: customer(id, email, source, ks_tier, tags[]); unit(serial, batch, sku, mfg_date); registration(unit_id, ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P474 | add | Website Plan Rev A: automated flows | Kickstarter import: backer CSV, create pre-paid orders, tag by tier, add to the backer list, batch fulfilment by region. Register ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P475 | add | Website Plan Rev A: weekly analytics one-pager | North star before launch: emails a week; after launch: contribution dollars per visitor. Funnel: sessions, home page conversion, ... | BaggageClaims_Website_Platform_Plan_RevA.txt |
| P476 | add | Blueprint Rev A: system shape | One Next.js 15 "modular monolith": one repo, one app, one Docker image with two entry points (web and worker). Postgres is the ... | BaggageClaims_Web_Blueprint_RevA.md |
| P477 | add | Blueprint Rev A: routes and back office | Public: / (Gate), /how-it-works, /moments, /stories, /wholesale, /press, /faq, /hotline (step wizard), /board (server-rendered, ... | BaggageClaims_Web_Blueprint_RevA.md |
| P478 | add | Blueprint Rev A: user flows | 3.1 Gate to referral loop: email, lead with source and UTM, welcome email with magic sign-in, own referral link /r/[refCode], ... | BaggageClaims_Web_Blueprint_RevA.md |
| P479 | add | Blueprint Rev A: API routes and worker queues | Routes: POST /api/stripe (webhook, raw body, signature check, idempotent); POST /api/resend (optional, bounce and unsubscribe ... | BaggageClaims_Web_Blueprint_RevA.md |
| P480 | add | Blueprint Rev A: security and privacy | Magic-link sign-in, JWT sessions with a role claim; /back-office needs moderator or admin; /claim needs sign-in. Rate limits: ... | BaggageClaims_Web_Blueprint_RevA.md |
| P481 | add | Blueprint Rev A: deploy, runbook and service levels | Production on one VPS (4 vCPU, 8 GB) or Fly.io machines; compose profile "prod". CI on GitHub Actions: lint, typecheck, database ... | BaggageClaims_Web_Blueprint_RevA.md |
| P482 | add | Database schema file (Rev A) | Postgres 16, written for Prisma. Five enums: user_role (fan, moderator, admin); order_source (web, kickstarter, gate_desk, ... | db_schema.sql |
| P483 | add | Compose file (Rev A) | Six services on one network: web (Next.js standalone, health check on /api/health), worker (same image, different entry point), ... | docker-compose.yml |
| P484 | add | Blueprint Rev B: version pins and starter | PostgreSQL 18.7 on the pgvector image; pgvector 0.8.7; Next.js 16, React 19, Tailwind v4, TypeScript; Better Auth (self-hosted) ... | BaggageClaims_Web_Blueprint_RevB.md |
| P485 | add | Blueprint Rev B: media in Postgres | A media table with the file bytes, a unique sha256 for integrity and de-duplication, and an 8 MB limit. Ticket audio is about 200 ... | BaggageClaims_Web_Blueprint_RevB.md |
| P486 | add | Blueprint Rev B: three uses of vector search | (1) Moderation: flag near-duplicates of approved gags (1024-dimension embeddings, HNSW cosine). (2) Support: answer from a ... | BaggageClaims_Web_Blueprint_RevB.md |
| P487 | add | Blueprint Rev B: email, social and compose map | Listmonk (self-hosted, own database) runs the email journeys; transactional mail stays on Resend; a listmonk-sync queue mirrors ... | BaggageClaims_Web_Blueprint_RevB.md |
| P488 | add | Blueprint Rev B: migration from Rev A | Delete: the minio service, the S3 SDK and signed-link code, the S3 environment variables. Replace: audio_key and image_key with ... | BaggageClaims_Web_Blueprint_RevB.md |
| P489 | add | Hotline audio worker: the design decision | The worker does not call a live text-to-speech service. It stitches a clip from a fixed library: 3 intros x 12 locations x 15 ... | Walk through the Hotline TTS audio worker flow.md |
| P490 | add | Hotline audio worker: the eight hops | 1. Commit the ticket row, then enqueue after the commit, never inside the transaction. 2. The job id is the claim number, so ... | Walk through the Hotline TTS audio worker flow.md |
| P491 | add | Hotline audio worker: timing, failure and capacity | The ticket image renders on a faster parallel queue, so the page shows the fake legal document at once and the audio player ... | Walk through the Hotline TTS audio worker flow.md |

### Sections with nothing proposed

- Concept, Challenge: an AI reviewer, not a list of rows.
- Research, Ask: saved web research; none has been run, and I ran none.
- Design, 3D model: a viewer over the parts; the model files the documents name are missing.
- Marketing, Campaign results: no campaign has run.
- Marketing, Replies and comments; Replies to send: nothing has been posted.
- Sales, Sales monitor; Reviews and questions: nothing has been sold. The three Shame Ad lines are invented reviews and must not be entered as reviews.

## Conflicts for your decision (55)

Each value is given with the file and place it comes from. None is resolved here. Rows marked medium or low rest partly on my own reading; the CSV note says which part. The conflicts named in the brief (three web stacks; \$15k against 2,000 backers; 90 minutes against 3.5 hours; buffer length and sleep mode; \$64.34 against \$64.80; the name) were each checked against the files and all stand; the other rows are additional.

| id | topic | competing values, with sources | what it affects in the app |
|---|---|---|---|
| P082 | Product name is undecided | 1. "Baggage Claims" is the name on every Rev A document (BaggageClaims_PRD_Business_Proposal_RevA.pdf, title, page 1)<br>2. "Sass Case" ranked first for retail (What clever names for this ?.md, My honest ranking, line 31)<br>3. Domain left open between the two (BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 4, line 46)<br>4. Split: product "Sass Case", product line "Baggage Claims" (What clever names for this ?.md, My honest ranking, line 31) | Every title, tagline, landing page, listing, the video title card, the domain and the printed shell text. |
| P083 | Three different web stacks | 1. Shopify as system of record, with Klaviyo, Viral Loops, Supabase and Vercel (BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 27)<br>2. Custom Next.js 15 monolith: Postgres 16, Redis, S3, Caddy, Stripe, Prisma, Auth.js (BaggageClaims_Web_Blueprint_RevA.md, §1 System shape, line 7)<br>3. Next.js 16, PostgreSQL 18.7 with pgvector, no S3, Drizzle, Better Auth, Listmonk, Postiz (BaggageClaims_Web_Blueprint_RevB.md, title, line 1) | Decision "Which web stack", the landing page rows, monthly running cost, and every web platform row marked unmapped. |
| P084 | Schema and compose files on hand are Rev A, but Rev B cites Rev B files | 1. Rev B lists its artifacts as docker-compose.yml (Rev B) and db_schema.sql (Rev B) (BaggageClaims_Web_Blueprint_RevB.md, header, line 2)<br>2. The schema in the folder says Rev A, Postgres 16 (db_schema.sql, line 1, line 1)<br>3. The compose file in the folder says Rev A and runs postgres:16-alpine with MinIO (docker-compose.yml, line 1, line 1) | Whichever stack is chosen, the files in the folder describe Rev A only; Rev B has no schema or compose file to build from. |
| P085 | Checkout: Shopify Payments or Stripe | 1. Shopify Payments at 2.9% + 30c (BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 30)<br>2. Stripe Checkout (BaggageClaims_Web_Blueprint_RevA.md, §3.3 Purchase, line 62)<br>3. Stripe Checkout + webhooks (BaggageClaims_Web_Blueprint_RevB.md, §0 Version pins, line 13) | The payment fee on the own-site sales channel row and the unit economics of that channel. |
| P086 | Email tool: Klaviyo or Listmonk | 1. Klaviyo for email and SMS, with seven lists and four flows (BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 32)<br>2. Klaviyo sync queue in the custom build (BaggageClaims_Web_Blueprint_RevA.md, §5 Worker queues, line 90)<br>3. Listmonk self-hosted, transactional mail on Resend (BaggageClaims_Web_Blueprint_RevB.md, §4 Campaigns, line 59)<br>4. The Hotline worker still fires a Klaviyo event (Walk through the Hotline TTS audio worker flow.md, Lifecycle, hop 8, line 20) | The launch email and sequence rows, monthly cost, and where the lists live. |
| P087 | Referral engine: Viral Loops or built in | 1. Viral Loops Start-up at \$49 a month, pre-launch only (BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 34)<br>2. Own referrals table, reward jobs and a rank cache in the custom build (BaggageClaims_Web_Blueprint_RevA.md, §3.1 Gate -> referral loop, line 52) | Campaign 5 (The Departure Board), its tooling budget and fraud handling. |
| P088 | File storage: S3 or Postgres | 1. S3 for media, signed URLs with 15-minute TTL (BaggageClaims_Web_Blueprint_RevA.md, §7 Auth & security, line 111)<br>2. MinIO as local S3 in the compose file (docker-compose.yml, minio service, line 43)<br>3. Hotline worker uploads to an S3 bucket (Walk through the Hotline TTS audio worker flow.md, Lifecycle, hop 7, line 19)<br>4. S3 removed; media in a Postgres bytea table (BaggageClaims_Web_Blueprint_RevB.md, §2 Postgres file storage, line 36) | The Hotline worker design, voice pack downloads and the backup plan. |
| P089 | Kickstarter target: \$15k goal, 2,000 backers, or \$15-20k | 1. \$15k goal (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §10 Phase 2, page 6)<br>2. 2,000 backers, about \$48k at a \$24 average (the same PRD) (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9, page 5)<br>3. 2,000 backers (BaggageClaims_Marketing_Playbook_RevA.txt, goal hierarchy, line 3)<br>4. \$15-20k (I have an idea for a quick gag and potential quick.md, Road to the Quick Buck, 2, line 57) | Decision "If Kickstarter runs: which goal?", campaign 7's target, the stretch goals at \$25k and \$40k, and the batch size. |
| P090 | First build time: about 90 minutes or about 3.5 hours | 1. About 90 minutes (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §7 Assembly Summary, page 4)<br>2. About 90 minutes (BaggageClaims_DesignPackage_RevA.pdf, §3 Assembly Guide, page 5)<br>3. About 3.5 h hands-on plus about 5 h unattended printing (BaggageClaims_BuildGuide_RevA.md, header, line 5)<br>4. Electronics alone about 90 minutes in the build guide (BaggageClaims_BuildGuide_RevA.md, Phase 2 heading, line 27) | Assembly step minutes, labour cost per unit, and the validation batch schedule ("one weekend"). |
| P091 | Motion history buffer: 2 seconds or 10 seconds | 1. 2 s ring buffer (BaggageClaims_DesignPackage_RevA.pdf, §1.1 Architecture, page 2)<br>2. 10 s, N_HIST=1000 (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §6 Firmware Deliverable, page 3)<br>3. 10 s in the sketch (Generate the Arduino sketch for the classification.md, sketch, ring buffers, line 43) | The conveyor rule (an 8 s variance window cannot fit a 2 s buffer), memory use, and the requirement text. |
| P092 | Sleep mode and sleep current | 1. Deep sleep 30-60 uA, wake on motion interrupt or 1 s timer (BaggageClaims_DesignPackage_RevA.pdf, §1.2 U1, page 2)<br>2. 60 uA sleep on the power interface (BaggageClaims_DesignPackage_RevA.pdf, §2.1 IF-1, page 4)<br>3. 1 s light-sleep poll; deep-sleep wake is Rev B (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §6 maybeSleep, page 3)<br>4. Light sleep in the sketch (Generate the Arduino sketch for the classification.md, sketch, maybeSleep, line 191)<br>5. Acceptance limit is under 200 uA (BaggageClaims_BuildGuide_RevA.md, Phase 7, step 36, line 93) | Requirement "Power", the Sleep current test's limit, and the 3-6 month battery life claim. |
| P093 | Prototype parts total: \$64.80 stated, PRD table adds up to \$64.34 | 1. The 16 lines of the parts list add up to \$64.80 (U1 at \$8.99) (BOM_shopping_list.csv, U1 row, line 2)<br>2. The PRD table's nine rows add up to \$64.34 (9.00 + 6.99 + 5.50 + 1.75 + 2.00 + 18.60 + 11.50 + 5.00 + 4.00) but the total line says \$64.80 (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §5 Bill of Materials, page 3)<br>3. The PRD's grouped row of small parts (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §5 Bill of Materials, page 3) | The prototype cost on Production, Unit economics and any grouped parts rows. |
| P094 | Prototype column of the cost table adds up to \$58.80, not \$64.80 | 1. Landed COGS stated as \$64.80 for one prototype (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 cost table, page 5)<br>2. The five priced lines are 34.30 + 3.75 + 7.05 + 5.00 + 8.70 = 58.80; labour is "(DIY)" (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 cost table, page 5) | The "Prototype" row on Unit economics and the cost-line rows proposed below. |
| P095 | Battery count: two AA or three AA | 1. Two AA alkaline (I have an idea for a quick gag and potential quick.md, The One Regulatory Gotcha, line 50)<br>2. Three AA alkaline (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §3 Power strategy, page 2) | Bus voltage, the battery holder and the story text. |
| P096 | Motion sensor library: Adafruit MPU6050 or raw I2C | 1. Install Adafruit MPU6050 and DFRobotDFPlayerMini (BaggageClaims_DesignPackage_RevA.pdf, §3 Step 5, page 5)<br>2. Raw I2C through Wire, one library only (Generate the Arduino sketch for the classification.md, sketch header, line 10)<br>3. Build guide installs DFRobotDFPlayerMini only (BaggageClaims_BuildGuide_RevA.md, Phase 4, step 18, line 62) | Assembly Phase 4 text and the firmware requirement. |
| P097 | Low-pass filter: 42 Hz or 44 Hz | 1. 42 Hz bandwidth (BaggageClaims_DesignPackage_RevA.pdf, §2.3 register usage, page 4)<br>2. 44 Hz (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §3.1 Sensing, page 2)<br>3. 44 Hz in the sketch (Generate the Arduino sketch for the classification.md, sketch, mpuInit, line 73) | The sensor configuration requirement. |
| P098 | Expected boot log differs in three documents | 1. "CAL OK" then "SLEEP" (BaggageClaims_DesignPackage_RevA.pdf, §3 Step 5, page 5)<br>2. "CAL OK g=(0.00,0.00,1.00)" then "DF OK" then "IDLE" (BaggageClaims_BuildGuide_RevA.md, Phase 4, step 21, line 66)<br>3. The sketch prints CAL OK, DF OK and later "SLEEP 1s"; it never prints "IDLE" (Generate the Arduino sketch for the classification.md, sketch, maybeSleep, line 189) | Assembly Phase 4's pass text ("expect CAL OK, DF OK, IDLE") and any boot-log test. |
| P099 | Weigh-in: how long the bag must be still | 1. 2-3 seconds (I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 2, line 21)<br>2. 3.5-6 s at +0.8-1.2 m height after a 1.2-2.0 m/s lift (BaggageClaims_DesignPackage_RevA.pdf, §1.4 WEIGH_IN, page 2)<br>3. 3.5-6 s in the sketch, with no lift-speed or height check (Generate the Arduino sketch for the classification.md, sketch, tunables, line 25) | Requirement "Detect: Weigh-in" and the Weigh-in test (hold 4 s). |
| P100 | Free-fall duration: over 0.3 s or at least 0.28 s | 1. Over 0.3 s of near-zero g (I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 7, line 26)<br>2. At least 0.28 s below 0.15 g (BaggageClaims_DesignPackage_RevA.pdf, §1.4 FREEFALL, page 2) | Requirement "Detect: Free-fall". |
| P101 | Carousel: how it is recognised and for how long | 1. Circular and periodic motion for about 30 seconds or more (I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 4, line 23)<br>2. Gyro Z sinusoid plus centripetal acceleration, over 25 s, period 3-12 s (BaggageClaims_DesignPackage_RevA.pdf, §1.4 CAROUSEL, page 3)<br>3. Three sign changes of one gyro axis, 3-12 s apart; no duration floor, no centripetal check (Generate the Arduino sketch for the classification.md, sketch, tunables, line 30)<br>4. The sketch reads the middle gyro register and calls it gz_ (Generate the Arduino sketch for the classification.md, Two honest caveats, 1, line 222) | Requirement "Detect: Carousel" and any carousel test. |
| P102 | Conveyor: "100-400 Hz" band against a 100 Hz sample rate [medium] | 1. Variance in a 100-400 Hz band for over 8 s (BaggageClaims_DesignPackage_RevA.pdf, §1.4 CONVEYOR, page 3)<br>2. The sensor is sampled at 100 Hz behind a 42 Hz filter (BaggageClaims_DesignPackage_RevA.pdf, §2.3 register usage, page 4)<br>3. The sketch uses the variance of acceleration magnitude over 8 s, between 0.015 and 0.5, with no rotation (Generate the Arduino sketch for the classification.md, sketch, tunables, line 31) | Requirement "Detect: Conveyor". |
| P103 | Handle grab: the rule differs | 1. Sustained tilt plus steady carry acceleration, "carry-mode 10-90 s" (BaggageClaims_DesignPackage_RevA.pdf, §1.4 HANDLE_GRAB, page 2)<br>2. Tilt between 25 and 75 degrees while moving for 10 s (Generate the Arduino sketch for the classification.md, sketch, tunables, line 27)<br>3. Lifted and carried by the handle after idle (I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 3, line 22) | Requirement "Detect: Handle grab" and the Carry test (15 s). |
| P104 | Inverted: the rule differs | 1. Within 0.1 g of minus 1 g on the z axis, for over 4 s (BaggageClaims_DesignPackage_RevA.pdf, §1.4 INVERTED, page 3)<br>2. z acceleration below minus 0.9 g for 4 s (no upper bound) (Generate the Arduino sketch for the classification.md, sketch, tunables, line 32)<br>3. Tilted past about 90 degrees (I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 6, line 25) | Requirement "Detect: Inverted". |
| P105 | Hard impact of 8-14 g against a sensor range of +/-8 g [medium] | 1. Impact threshold window 8-14 g peak, under 50 ms (BaggageClaims_DesignPackage_RevA.pdf, §1.4 HARD_IMPACT, page 2)<br>2. Sensor range set to +/-8 g, said to cover drop peaks (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §3.1 Sensing, page 2)<br>3. The sketch fires when the magnitude passes 8.0 g (Generate the Arduino sketch for the classification.md, sketch, tunables, line 23)<br>4. Functional shock spec 14 g, survival 40 g (BaggageClaims_DesignPackage_RevA.pdf, §2.4, page 4) | Requirement "Detect: Hard impact", the Drop test and the sensor configuration. |
| P106 | Gag lines are worded differently between documents | 1. PRD wording of the dark-idle line (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §8 row 8, page 5)<br>2. Design package wording of the same line (BaggageClaims_DesignPackage_RevA.pdf, §1.4 DARK_IDLE, page 3)<br>3. Launch video wording (BaggageClaims_LaunchVideo_Script_RevA.txt, Act 2, 1:10, line 39)<br>4. First proposal's handle line has a lead-in the PRD drops (I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 3, line 22)<br>5. First proposal's inverted line (I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 6, line 25)<br>6. PRD inverted line (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §8 row 7, page 5) | The Response field of each requirement, the voice examples in the story, and the recording script for the voice actor. |
| P107 | Enclosure height: 42 mm or 40 mm | 1. About 80 x 60 x 42 mm (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §4 Enclosure, page 3)<br>2. About 80 x 60 x 40 mm (Build me the low level design , inter interface co.md, Build sequence, line 29)<br>3. Project box alternative is 80 x 60 x 40 mm (BOM_shopping_list.csv, ENC1 row, line 16) | The enclosure part's geometry (80 x 42 x 60 in the app) and the Enclosure requirement. |
| P108 | Enclosure print: mass and cost differ | 1. About 90 g, \$5.00 (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §5 Bill of Materials, page 3)<br>2. About 100 g, about \$2 a unit (two halves plus mid-plate) (Can I do a 3d printer for this integrated - if so.md, Level 1, line 19)<br>3. About 62 g, 4-5 h (print-in-place clamshell) (BaggageClaims_BuildGuide_RevA.md, Phase 1, step 8, line 22)<br>4. \$5.00 line for 250 g of PETG at about \$20 a kg (BOM_shopping_list.csv, ENC1 row, line 16) | The ENC1 part's line cost, the print job estimates and the enclosure cost line. |
| P109 | Enclosure design: two-piece shell with mid-plate, or print-in-place clamshell | 1. Two-piece PETG, mid-plate on M2 standoffs (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §4 Enclosure, page 3)<br>2. Bottom shell plus top shell (BaggageClaims_DesignPackage_RevA.pdf, §3 Step 1, page 5)<br>3. Print-in-place clamshell STL (BaggageClaims_BuildGuide_RevA.md, Phase 1, step 5, line 16)<br>4. The 3D printing note calls the clamshell the recommended target (Can I do a 3d printer for this integrated - if so.md, Level 2, line 21) | Decision "Which enclosure build?", the parts list (mid-plate, standoffs), the model and the assembly steps. |
| P110 | Hinge test coupon: sizes and print time differ | 1. Pins 1.3 / 1.4 / 1.5 mm against bores 1.7 / 1.8 / 1.9 mm, 45 minutes (BaggageClaims_BuildGuide_RevA.md, Phase 1, step 6, line 19)<br>2. Pins at 0.20 / 0.25 / 0.30 / 0.35 mm clearance, a 15-minute print (Can I do a 3d printer for this integrated - if so.md, Level 2 design rules, line 26)<br>3. Rule of 0.3-0.4 mm per side for PETG (Can I do a 3d printer for this integrated - if so.md, Level 2 design rules, line 23) | Print job "Hinge clearance coupon" (settings and estimate). |
| P111 | Cost at 1,000 units: under \$8, \$4-6, or \$19.00 | 1. Under 8 USD at 1k volume (BaggageClaims_DesignPackage_RevA.pdf, product summary, page 1)<br>2. Roughly \$4-6 (I have an idea for a quick gag and potential quick.md, Hardware and Build Cost, line 44)<br>3. \$19.00 landed (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 note, page 5)<br>4. Toward about \$15 after further compression (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 note, page 5) | Unit economics "Production run", every channel margin, and the green light for the 1,000-unit run. |
| P112 | Prototype parts cost: \$10-15 or \$64.80 | 1. A "~\$6-in-parts" gadget; hobbyist parts around \$10-15 (I have an idea for a quick gag and potential quick.md, first paragraph, line 5)<br>2. \$64.80 for one prototype (Create a PRD for this with arch instructions bom a.md, Headline economics, line 11) | The story's cost claims and the validation ask. |
| P113 | "EV batch": 5 units, 20 units or 100 units, and its cost target | 1. 5-unit engineering validation batch (BaggageClaims_PRD_Business_Proposal_RevA.pdf, Ask, page 1)<br>2. 100-unit EV batch at \$43.20 landed (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 cost table, page 5)<br>3. 100-unit EV batch must come in under \$22 COGS (Rev B exit) (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §11 Roadmap, page 6)<br>4. 20 EV units for creators, about \$1.3k (BaggageClaims_Marketing_Playbook_RevA.txt, Budget rollup, line 130) | Batch plan rows A and B, Unit economics "Engineering validation batch" and the Rev B build's exit criteria. |
| P114 | SPI flash audio: Rev B or Rev C | 1. Rev B scope (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §11 Roadmap, page 6)<br>2. Rev C (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §12 Risks, page 6) | The build rows for Rev B and Rev C and the storage cost line. |
| P115 | Marketing budget: \$5k reserve or about \$4,500, and creator seeding \$3k or \$1,300 | 1. \$3k creator seeding plus \$2k paid amplification (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §10 Content cost, page 6)<br>2. Playbook header repeats \$3k and \$2k (BaggageClaims_Marketing_Playbook_RevA.txt, header, line 5)<br>3. Playbook rollup: creator seeding \$1,300 (BaggageClaims_Marketing_Playbook_RevA.txt, Budget rollup, line 130)<br>4. Playbook rollup total about \$4,500, with no \$2k amplification line (BaggageClaims_Marketing_Playbook_RevA.txt, Budget rollup, line 135) | The campaigns plan row (total budget), campaign 1's amplification and campaign 3's budget. |
| P116 | Cost to win a customer: under \$8 or kill above \$10 | 1. CAC under \$8 (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §13 Success Metrics, page 6)<br>2. Kill the retargeting test if CAC is over \$10 (BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 8, line 104) | The stop rule on the three Shame Ads and campaign 8's target. |
| P117 | Shame Ads test: \$500 or five dollars | 1. \$500 test (BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 8, line 104)<br>2. "Five-dollar-test" (Develop clever marketing campaigns for this hilari.md, Stage 3, 8, line 27) | Campaign 8's budget and the ads' stop rule. |
| P118 | Email list targets: 500, 2,000 or 3,000 | 1. 500 signups passes the Phase 1 gate (BaggageClaims_Marketing_Playbook_RevA.txt, goal hierarchy, line 2)<br>2. Over 2,000 emails before launch green-lights the 1,000-unit run (BaggageClaims_Marketing_Playbook_RevA.txt, Kill criteria, line 138)<br>3. 3,000 emails before the Kickstarter launch (campaign 5 KPI) (BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 5, line 64)<br>4. Website plan: 500+ emails before further web spend (BaggageClaims_Website_Platform_Plan_RevA.txt, §8 Phase W1, line 202) | Decision "Scale gate", campaign 5's target and the web build phases. |
| P119 | Early-bird price: \$19 or \$19.95 | 1. \$19 (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 pricing ladder, page 5)<br>2. \$19.95 (I have an idea for a quick gag and potential quick.md, Road to the Quick Buck, 2, line 57) | The Kickstarter early bird channel row and the pricing rows. |
| P120 | "First Class" names three different things | 1. The New Yorker voice pack (What clever names for this ?.md, Tier-able name system, line 29)<br>2. The \$49 collector Kickstarter tier (BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 7, line 87)<br>3. The 25-referral group on the Departure Board (BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 5, line 62)<br>4. The naming note calls the \$49 edition "Black Card" instead (What clever names for this ?.md, Tier-able name system, line 29) | Names rows, the Kickstarter tier prices and the referral rewards. |
| P121 | Hotline prize: weekly or monthly | 1. Monthly best complaint wins a free unit (BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 4, line 53)<br>2. "Complaint of the Week", monthly winner gets a free unit (BaggageClaims_Website_Platform_Plan_RevA.txt, §4.3 Hotline, line 90) | Campaign 4's mechanics and the Hotline page row. |
| P122 | In the hold: performing or switched off | 1. Unrestricted in checked baggage (BaggageClaims_DesignPackage_RevA.pdf, product summary, page 1)<br>2. "Can legally perform in the hold" (Build me the low level design , inter interface co.md, The compliance hinge, line 18)<br>3. Compliance card tells the owner to switch it OFF before checking (BaggageClaims_BuildGuide_RevA.md, Phase 8, step 38, line 98)<br>4. Video footer: switch OFF before checking, in a video whose gags happen in the hold (BaggageClaims_LaunchVideo_Script_RevA.txt, Legal footers, line 83)<br>5. PRD risk mitigation: carry-on mode in marketing (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §12 Risks, page 6) | The core promise (gags at the belt, in the hold and on the carousel), the compliance rows, the FAQ and every ad claim. |
| P123 | Schema: "14 tables" stated, 13 in the file; two tables the designs use are missing | 1. 14 tables and 5 enums (BaggageClaims_Web_Blueprint_RevA.md, §6 Database, line 96)<br>2. The file creates 13 tables; the last is events (db_schema.sql, events table, line 98)<br>3. Blueprint relies on a processed_events table that the file does not create (BaggageClaims_Web_Blueprint_RevA.md, §7 Auth & security, line 113)<br>4. Hotline worker requires a render_status column that claim_tickets does not have (Walk through the Hotline TTS audio worker flow.md, Lifecycle, hop 3, line 15) | Any web platform build from the schema file. |
| P124 | Compose file details that do not match the other files [medium] | 1. The compose file mounts ./db/schema.sql (docker-compose.yml, db service, line 30)<br>2. The blueprint names the file db_schema.sql (BaggageClaims_Web_Blueprint_RevA.md, header, line 2)<br>3. Compose comment lists four worker queues (docker-compose.yml, worker service, line 20)<br>4. Blueprint lists seven queues including a dead-letter queue (BaggageClaims_Web_Blueprint_RevA.md, §5 Worker queues, line 92) | Any web platform build. |
| P125 | Rev B says four databases and names three [medium] | 1. "4 DBs: bagclaims, listmonk, postiz" (BaggageClaims_Web_Blueprint_RevB.md, §7 Compose Rev B, line 85) | The Rev B compose file, which is not in the folder. |
| P126 | Sketch length: 262 lines stated, about 203 pasted [medium] | 1. 262 lines (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §6 Firmware Deliverable, page 3)<br>2. "Reproduced below" in the chat, where the code block runs from line 8 to line 209 of the file (Generate the Arduino sketch for the classification.md, first paragraph, line 5) | Requirement "Firmware sketch compiles": the pasted text may not be the whole file. |
| P127 | Low-battery warning: specified, but not in the Rev A hardware or sketch | 1. Below 3.3 V pack: play the rasp once, then sleep (BaggageClaims_DesignPackage_RevA.pdf, §1.5, page 3)<br>2. The battery ADC divider is Rev B hardware (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §6 Rev A caveats, page 3)<br>3. The sketch defines the clip number and never plays it (Generate the Arduino sketch for the classification.md, sketch, clip map, line 40) | A low-battery requirement, clip 0010 and any low-battery test. |
| P128 | Boot calibration: 2 seconds or 1 second [medium] | 1. CALIBRATE takes a 2 s gravity vector (BaggageClaims_DesignPackage_RevA.pdf, §1.5, page 3)<br>2. The sketch averages 100 samples 10 ms apart (Generate the Arduino sketch for the classification.md, sketch, calibrate, line 117) | The calibration requirement. |
| P129 | Motion interrupt pin: open-drain pulse or latched | 1. Motion interrupt, open-drain (BaggageClaims_DesignPackage_RevA.pdf, §2.3 register usage, page 4)<br>2. Active-high pulse (BaggageClaims_DesignPackage_RevA.pdf, §2.1 IF-5, page 4)<br>3. Latched (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §4 pin table, page 3)<br>4. The sketch sets latched mode (Generate the Arduino sketch for the classification.md, sketch, mpuInit, line 76) | The wiring note on "Motion interrupt" (the app says "Latched") and the wake design for Rev B. |
| P130 | The ask: about \$750, but its two parts add up to \$700 [medium] | 1. About \$750 (BaggageClaims_PRD_Business_Proposal_RevA.pdf, Ask, page 1)<br>2. Chat summary: about \$750 to build the batch and film one video (Create a PRD for this with arch instructions bom a.md, The decision gate that matters, line 27) | Brief "The ask and the gate", decision "Spend about \$750" and batch A. |
| P131 | Clip file naming: 001.mp3 or 0001.mp3 | 1. 001.mp3 naming (BOM_shopping_list.csv, SD1 row, line 12)<br>2. 0001.mp3 upward (BaggageClaims_DesignPackage_RevA.pdf, §3 Step 4, page 5) | The SD1 part's specification (the app already says nothing about naming) and the audio requirement. |
| P132 | Bambu Lab A1: two different Micro Center product numbers [medium] | 1. SKU 660886 in the text (Can I do a 3d printer for this integrated - if so.md, The printer: Bambu Lab A1, line 9)<br>2. Product 676237 in the cited address (Can I do a 3d printer for this integrated - if so.md, footnote 1, line 46) | The printer decision and any supplier row. |
| P133 | Enclosure saving: "from about \$11.50" does not match the parts list [low] | 1. Enclosure plus mounting falls from about \$11.50 to about \$2-3 (Can I do a 3d printer for this integrated - if so.md, after the material table, line 38)<br>2. In the PRD, \$11.50 is the perfboard, standoffs, screws, foam and zip ties row; the enclosure is a separate \$5.00 (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §5 Bill of Materials, page 3)<br>3. The note also says the print replaces a \$5 project box (Can I do a 3d printer for this integrated - if so.md, Level 1, line 19) | The saving claimed for the clamshell option and the methods rows. |
| P134 | Ingress rating written as "IP424" [medium] | 1. "IP424 splash ingress via speaker-grille hydrophobic mesh" (BaggageClaims_DesignPackage_RevA.pdf, §2.4, page 4) | The environmental requirement and any claim made on the listing. |
| P135 | Kickstarter "aimed at Q4 gifting" against the document's own dates [low] | 1. Kickstarter in weeks 4-12, aimed at Q4 gifting (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §10 Phase 2, page 6)<br>2. The PRD is dated 19 Nov 2026 (BaggageClaims_PRD_Business_Proposal_RevA.pdf, front page, page 1)<br>3. The 1,000-unit Kickstarter fulfilment run is in months 4-6 (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §11 Roadmap, page 6) | The launch plan's dates and the batch plan's target dates. |
| P136 | Creator programme: 3-5 creators at 10-20%, or 20 creators at 10% | 1. 3-5 mid-size travel comedians at 10-20% revenue share (BaggageClaims_PRD_Business_Proposal_RevA.pdf, §10 Phase 2, page 6)<br>2. 20 units to creators, affiliate code worth 10% of pledged value (BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 3, line 36)<br>3. Website plan: creator codes with a 10% payout (BaggageClaims_Website_Platform_Plan_RevA.txt, §5.1 Affiliates, line 137) | Campaign 3 and the advertising cost per order on each channel. |

## Claims to verify (63 new)

Outside facts the documents assert. Nobody has checked any of them, and I did not check them either. The wording column is copied from the document. The last five need a bench measurement or a load test, not research.

Already in the app, still unverified (9): market size and growth; the \$12-15 gag-gift band; FAA PackSafe and alkaline cells; Kickstarter's \$33k average; 10% of backers and 60% of funds; PCBA at \$18-22 a board; mid-tier creators' 3x engagement; 2.8 billion checked bags a year; Amazon's 30% take.

| id | claim | the document's wording | where |
|---|---|---|---|
| P144 | Short-form travel comedy is one of the most reliable viral content genres | short-form travel comedy is one | BaggageClaims_PRD_Business_Proposal_RevA.pdf, front page, Why now, page 1 |
| P145 | Kickstarter campaigns with a video are far likelier to fund | ~\$33k raised and campaigns with video are far likelier to fund | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9, page 5 |
| P146 | Kickstarter takes about 8-10% in fees | ~8-10% fees | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 pricing ladder, page 5 |
| P147 | A direct store (Shopify or TikTok Shop) takes about 12% blended | ~12% blended | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 pricing ladder, page 5 |
| P148 | A 2,000-backer campaign at a \$24 average grosses about \$48k and contributes about \$8-12k after COGS, fulfillment and marketing | - plus a validated customer list for retail conversations. | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9, page 5 |
| P149 | Between 1% and 3% of a pre-launch email list converts on day one | launch (industry rule: 1–3% of list converts; 3,000 × 2% × \$24 ≈ \$1.4k | BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 5, line 65 |
| P150 | About \$1.4k of day-one pledges triggers Kickstarter's trending algorithm | day-one velocity, which triggers Kickstarter's trending algorithm). | BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 5, line 66 |
| P151 | Posting many creator clips in one week makes the algorithm read the subject as a trend, not an ad | Stack the feed: all 20 post within the launch week so the algorithm reads | BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 3, line 38 |
| P152 | Morning commuter slots (6-8 am local) are the right posting time for the unbranded clips | posted raw, no logo, no link, morning commuter slots (6–8am local). | BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 1, line 15 |
| P153 | ManyChat can auto-DM a commenter who types a keyword and take them to a one-field email capture | auto-DM via ManyChat to a one-field email capture. This is the entire | BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 1, line 22 |
| P154 | Four-packs are where the margin lives | the groomsmen/secret-santa bundle; 4-packs are where margin lives). | BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 7, line 89 |
| P155 | Airport gift retail is reachable through Paradies and Hudson-style channels | Paradies/Hudson-style channel | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §2, page 2 |
| P156 | Wholesale at \$14.50 against a \$29.95 MSRP gives retailers a 2x markup, and that is enough for airport retail | gives retailers 2x markup; the button converts the browser so the | BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 10, line 123 |
| P157 | Gag gifts retail well at \$19.95 to \$24.95, a 3-4x margin over parts | That's a healthy 3–4× margin with room for Kickstarter pricing. | I have an idea for a quick gag and potential quick.md, Hardware and Build Cost, line 44 |
| P158 | Alkaline batteries are allowed in carry-on and checked bags with essentially no restrictions | Alkalines are allowed in both carry-on and checked bags with essentially no restrictions. | I have an idea for a quick gag and potential quick.md, The One Regulatory Gotcha, line 50 |
| P159 | TSA allows installed lithium batteries in checked devices | TSA allows installed lithium batteries in checked devices, but accidental activation rules and hassles make it a liability. | I have an idea for a quick gag and potential quick.md, The One Regulatory Gotcha, line 48 |
| P160 | Alkaline AA cells need no UN38.3 testing | alkaline AA only (no UN38.3 lithium cells) - this is the compliance hinge for checked-bag operation under FAA | BaggageClaims_DesignPackage_RevA.pdf, §2.4, page 4 |
| P161 | With the radios disabled the device needs only FCC Part 15 unintentional-radiator treatment, by self-declaration, and the ESP32-S3 module is itself FCC certified | Part 15 unintentional-radiator treatment (self-declare; ESP32-S3 module itself is FCC certified). | BaggageClaims_DesignPackage_RevA.pdf, §2.4, page 4 |
| P162 | Airlines have a "lithium-device handling policy" that the compliance card can cite for an alkaline device | per airline lithium-device handling policy." | BaggageClaims_DesignPackage_RevA.pdf, §3 field kit and compliance card, page 5 |
| P163 | Celebrity voice impressions invite right-of-publicity claims and platform takedowns | Celebrity impressions invite right-of-publicity trouble and platform takedowns | I have an idea for a quick gag and potential quick.md, The One Regulatory Gotcha, last paragraph, line 52 |
| P164 | The Wilhelm scream can be used as a product sound and in the launch video | Wilhelm scream | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §8 row 4, page 5 |
| P165 | A real baggage handler can be filmed for the launch video with written consent | Film the handler beat with a real handler's written consent; the confused-look-around | BaggageClaims_LaunchVideo_Script_RevA.txt, Shot list notes, line 77 |
| P166 | 85 dBA at 1 m is loud enough for terminals and below PA levels | enough for terminals, below PA levels. | BaggageClaims_DesignPackage_RevA.pdf, §1.2 SPK1, page 2 |
| P167 | Cargo holds stay between -10 C and +45 C | Checked-bag environment drives the design: -10C to +45C storage (cargo holds), 0-95% RH non-condensing, shocks | BaggageClaims_DesignPackage_RevA.pdf, §2.4, page 4 |
| P168 | Self-hosting Postiz without forking it triggers no AGPL source-disclosure duty | AGPL-3.0: we RUN it, we neither fork nor embed code - no source-disclosure | BaggageClaims_Web_Blueprint_RevB.md, §5 Postiz, line 73 |
| P169 | Novelty brands are sued over website accessibility; WCAG 2.2 AA is the bar | gag site is no excuse; lawsuits target novelty brands too. | BaggageClaims_Website_Platform_Plan_RevA.txt, §6 Compliance, line 181 |
| P170 | EU visitors need double opt-in for email under CAN-SPAM and GDPR | Email: CAN-SPAM/GDPR double opt-in for EU IPs; one-click unsub. | BaggageClaims_Website_Platform_Plan_RevA.txt, §6 Compliance, line 173 |
| P171 | Waveshare ESP32-S3 Mini is \$8.99 at Micro Center, SKU 699323, same-day pickup | SKU 699323 'Waveshare ESP32-S3 Mini Development Board' | BOM_shopping_list.csv, U1 row, line 2 |
| P172 | HiLetgo GY-521 MPU-6050 is \$6.99 for one or \$11.79 for three on Amazon | 'HiLetgo GY-521 MPU-6050' (sold \$6.99 1-pk or \$11.79 3-pk) | BOM_shopping_list.csv, U2 row, line 3 |
| P173 | DFPlayer Mini averages \$5.50 each in an Amazon two-pack | a DFPlayer Mini MP3 module (\$5.90 retail, ~\$1.30 in quantity) | I have an idea for a quick gag and potential quick.md, Hardware and Build Cost, line 39 |
| P174 | A four-pack of 3 W 8-ohm speakers is \$6.99 on Amazon (\$1.75 each) | 4-pack 3W 8Ω speakers (\$6.99) | Build me the low level design , inter interface co.md, Shopping plan, line 25 |
| P175 | The MPU-6050 costs \$0.90 in volume | \$0.90 in volume. | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §3.1, page 2 |
| P176 | A microSD card that holds three voice packs costs \$2 | enabling DLC and localization with zero board respins. | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §3.3, page 2 |
| P177 | A voice pack on microSD costs \$0.50 to make | packs (pure-margin microSD content, \$0.50 BOM, \$7.99 retail) attach. | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9, page 5 |
| P178 | The other small prototype parts are in stock at Micro Center for same-day pickup at the listed prices | Micro Center (same-day, Austin) | Build me the low level design , inter interface co.md, Shopping plan, line 24 |
| P179 | A 2-layer PCB costs \$0.50-1.50 at 1,000 and assembly \$1-5 a board at high volume | PCBA bands follow published turnkey rates: ~\$18-22 per board for moderate-BOM | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9, page 5 |
| P180 | Moving from microSD to SPI flash and to offshore assembly saves another \$3-4 a unit at 1,000 | compression comes from microSD > SPI flash and offshore assembly, taking COGS toward ~\$15. | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 note, page 5 |
| P181 | YX5200 and KT148A can be dual-sourced as the audio codec | Dual-source YX5200/KT148A; SPI flash path removes module dependency in Rev | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §12 Risks, page 6 |
| P182 | Inland PETG is about \$20 a kg at Micro Center | 250g PETG filament (MC Inland ~\$20/kg) | BOM_shopping_list.csv, ENC1 row, line 16 |
| P183 | Bambu Lab A1 is \$259.99 at Micro Center, with a 256 mm bed, direct drive and about 20 minutes of setup | The Bambu Lab A1 is \$259.99 at Micro Center right now (in-store pickup, SKU 660886) | Can I do a 3d printer for this integrated - if so.md, The printer: Bambu Lab A1, line 9 |
| P184 | AMS Lite adds \$100 and prints a second colour in the same job | optional, but it prints your logo and shell text in a second color in the same job, no painting or decals. | Can I do a 3d printer for this integrated - if so.md, The printer: Bambu Lab A1, line 13 |
| P185 | A1 mini Combo with AMS lite is \$299.99 with a 180 mm bed; enclosed printers (P2S, X2D) start at \$649 | Budget alternative: the A1 mini Combo with AMS lite at \$299.99 does everything above on a smaller 180mm bed | Can I do a 3d printer for this integrated - if so.md, Budget alternative, line 15 |
| P186 | PETG print-in-place hinges need 0.3-0.4 mm clearance per side; PETG micro-welds at PLA clearances | (PETG micro-welds at PLA clearances - this is the \#1 failure mode) | Can I do a 3d printer for this integrated - if so.md, Level 2 design rules, line 23 |
| P187 | Over-extrusion shrinks print-in-place clearances by 0.1-0.15 mm | over-extruding shrinks your clearances by 0.1–0.15mm and welds moving parts shut. | Can I do a 3d printer for this integrated - if so.md, The printer: Bambu Lab A1, line 12 |
| P188 | PETG survives -10 to +45 C and is the best print-in-place material; ASA is not needed | Tough, survives −10 to +45°C, best print-in-place material | Can I do a 3d printer for this integrated - if so.md, Material spec, line 34 |
| P189 | An A1 prints 4-6 shells per plate overnight | where you'd run the A1 overnight in batches of 4–6 shells per plate. | Can I do a 3d printer for this integrated - if so.md, after the material table, line 38 |
| P190 | Shopify Basic is \$39 a month (\$29 on annual billing; new stores 3 days free then \$1 a month for 3 months); Shopify Payments is 2.9% + 30c online | Shopify Basic \$39/mo (or \$29/mo annual; new stores: 3 days free then | BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 29 |
| P191 | Klaviyo is free to 250 profiles and 500 sends, then \$20 a month for 500 profiles and about \$100 a month at 5,000; it bills on active profiles | (500 profiles) -> ~\$100/mo at 5k. Watch: bills on ACTIVE profiles. | BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 33 |
| P192 | Viral Loops Start-up is \$49 a month for 1,000 participants, with built-in fraud flags | Referral engine: Viral Loops Start-up \$49/mo (1,000 participants) for | BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 34 |
| P193 | Vercel and Supabase free tiers cost about \$0 until traffic passes 100k hits a month; Supabase Pro is \$25 a month above 500 MB and Vercel Pro \$20 a month | Uptime/scale: all static/CDN; Supabase free->Pro \$25/mo at >500MB; | BaggageClaims_Website_Platform_Plan_RevA.txt, §6 Uptime/scale, line 182 |
| P194 | Judge.me, Shopify Inbox and Microsoft Clarity have free tiers; Sky Pilot is about \$5-15 a month; two domains cost about \$25 a year | Reviews/UGC: Judge.me free tier. Chat: Shopify Inbox free. | BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 41 |
| P195 | Running cost of \$240 a month at a 5,000 list is under 1.5% of one 1,000-unit batch's gross margin | <1.5% of a single 1,000-unit batch gross margin. | BaggageClaims_Website_Platform_Plan_RevA.txt, §8 Phase SCALE, line 209 |
| P196 | PostgreSQL 19 was released on 19 Nov 2026 and 18.7 is the mature release to pin | released TODAY 2026-11-19 - do NOT ride .0 on launch week; upgrade window | BaggageClaims_Web_Blueprint_RevB.md, §0 Version pins, line 8 |
| P197 | pgvector 0.8.7 fixes an IVFFlat buffer overflow present in 0.8.4 to 0.8.6 | pgvector 0.8.7 (includes IVFFlat buffer-overflow fix - never ship 0.8.4-0.8.6) | BaggageClaims_Web_Blueprint_RevB.md, §0 Version pins, line 10 |
| P198 | Vercel's nextjs/saas-starter has about 16k stars, an MIT licence, and pins a Next 15 canary | BASE: Vercel nextjs/saas-starter (≈16k stars, MIT). | BaggageClaims_Web_Blueprint_RevB.md, §1 Starter template, line 18 |
| P199 | Postiz v2.11.3 is the last release without Temporal and covers 30+ channels including TikTok, Instagram, YouTube and X | v2.11.3 = last release without Temporal (v2.12+ adds Temporal + ES stack - | BaggageClaims_Web_Blueprint_RevB.md, §5 Postiz, line 67 |
| P200 | Self-hosting on one 4 vCPU / 8 GB VPS costs about \$24-40 a month and saves about \$100-150 a month against a SaaS stack at 5,000 contacts; Resend is free to 3k emails a month | (Klaviyo+Buffer+S3+Pinecone-class) at ~5k contacts: ~\$100-150/mo saved. | BaggageClaims_Web_Blueprint_RevB.md, §9 Self-host cost, line 100 |
| P201 | Live text-to-speech for 100k Hotline tickets would cost \$1-2k | near-zero marginal cost (versus \$1–2k of live TTS at 100k tickets) | Walk through the Hotline TTS audio worker flow.md, The design decision that shapes everything, line 9 |
| P202 | Three AA alkaline cells last 3-6 months | latched IMU motion interrupt = 3-6 months per battery set. | BaggageClaims_PRD_Business_Proposal_RevA.pdf, §3 Power strategy, page 2 |
| P203 | The hard-impact gag is detected 100% of the time | Rank 1 is the killer feature - 100% reliable detection, infinite replayability | I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, paragraph after the table, line 31 |
| P204 | A foam or loose sensor mount destroys the jerk signatures the classifier depends on | Mounting compliance destroys jerk signatures. | BaggageClaims_DesignPackage_RevA.pdf, §1.2 U2, page 2 |
| P205 | A 1 kOhm series resistor on the DFPlayer RX line stops random triggers | mandatory; without it you get random phantom triggers. | BaggageClaims_BuildGuide_RevA.md, Phase 2, step 12c, line 46 |
| P206 | One Hotline worker renders about 120 clips a minute at concurrency 4 | one worker on a single vCPU share handles ~120 renders/minute | Walk through the Hotline TTS audio worker flow.md, Capacity math, line 30 |

## Things the documents reference that are missing from the folder

| named | where it is named | what it is |
|---|---|---|
| BaggageClaims_Classifier_RevA.ino | PRD front page and section 6; build guide header and step 20; sketch chat | The firmware file. Only a pasted copy inside the sketch chat exists, shorter than the 262 lines stated. |
| 3d_view.png | PRD front page and section 4; design package front page; build guide header; design chat ("a 3D exploded view") | The exploded view of the product. |
| The 3D model of the two-piece shell | Design package section 3, step 1 ("from the 3D model"); 3D printing note, Level 1 | No STL, STEP or CAD file for the bottom shell, top shell or mid-plate. |
| BaggageClaims_PiP_Clamshell_RevA.stl | Build guide header and step 5 | The print-in-place clamshell the build guide prints. |
| pip_clamshell_gen.py | Build guide header and step 6 | The generator script with the hinge parameters (pin_r, sock_ir, PARAMS). |
| web_architecture_blueprint.png | Web Blueprint Rev A header; Rev B header | The architecture drawing. |
| docker-compose.yml (Rev B) and db_schema.sql (Rev B) | Web Blueprint Rev B header | The folder holds only the Rev A versions of both. |
| 02_extra_dbs.sql | Web Blueprint Rev B section 7 | Init script for the extra databases. |
| Caddyfile, .env, db/schema.sql, a Dockerfile | docker-compose.yml (volume mounts, env_file, build); Blueprint Rev A section 8 gives the Dockerfile as an outline only | Files the compose file needs beside it. |
| Hotline sequence diagram and flow spec | Hotline worker chat, first paragraph ("Two new artifacts"); it also cites "the spec" for a 500-concurrent-claim load test | Neither artifact is in the folder. |

Named as things to make, not as existing files: the voice clips (128 per pack) and the Hotline fragment library; a logo; the compliance card PDF and the "OFF before checking" safety video; the wholesale line sheet; the press kit; the safety-card illustrations; the frequent-flyer card; the Kickstarter page. None exists in the folder.

The chat documents also cite 65 web addresses in footnotes. I did not open any of them.

## What I did not do

- I changed no application code, seed data or database row, and ran no build, test or server. Only this file and the CSV were written.
- I resolved no conflict and chose no value. Where the app already holds one of the competing values, the row says which.
- I checked no outside fact, price, rule or web address. Every such statement is in "Claims to verify" or marked unverified in its row.
- I did not compile the firmware sketch. Statements about what the pasted sketch does or leaves out (no low-battery clip, no "IDLE" line, no jerk feature, no raw CSV logging, no radio-off call) come from reading it and are marked as mine.
- I did not read the live database or the welcome screen's example data (`src/components/welcome/exampleData.ts`); the inventory is the seed files only.
- No file was unread. In `schematic.png` several labels on the left overlap; I read what is legible and say so in the row (it does not show the INT wire or R2 as a part). In the PDFs, table text was read from the layout extraction; each excerpt in the CSV was checked by script to occur in its source, and its page or line number was taken from where it was found.
- I could not map the web platform engineering (21 rows) to any section; see "Web platform engineering" above.
- Some rows do not fit the fields the section has, and the row says so: the PRD's cost lines have four volumes where Unit economics takes one amount; the landing rows in the app are whole pages, where the section's fields describe sections of one page; the existing ads carry their stop rule in a field the section does not have; the existing channel rows carry price and fees as text.
- Dates are missing throughout: the documents give weeks and months counted from 19 Nov 2026, never calendar dates, so no launch date, batch date or build date is proposed.
- Several things the plans depend on are simply not written anywhere, and I did not write them: the 128 lines per voice pack, the Hotline's fragment lines, any email text, a press release, an Amazon listing, colours, type or a logo. The rows that mention them say "none written".
- The owner's stated direction (Amazon first, 20 Nov) is in the app but in no document; I did not re-run the margin model on that basis.

## Entered on 22 Nov

_Later the same day you answered the list of 376. Your rulings were applied in a second batch, `seed/concepts/baggage-claims/content/2026-11-22-rulings.json`: what became of each of the 376 rows is in `baggage-claims-owner-decisions.md` and its `.csv`, and in `seed/concepts/baggage-claims/content-proposal-map.json` under `resolution`. The text below describes the first batch._

Your ruling of 22 Nov 2026 (option B): enter the rows that are plain facts from your documents and need no judgement; bring you only the rows where the documents disagree or a choice is needed. 115 of the 491 rows were entered; 376 are in `baggage-claims-owner-decisions.md` (and its `.csv`), grouped so you can answer with ids and letters.

**Entered, by stage and action.**

| Stage | add | enrich | add-claim | replace | total |
|---|---|---|---|---|---|
| Concept | 13 | 8 | 0 | 0 | 21 |
| Research | 0 | 4 | 30 | 0 | 34 |
| Design | 8 | 14 | 0 | 0 | 22 |
| Prototype | 15 | 4 | 0 | 0 | 19 |
| Production | 1 | 1 | 0 | 0 | 2 |
| Marketing | 12 | 5 | 0 | 0 | 17 |
| Sales | 0 | 0 | 0 | 0 | 0 |
| Total | 49 | 36 | 30 | 0 | 115 |

**Left for you, by group.** (a) Conflicts between your documents: 112 (54 conflicts, and 58 rows that state one side of a conflict and wait on it). (b) Choices needed: 146. (c) Superseded by the decisions of 22 Nov (the tag, 80 x 60 x 42 mm, colours and taglines): 47. (d) Low or medium confidence, or not borne out when checked against the document: 23. (e) The product's own website platform: 48, one question.

**How a row qualified.** All of these held: not marked for your decision in the sheet; not a conflict; high confidence; its excerpt found in the named document (the two PDFs through their text); every number and quotation in it found in your documents; nothing about the strap, the puck, the enclosure size, colours or taglines; nothing that states one side of a conflict; nothing that would change a figure the app works out (unit cost, price, margin); its section exists in the app. All 490 excerpts that name a text document were found; the one that names `schematic.png` (P246) could not be checked by text and was already marked for you.

**How the rows were entered.** Through the seed, so every install gets the same content: `seed/concepts/baggage-claims/content/2026-11-22.json`, applied once per database by `src/lib/seedContentDb.ts` on a fresh install and on one seeded earlier. A row you have changed is left alone, a row whose title is already there is not entered twice, and nothing is deleted. Claims are unverified with their source document; every other row has the lowest status of its section; no decision was decided. Each row keeps the sheet id and the document and place it came from. `seed/concepts/baggage-claims/content-proposal-map.json` says where each of the 491 rows went.

**Wording.** The sheet's text is entered as written, with three mechanical changes: an instruction to the person entering ("Add to body:", "Status: open", "Minutes not stated") is not part of the text; the first letter of a row's text is a capital; text added to a row follows the row's own text as a new sentence. Parts get the cell of `BOM_shopping_list.csv` that the sheet row names.

**What changed in the app's figures.** The gates of all seven stages count the same checks met as before (Concept 4 of 6, Research 1 of 2, Design 4 of 6, Prototype 2 of 7, Production 2 of 3, Marketing 2 of 17, Sales 2 of 4). On the status page only the claims figure moved, from 0 / 9 to 0 / 39; unit cost ($64.80 at 5 units), price and margin, parts (16), open questions (5) and decisions are as they were.
