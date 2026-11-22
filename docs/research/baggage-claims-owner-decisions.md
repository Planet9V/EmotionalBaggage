# Baggage Claims MK1: the rows that need you

**Counts.** 376 of the sheet's 491 rows were not entered and are listed here; the other 115 were entered on 22 Nov 2026 (see "Entered on 22 Nov" in `baggage-claims-content-proposal.md`). (a) Conflicts between your documents: 112 (54 conflicts, and 58 rows that state one side of a conflict and wait on it). (b) Choices needed: 146. (c) Superseded by the decisions of 22 Nov, to confirm: 47. (d) Low or medium confidence, or not borne out when checked against the document: 23. (e) The product's own website platform: 48 (one question).

**How to answer.** Reply with ids and letters; anything you do not mention stays out of the app. The same rows are in `baggage-claims-owner-decisions.csv`, with an empty `answer` column.

- (a) the id and the number of the value that is right, for example `P095 2`. The rows that wait on a conflict are entered with your value once you answer; you do not need to answer them one by one.
- (b) a group code or an id, with `enter`, `leave out` or your own wording, for example `B4 enter` or `P073 leave out`.
- (c) `C confirm` drops or holds all of them as stated; or name the ids you want kept, with the wording to use.
- (d) `D enter`, `D leave out`, or ids.
- (e) `E yes` or `E no`.

How the 115 entered rows were chosen: not marked for your decision in the sheet, not a conflict, high confidence, the excerpt found in the named document, every number and quotation found in your documents, nothing about the strap, the size, colours or taglines, nothing that states one side of a conflict below, and nothing that would change a figure the app works out (unit cost, price, margin).


## (a) Conflicts between your documents (112 rows: 54 conflicts, 58 waiting on them)

Each line gives the values, numbered, with where each comes from. A recommendation is given only where one document is clearly later or more specific.

- **P082 Product name is undecided.** (1) "Baggage Claims" is the name on every Rev A document [BaggageClaims_PRD_Business_Proposal_RevA.pdf, title, page 1] (2) "Sass Case" ranked first for retail [What clever names for this ?.md, My honest ranking, line 31] (3) Domain left open between the two [BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 4, line 46] (4) Split: product "Sass Case", product line "Baggage Claims" [What clever names for this ?.md, My honest ranking, line 31]
- **P083 Three different web stacks.** (1) Shopify as system of record, with Klaviyo, Viral Loops, Supabase and Vercel [BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 27] (2) Custom Next.js 15 monolith: Postgres 16, Redis, S3, Caddy, Stripe, Prisma, Auth.js [BaggageClaims_Web_Blueprint_RevA.md, §1 System shape, line 7] (3) Next.js 16, PostgreSQL 18.7 with pgvector, no S3, Drizzle, Better Auth, Listmonk, Postiz [BaggageClaims_Web_Blueprint_RevB.md, title, line 1]
- **P084 Schema and compose files on hand are Rev A, but Rev B cites Rev B files.** (1) Rev B lists its artifacts as docker-compose.yml (Rev B) and db_schema.sql (Rev B) [BaggageClaims_Web_Blueprint_RevB.md, header, line 2] (2) The schema in the folder says Rev A, Postgres 16 [db_schema.sql, line 1, line 1] (3) The compose file in the folder says Rev A and runs postgres:16-alpine with MinIO [docker-compose.yml, line 1, line 1]
- **P085 Checkout: Shopify Payments or Stripe.** (1) Shopify Payments at 2.9% + 30c [BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 30] (2) Stripe Checkout [BaggageClaims_Web_Blueprint_RevA.md, §3.3 Purchase, line 62] (3) Stripe Checkout + webhooks [BaggageClaims_Web_Blueprint_RevB.md, §0 Version pins, line 13]
- **P086 Email tool: Klaviyo or Listmonk.** (1) Klaviyo for email and SMS, with seven lists and four flows [BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 32] (2) Klaviyo sync queue in the custom build [BaggageClaims_Web_Blueprint_RevA.md, §5 Worker queues, line 90] (3) Listmonk self-hosted, transactional mail on Resend [BaggageClaims_Web_Blueprint_RevB.md, §4 Campaigns, line 59] (4) The Hotline worker still fires a Klaviyo event [Walk through the Hotline TTS audio worker flow.md, Lifecycle, hop 8, line 20]
- **P087 Referral engine: Viral Loops or built in.** (1) Viral Loops Start-up at $49 a month, pre-launch only [BaggageClaims_Website_Platform_Plan_RevA.txt, §2 Tech stack, line 34] (2) Own referrals table, reward jobs and a rank cache in the custom build [BaggageClaims_Web_Blueprint_RevA.md, §3.1 Gate -> referral loop, line 52]
- **P088 File storage: S3 or Postgres.** (1) S3 for media, signed URLs with 15-minute TTL [BaggageClaims_Web_Blueprint_RevA.md, §7 Auth & security, line 111] (2) MinIO as local S3 in the compose file [docker-compose.yml, minio service, line 43] (3) Hotline worker uploads to an S3 bucket [Walk through the Hotline TTS audio worker flow.md, Lifecycle, hop 7, line 19] (4) S3 removed; media in a Postgres bytea table [BaggageClaims_Web_Blueprint_RevB.md, §2 Postgres file storage, line 36]
- **P089 Kickstarter target: $15k goal, 2,000 backers, or $15-20k.** (1) $15k goal [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §10 Phase 2, page 6] (2) 2,000 backers, about $48k at a $24 average (the same PRD) [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9, page 5] (3) 2,000 backers [BaggageClaims_Marketing_Playbook_RevA.txt, goal hierarchy, line 3] (4) $15-20k [I have an idea for a quick gag and potential quick.md, Road to the Quick Buck, 2, line 57] Waiting on this: P018, P066.
- **P090 First build time: about 90 minutes or about 3.5 hours.** (1) About 90 minutes [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §7 Assembly Summary, page 4] (2) About 90 minutes [BaggageClaims_DesignPackage_RevA.pdf, §3 Assembly Guide, page 5] (3) About 3.5 h hands-on plus about 5 h unattended printing [BaggageClaims_BuildGuide_RevA.md, header, line 5] (4) Electronics alone about 90 minutes in the build guide [BaggageClaims_BuildGuide_RevA.md, Phase 2 heading, line 27]
- **P091 Motion history buffer: 2 seconds or 10 seconds.** (1) 2 s ring buffer [BaggageClaims_DesignPackage_RevA.pdf, §1.1 Architecture, page 2] (2) 10 s, N_HIST=1000 [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §6 Firmware Deliverable, page 3] (3) 10 s in the sketch [Generate the Arduino sketch for the classification.md, sketch, ring buffers, line 43] **Recommended: (2)**, because the PRD and the sketch agree on 10 s, and the 8 s conveyor window cannot fit in 2 s.
- **P092 Sleep mode and sleep current.** (1) Deep sleep 30-60 uA, wake on motion interrupt or 1 s timer [BaggageClaims_DesignPackage_RevA.pdf, §1.2 U1, page 2] (2) 60 uA sleep on the power interface [BaggageClaims_DesignPackage_RevA.pdf, §2.1 IF-1, page 4] (3) 1 s light-sleep poll; deep-sleep wake is Rev B [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §6 maybeSleep, page 3] (4) Light sleep in the sketch [Generate the Arduino sketch for the classification.md, sketch, maybeSleep, line 191] (5) Acceptance limit is under 200 uA [BaggageClaims_BuildGuide_RevA.md, Phase 7, step 36, line 93] Waiting on this: P011, P218, P224, P242, P293.
- **P093 Prototype parts total: $64.80 stated, PRD table adds up to $64.34.** (1) The 16 lines of the parts list add up to $64.80 (U1 at $8.99) [BOM_shopping_list.csv, U1 row, line 2] (2) The PRD table's nine rows add up to $64.34 (9.00 + 6.99 + 5.50 + 1.75 + 2.00 + 18.60 + 11.50 + 5.00 + 4.00) but the total line says $64.80 [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §5 Bill of Materials, page 3] (3) The PRD's grouped row of small parts [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §5 Bill of Materials, page 3] Waiting on this: P001.
- **P094 Prototype column of the cost table adds up to $58.80, not $64.80.** (1) Landed COGS stated as $64.80 for one prototype [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 cost table, page 5] (2) The five priced lines are 34.30 + 3.75 + 7.05 + 5.00 + 8.70 = 58.80; labour is "(DIY)" [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 cost table, page 5] Waiting on this: P324.
- **P095 Battery count: two AA or three AA.** (1) Two AA alkaline [I have an idea for a quick gag and potential quick.md, The One Regulatory Gotcha, line 50] (2) Three AA alkaline [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §3 Power strategy, page 2] **Recommended: (2)**, because every document after the first proposal says three AA, and the parts list buys a 3xAA holder.
- **P096 Motion sensor library: Adafruit MPU6050 or raw I2C.** (1) Install Adafruit MPU6050 and DFRobotDFPlayerMini [BaggageClaims_DesignPackage_RevA.pdf, §3 Step 5, page 5] (2) Raw I2C through Wire, one library only [Generate the Arduino sketch for the classification.md, sketch header, line 10] (3) Build guide installs DFRobotDFPlayerMini only [BaggageClaims_BuildGuide_RevA.md, Phase 4, step 18, line 62] **Recommended: (2)**, because the build guide and the sketch are later and agree: one library, raw I2C.
- **P097 Low-pass filter: 42 Hz or 44 Hz.** (1) 42 Hz bandwidth [BaggageClaims_DesignPackage_RevA.pdf, §2.3 register usage, page 4] (2) 44 Hz [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §3.1 Sensing, page 2] (3) 44 Hz in the sketch [Generate the Arduino sketch for the classification.md, sketch, mpuInit, line 73] Waiting on this: P009, P222.
- **P098 Expected boot log differs in three documents.** (1) "CAL OK" then "SLEEP" [BaggageClaims_DesignPackage_RevA.pdf, §3 Step 5, page 5] (2) "CAL OK g=(0.00,0.00,1.00)" then "DF OK" then "IDLE" [BaggageClaims_BuildGuide_RevA.md, Phase 4, step 21, line 66] (3) The sketch prints CAL OK, DF OK and later "SLEEP 1s"; it never prints "IDLE" [Generate the Arduino sketch for the classification.md, sketch, maybeSleep, line 189] Waiting on this: P225, P280.
- **P099 Weigh-in: how long the bag must be still.** (1) 2-3 seconds [I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 2, line 21] (2) 3.5-6 s at +0.8-1.2 m height after a 1.2-2.0 m/s lift [BaggageClaims_DesignPackage_RevA.pdf, §1.4 WEIGH_IN, page 2] (3) 3.5-6 s in the sketch, with no lift-speed or height check [Generate the Arduino sketch for the classification.md, sketch, tunables, line 25] **Recommended: (2)**, because the design package and the sketch are later and more specific than the first proposal. Waiting on this: P208.
- **P100 Free-fall duration: over 0.3 s or at least 0.28 s.** (1) Over 0.3 s of near-zero g [I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 7, line 26] (2) At least 0.28 s below 0.15 g [BaggageClaims_DesignPackage_RevA.pdf, §1.4 FREEFALL, page 2] **Recommended: (2)**, because the design package is later and gives the threshold the sketch uses (FREEFALL_MIN_MS 280). Waiting on this: P210.
- **P101 Carousel: how it is recognised and for how long.** (1) Circular and periodic motion for about 30 seconds or more [I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 4, line 23] (2) Gyro Z sinusoid plus centripetal acceleration, over 25 s, period 3-12 s [BaggageClaims_DesignPackage_RevA.pdf, §1.4 CAROUSEL, page 3] (3) Three sign changes of one gyro axis, 3-12 s apart; no duration floor, no centripetal check [Generate the Arduino sketch for the classification.md, sketch, tunables, line 30] (4) The sketch reads the middle gyro register and calls it gz_ [Generate the Arduino sketch for the classification.md, Two honest caveats, 1, line 222] Waiting on this: P211.
- **P102 Conveyor: "100-400 Hz" band against a 100 Hz sample rate.** (1) Variance in a 100-400 Hz band for over 8 s [BaggageClaims_DesignPackage_RevA.pdf, §1.4 CONVEYOR, page 3] (2) The sensor is sampled at 100 Hz behind a 42 Hz filter [BaggageClaims_DesignPackage_RevA.pdf, §2.3 register usage, page 4] (3) The sketch uses the variance of acceleration magnitude over 8 s, between 0.015 and 0.5, with no rotation [Generate the Arduino sketch for the classification.md, sketch, tunables, line 31] Waiting on this: P212.
- **P103 Handle grab: the rule differs.** (1) Sustained tilt plus steady carry acceleration, "carry-mode 10-90 s" [BaggageClaims_DesignPackage_RevA.pdf, §1.4 HANDLE_GRAB, page 2] (2) Tilt between 25 and 75 degrees while moving for 10 s [Generate the Arduino sketch for the classification.md, sketch, tunables, line 27] (3) Lifted and carried by the handle after idle [I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 3, line 22] Waiting on this: P209.
- **P104 Inverted: the rule differs.** (1) Within 0.1 g of minus 1 g on the z axis, for over 4 s [BaggageClaims_DesignPackage_RevA.pdf, §1.4 INVERTED, page 3] (2) z acceleration below minus 0.9 g for 4 s (no upper bound) [Generate the Arduino sketch for the classification.md, sketch, tunables, line 32] (3) Tilted past about 90 degrees [I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 6, line 25] Waiting on this: P213.
- **P105 Hard impact of 8-14 g against a sensor range of +/-8 g.** (1) Impact threshold window 8-14 g peak, under 50 ms [BaggageClaims_DesignPackage_RevA.pdf, §1.4 HARD_IMPACT, page 2] (2) Sensor range set to +/-8 g, said to cover drop peaks [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §3.1 Sensing, page 2] (3) The sketch fires when the magnitude passes 8.0 g [Generate the Arduino sketch for the classification.md, sketch, tunables, line 23] (4) Functional shock spec 14 g, survival 40 g [BaggageClaims_DesignPackage_RevA.pdf, §2.4, page 4] Waiting on this: P207, P230.
- **P106 Gag lines are worded differently between documents.** (1) PRD wording of the dark-idle line [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §8 row 8, page 5] (2) Design package wording of the same line [BaggageClaims_DesignPackage_RevA.pdf, §1.4 DARK_IDLE, page 3] (3) Launch video wording [BaggageClaims_LaunchVideo_Script_RevA.txt, Act 2, 1:10, line 39] (4) First proposal's handle line has a lead-in the PRD drops [I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 3, line 22] (5) First proposal's inverted line [I have an idea for a quick gag and potential quick.md, Ranked Gag Catalog, rank 6, line 25] (6) PRD inverted line [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §8 row 7, page 5] Waiting on this: P214.
- **P108 Enclosure print: mass and cost differ.** (1) About 90 g, $5.00 [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §5 Bill of Materials, page 3] (2) About 100 g, about $2 a unit (two halves plus mid-plate) [Can I do a 3d printer for this integrated - if so.md, Level 1, line 19] (3) About 62 g, 4-5 h (print-in-place clamshell) [BaggageClaims_BuildGuide_RevA.md, Phase 1, step 8, line 22] (4) $5.00 line for 250 g of PETG at about $20 a kg [BOM_shopping_list.csv, ENC1 row, line 16]
- **P109 Enclosure design: two-piece shell with mid-plate, or print-in-place clamshell.** (1) Two-piece PETG, mid-plate on M2 standoffs [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §4 Enclosure, page 3] (2) Bottom shell plus top shell [BaggageClaims_DesignPackage_RevA.pdf, §3 Step 1, page 5] (3) Print-in-place clamshell STL [BaggageClaims_BuildGuide_RevA.md, Phase 1, step 5, line 16] (4) The 3D printing note calls the clamshell the recommended target [Can I do a 3d printer for this integrated - if so.md, Level 2, line 21] Waiting on this: P274, P275, P276, P277, P278, P300.
- **P110 Hinge test coupon: sizes and print time differ.** (1) Pins 1.3 / 1.4 / 1.5 mm against bores 1.7 / 1.8 / 1.9 mm, 45 minutes [BaggageClaims_BuildGuide_RevA.md, Phase 1, step 6, line 19] (2) Pins at 0.20 / 0.25 / 0.30 / 0.35 mm clearance, a 15-minute print [Can I do a 3d printer for this integrated - if so.md, Level 2 design rules, line 26] (3) Rule of 0.3-0.4 mm per side for PETG [Can I do a 3d printer for this integrated - if so.md, Level 2 design rules, line 23] Waiting on this: P264, P272.
- **P111 Cost at 1,000 units: under $8, $4-6, or $19.00.** (1) Under 8 USD at 1k volume [BaggageClaims_DesignPackage_RevA.pdf, product summary, page 1] (2) Roughly $4-6 [I have an idea for a quick gag and potential quick.md, Hardware and Build Cost, line 44] (3) $19.00 landed [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 note, page 5] (4) Toward about $15 after further compression [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 note, page 5] Waiting on this: P003, P157, P326.
- **P112 Prototype parts cost: $10-15 or $64.80.** (1) A "~$6-in-parts" gadget; hobbyist parts around $10-15 [I have an idea for a quick gag and potential quick.md, first paragraph, line 5] (2) $64.80 for one prototype [Create a PRD for this with arch instructions bom a.md, Headline economics, line 11] **Recommended: (2)**, because $64.80 is the itemised parts list; $10-15 was the first proposal's estimate before any part was chosen.
- **P113 "EV batch": 5 units, 20 units or 100 units, and its cost target.** (1) 5-unit engineering validation batch [BaggageClaims_PRD_Business_Proposal_RevA.pdf, Ask, page 1] (2) 100-unit EV batch at $43.20 landed [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 cost table, page 5] (3) 100-unit EV batch must come in under $22 COGS (Rev B exit) [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §11 Roadmap, page 6] (4) 20 EV units for creators, about $1.3k [BaggageClaims_Marketing_Playbook_RevA.txt, Budget rollup, line 130] Waiting on this: P014, P315, P325, P335, P336.
- **P114 SPI flash audio: Rev B or Rev C.** (1) Rev B scope [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §11 Roadmap, page 6] (2) Rev C [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §12 Risks, page 6]
- **P115 Marketing budget: $5k reserve or about $4,500, and creator seeding $3k or $1,300.** (1) $3k creator seeding plus $2k paid amplification [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §10 Content cost, page 6] (2) Playbook header repeats $3k and $2k [BaggageClaims_Marketing_Playbook_RevA.txt, header, line 5] (3) Playbook rollup: creator seeding $1,300 [BaggageClaims_Marketing_Playbook_RevA.txt, Budget rollup, line 130] (4) Playbook rollup total about $4,500, with no $2k amplification line [BaggageClaims_Marketing_Playbook_RevA.txt, Budget rollup, line 135]
- **P116 Cost to win a customer: under $8 or kill above $10.** (1) CAC under $8 [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §13 Success Metrics, page 6] (2) Kill the retargeting test if CAC is over $10 [BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 8, line 104]
- **P117 Shame Ads test: $500 or five dollars.** (1) $500 test [BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 8, line 104] (2) "Five-dollar-test" [Develop clever marketing campaigns for this hilari.md, Stage 3, 8, line 27] **Recommended: (1)**, because the playbook itself says $500; "five-dollar" is the chat summary of it.
- **P118 Email list targets: 500, 2,000 or 3,000.** (1) 500 signups passes the Phase 1 gate [BaggageClaims_Marketing_Playbook_RevA.txt, goal hierarchy, line 2] (2) Over 2,000 emails before launch green-lights the 1,000-unit run [BaggageClaims_Marketing_Playbook_RevA.txt, Kill criteria, line 138] (3) 3,000 emails before the Kickstarter launch (campaign 5 KPI) [BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 5, line 64] (4) Website plan: 500+ emails before further web spend [BaggageClaims_Website_Platform_Plan_RevA.txt, §8 Phase W1, line 202]
- **P119 Early-bird price: $19 or $19.95.** (1) $19 [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §9 pricing ladder, page 5] (2) $19.95 [I have an idea for a quick gag and potential quick.md, Road to the Quick Buck, 2, line 57] **Recommended: (1)**, because the PRD and the playbook are later than the first proposal and agree on $19.
- **P120 "First Class" names three different things.** (1) The New Yorker voice pack [What clever names for this ?.md, Tier-able name system, line 29] (2) The $49 collector Kickstarter tier [BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 7, line 87] (3) The 25-referral group on the Departure Board [BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 5, line 62] (4) The naming note calls the $49 edition "Black Card" instead [What clever names for this ?.md, Tier-able name system, line 29] Waiting on this: P046, P047, P048, P415.
- **P121 Hotline prize: weekly or monthly.** (1) Monthly best complaint wins a free unit [BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 4, line 53] (2) "Complaint of the Week", monthly winner gets a free unit [BaggageClaims_Website_Platform_Plan_RevA.txt, §4.3 Hotline, line 90] Waiting on this: P414.
- **P122 In the hold: performing or switched off.** (1) Unrestricted in checked baggage [BaggageClaims_DesignPackage_RevA.pdf, product summary, page 1] (2) "Can legally perform in the hold" [Build me the low level design , inter interface co.md, The compliance hinge, line 18] (3) Compliance card tells the owner to switch it OFF before checking [BaggageClaims_BuildGuide_RevA.md, Phase 8, step 38, line 98] (4) Video footer: switch OFF before checking, in a video whose gags happen in the hold [BaggageClaims_LaunchVideo_Script_RevA.txt, Legal footers, line 83] (5) PRD risk mitigation: carry-on mode in marketing [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §12 Risks, page 6] Waiting on this: P027, P139, P162, P232, P250, P354, P355.
- **P123 Schema: "14 tables" stated, 13 in the file; two tables the designs use are missing.** (1) 14 tables and 5 enums [BaggageClaims_Web_Blueprint_RevA.md, §6 Database, line 96] (2) The file creates 13 tables; the last is events [db_schema.sql, events table, line 98] (3) Blueprint relies on a processed_events table that the file does not create [BaggageClaims_Web_Blueprint_RevA.md, §7 Auth & security, line 113] (4) Hotline worker requires a render_status column that claim_tickets does not have [Walk through the Hotline TTS audio worker flow.md, Lifecycle, hop 3, line 15]
- **P124 Compose file details that do not match the other files.** (1) The compose file mounts ./db/schema.sql [docker-compose.yml, db service, line 30] (2) The blueprint names the file db_schema.sql [BaggageClaims_Web_Blueprint_RevA.md, header, line 2] (3) Compose comment lists four worker queues [docker-compose.yml, worker service, line 20] (4) Blueprint lists seven queues including a dead-letter queue [BaggageClaims_Web_Blueprint_RevA.md, §5 Worker queues, line 92]
- **P125 Rev B says four databases and names three.** (1) "4 DBs: bagclaims, listmonk, postiz" [BaggageClaims_Web_Blueprint_RevB.md, §7 Compose Rev B, line 85]
- **P126 Sketch length: 262 lines stated, about 203 pasted.** (1) 262 lines [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §6 Firmware Deliverable, page 3] (2) "Reproduced below" in the chat, where the code block runs from line 8 to line 209 of the file [Generate the Arduino sketch for the classification.md, first paragraph, line 5]
- **P127 Low-battery warning: specified, but not in the Rev A hardware or sketch.** (1) Below 3.3 V pack: play the rasp once, then sleep [BaggageClaims_DesignPackage_RevA.pdf, §1.5, page 3] (2) The battery ADC divider is Rev B hardware [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §6 Rev A caveats, page 3] (3) The sketch defines the clip number and never plays it [Generate the Arduino sketch for the classification.md, sketch, clip map, line 40] Waiting on this: P226.
- **P128 Boot calibration: 2 seconds or 1 second.** (1) CALIBRATE takes a 2 s gravity vector [BaggageClaims_DesignPackage_RevA.pdf, §1.5, page 3] (2) The sketch averages 100 samples 10 ms apart [Generate the Arduino sketch for the classification.md, sketch, calibrate, line 117]
- **P129 Motion interrupt pin: open-drain pulse or latched.** (1) Motion interrupt, open-drain [BaggageClaims_DesignPackage_RevA.pdf, §2.3 register usage, page 4] (2) Active-high pulse [BaggageClaims_DesignPackage_RevA.pdf, §2.1 IF-5, page 4] (3) Latched [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §4 pin table, page 3] (4) The sketch sets latched mode [Generate the Arduino sketch for the classification.md, sketch, mpuInit, line 76]
- **P130 The ask: about $750, but its two parts add up to $700.** (1) About $750 [BaggageClaims_PRD_Business_Proposal_RevA.pdf, Ask, page 1] (2) Chat summary: about $750 to build the batch and film one video [Create a PRD for this with arch instructions bom a.md, The decision gate that matters, line 27] Waiting on this: P313, P329, P334.
- **P131 Clip file naming: 001.mp3 or 0001.mp3.** (1) 001.mp3 naming [BOM_shopping_list.csv, SD1 row, line 12] (2) 0001.mp3 upward [BaggageClaims_DesignPackage_RevA.pdf, §3 Step 4, page 5] **Recommended: (2)**, because the design package, the build guide and the sketch all use four digits; only the parts list note says 001. Waiting on this: P227, P253, P281.
- **P132 Bambu Lab A1: two different Micro Center product numbers.** (1) SKU 660886 in the text [Can I do a 3d printer for this integrated - if so.md, The printer: Bambu Lab A1, line 9] (2) Product 676237 in the cited address [Can I do a 3d printer for this integrated - if so.md, footnote 1, line 46]
- **P133 Enclosure saving: "from about $11.50" does not match the parts list.** (1) Enclosure plus mounting falls from about $11.50 to about $2-3 [Can I do a 3d printer for this integrated - if so.md, after the material table, line 38] (2) In the PRD, $11.50 is the perfboard, standoffs, screws, foam and zip ties row; the enclosure is a separate $5.00 [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §5 Bill of Materials, page 3] (3) The note also says the print replaces a $5 project box [Can I do a 3d printer for this integrated - if so.md, Level 1, line 19]
- **P134 Ingress rating written as "IP424".** (1) "IP424 splash ingress via speaker-grille hydrophobic mesh" [BaggageClaims_DesignPackage_RevA.pdf, §2.4, page 4]
- **P135 Kickstarter "aimed at Q4 gifting" against the document's own dates.** (1) Kickstarter in weeks 4-12, aimed at Q4 gifting [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §10 Phase 2, page 6] (2) The PRD is dated 19 Nov 2026 [BaggageClaims_PRD_Business_Proposal_RevA.pdf, front page, page 1] (3) The 1,000-unit Kickstarter fulfilment run is in months 4-6 [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §11 Roadmap, page 6] Waiting on this: P316.
- **P136 Creator programme: 3-5 creators at 10-20%, or 20 creators at 10%.** (1) 3-5 mid-size travel comedians at 10-20% revenue share [BaggageClaims_PRD_Business_Proposal_RevA.pdf, §10 Phase 2, page 6] (2) 20 units to creators, affiliate code worth 10% of pledged value [BaggageClaims_Marketing_Playbook_RevA.txt, Campaign 3, line 36] (3) Website plan: creator codes with a 10% payout [BaggageClaims_Website_Platform_Plan_RevA.txt, §5.1 Affiliates, line 137]

Rows waiting on a conflict (each states one of the values above as fact):

| id | waits on | section | title |
|---|---|---|---|
| P001 | P093 | `concept/story` | Decided and still open: the parts list sentence |
| P003 | P111 | `concept/brief` | Why now |
| P009 | P097 | `concept/brief` | How it works |
| P011 | P092 | `concept/brief` | Power strategy |
| P014 | P113 | `concept/brief` | The ask and the gate |
| P018 | P089 | `concept/brief` | Success metrics: phase gate and launch |
| P027 | P122 | `concept/faq` | Will TSA confiscate it? |
| P046 | P120 | `concept/names` | Voice pack ladder: Coach, Premium Sass, First Class |
| P047 | P120 | `concept/names` | Black Card: Checked & Offended Edition |
| P048 | P120 | `concept/names` | Kickstarter tier names: Checked, Carry-On, Overhead Bin, First Class, The Whole Cargo Hold |
| P066 | P089 | `concept/decisions` | If Kickstarter runs: which goal? |
| P139 | P122 | `research/claims` | FAA PackSafe requires lithium devices in checked bags to be fully off; alkaline AA cells face no such restriction |
| P157 | P111 | `research/claims` | Gag gifts retail well at $19.95 to $24.95, a 3-4x margin over parts |
| P162 | P122 | `research/claims` | Airlines have a "lithium-device handling policy" that the compliance card can cite for an alkaline device |
| P207 | P105 | `design/requirements` | Detect: Hard impact |
| P208 | P099 | `design/requirements` | Detect: Weigh-in |
| P209 | P103 | `design/requirements` | Detect: Handle grab |
| P210 | P100 | `design/requirements` | Detect: Free-fall |
| P211 | P101 | `design/requirements` | Detect: Carousel |
| P212 | P102 | `design/requirements` | Detect: Conveyor |
| P213 | P104 | `design/requirements` | Detect: Inverted |
| P214 | P106 | `design/requirements` | Detect: Dark idle |
| P218 | P092 | `design/requirements` | Power |
| P222 | P097 | `design/requirements` | Sensor configuration |
| P224 | P092 | `design/requirements` | Firmware state machine |
| P225 | P098 | `design/requirements` | Boot calibration |
| P226 | P127 | `design/requirements` | Low battery |
| P227 | P131 | `design/requirements` | Audio content format |
| P230 | P105 | `design/requirements` | Environment |
| P232 | P122 | `design/requirements` | Battery chemistry and the compliance card |
| P242 | P092 | `design/wiring` | Motion interrupt |
| P250 | P122 | `design/bom` | Batteries (BAT) |
| P253 | P131 | `design/bom` | Storage (SD1) |
| P264 | P110 | `prototype/printing` | Hinge clearance coupon |
| P272 | P110 | `prototype/assembly` | Phase 1 - Print the enclosure |
| P274 | P109 | `prototype/assembly` | Phase 2, step 10 - Power rail (do first, test before anything else) |
| P275 | P109 | `prototype/assembly` | Phase 2, step 11 - Motion sensor on I2C |
| P276 | P109 | `prototype/assembly` | Phase 2, step 12 - Audio module, UART and speaker |
| P277 | P109 | `prototype/assembly` | Phase 2, step 13 - Mode button |
| P278 | P109 | `prototype/assembly` | Phase 2, step 14 - Dress the wires and check every net |
| P280 | P098 | `prototype/assembly` | Phase 4 - Firmware |
| P281 | P131 | `prototype/assembly` | Phase 5 - Audio |
| P293 | P092 | `prototype/tests` | Sleep current |
| P300 | P109 | `prototype/tests` | Hinge and latch |
| P313 | P130 | `prototype/builds` | Validation batch - 5 units |
| P315 | P113 | `prototype/builds` | Rev B - custom PCB |
| P316 | P135 | `prototype/builds` | Rev C - 1,000-unit Kickstarter fulfillment run |
| P324 | P094 | `production/economics` | Prototype |
| P325 | P113 | `production/economics` | Engineering validation batch |
| P326 | P111 | `production/economics` | Production run |
| P329 | P130 | `production/economics` | Validation batch tooling |
| P334 | P130 | `production/batches` | A - Validation |
| P335 | P113 | `production/batches` | B - Creator seeding units |
| P336 | P113 | `production/batches` | EV batch - 100 units |
| P354 | P122 | `production/compliance` | Batteries in checked baggage (FAA PackSafe) |
| P355 | P122 | `production/compliance` | Compliance card wording |
| P414 | P121 | `marketing/landing` | Lost Baggage Hotline |
| P415 | P120 | `marketing/landing` | Departure Board |

## (b) Choices needed (146 rows)


### B1 (11 rows). Would change the unit cost the app works out, or is not one number (a range, or one amount per volume).

Answer `B1 enter` or `B1 leave out`, or by id.

| id | section | title |
|---|---|---|
| P247 | `design/bom` | All 16 parts: unit price and speed option |
| P331 | `production/economics` | Printed enclosure, filament |
| P333 | `production/economics` | Kickstarter preparation |
| P346 | `production/methods` | Enclosure, prototype: FDM print |
| P347 | `production/methods` | Enclosure, 100 units: print farm |
| P348 | `production/methods` | Enclosure, 1,000 units: soft tooling |
| P349 | `production/methods` | Enclosure, 10,000 units: injection molding |
| P350 | `production/methods` | Electronics, prototype: hand-wired perfboard with socketed modules |
| P351 | `production/methods` | Electronics, from Rev B: custom PCB, turnkey assembly |
| P352 | `production/methods` | Assembly and test: hand assembly |
| P353 | `production/methods` | Voice pack: microSD duplication |

### B2 (14 rows). Prices and channel fees: entering them changes the price and margin the status page shows, and their margins are worked at the 10,000-unit cost.

Answer `B2 enter` or `B2 leave out`, or by id.

| id | section | title |
|---|---|---|
| P382 | `marketing/pricing` | Kickstarter early bird "Checked" - $19 |
| P383 | `marketing/pricing` | Kickstarter standard "Carry-On" - $24 |
| P384 | `marketing/pricing` | Two-pack "Overhead Bin" - $34 |
| P385 | `marketing/pricing` | Collector "First Class" - $49 |
| P386 | `marketing/pricing` | Four-pack "The Whole Cargo Hold" - $99 |
| P387 | `marketing/pricing` | Desk-only "Gate Agent Special" - $18 |
| P388 | `marketing/pricing` | Own store and TikTok Shop - $24.95 |
| P389 | `marketing/pricing` | Amazon FBA - $27.95 |
| P390 | `marketing/pricing` | Wholesale - $14.50, MSRP $29.95 |
| P391 | `marketing/pricing` | Voice pack - $7.99 |
| P392 | `marketing/pricing` | Pricing assumptions |
| P466 | `sales/channels` | Wholesale (airport / gift retail) |
| P467 | `sales/channels` | Kickstarter bundles and collector tier |
| P468 | `sales/channels` | Voice packs (add-on and store) |

### B3 (13 rows). Campaign and ad fields (objective, budget, target, stop rule) are the reviewer's reading of the playbook's prose.

Answer `B3 enter` or `B3 leave out`, or by id.

| id | section | title |
|---|---|---|
| P424 | `marketing/ads` | The three Shame Ads: stop rule as numbers |
| P427 | `marketing/campaigns` | Kill and scale criteria (whole plan) |
| P428 | `marketing/campaigns` | 1 - The Four Gates |
| P429 | `marketing/campaigns` | 2 - @TheBagComplains |
| P430 | `marketing/campaigns` | 3 - 100 Bags, 100 Reactions |
| P431 | `marketing/campaigns` | 4 - The Lost Baggage Hotline |
| P432 | `marketing/campaigns` | 5 - The Departure Board |
| P433 | `marketing/campaigns` | 6 - The Complaint Desk |
| P434 | `marketing/campaigns` | 7 - Kickstarter page |
| P435 | `marketing/campaigns` | 8 - The Shame Ads |
| P436 | `marketing/campaigns` | 9 - Platinum Status |
| P437 | `marketing/campaigns` | 10 - Wholesale Trojan |
| P438 | `marketing/campaigns` | PRD Phase 3 - Always-on |

### B4 (11 rows). Compliance rows: the reason is from your documents, the check to carry out is the reviewer's wording.

Answer `B4 enter` or `B4 leave out`, or by id.

| id | section | title |
|---|---|---|
| P356 | `production/compliance` | UN38.3 battery transport testing |
| P357 | `production/compliance` | FCC Part 15, unintentional radiator |
| P358 | `production/compliance` | Loudness |
| P359 | `production/compliance` | Voice rights and releases |
| P360 | `production/compliance` | Filming at an airport |
| P361 | `production/compliance` | Trademark and design patent |
| P362 | `production/compliance` | Kickstarter prototype disclosure |
| P363 | `production/compliance` | Privacy: GDPR and CCPA |
| P364 | `production/compliance` | Minors and user submissions |
| P365 | `production/compliance` | Website accessibility |
| P366 | `production/compliance` | Recall and safety contact |

### B5 (4 rows). Batch and supplier rows that name a build, a home city or a row that is not a batch.

Answer `B5 enter` or `B5 leave out`, or by id.

| id | section | title |
|---|---|---|
| P337 | `production/batches` | C - First production run |
| P338 | `production/batches` | Retail run - 10,000 units |
| P339 | `production/batches` | Units promised by caps and stunts |
| P340 | `production/suppliers` | Micro Center |

### B6 (3 rows). A status or scope the sheet chose (a rejected name; a line added to every finalist; a statement about all documents).

Answer `B6 enter` or `B6 leave out`, or by id.

| id | section | title |
|---|---|---|
| P041 | `concept/names` | The Mouthful |
| P062 | `concept/names` | Screening still owed on every name |
| P078 | `concept/questions` | Primary sales channel |

### B0 (90 rows). Marked for your decision in the sheet

The last column is the sheet's own reason. Answer by id: `enter`, `leave out`, or the wording to use.

| id | section | title | what needs deciding |
|---|---|---|---|
| P020 | `concept/brief` | Risk: lithium-in-checked-bags optics (High) | no risk section; brief or open questions |
| P021 | `concept/brief` | Risk: annoyance and airline complaints (Medium) | no risk section; brief or open questions |
| P022 | `concept/brief` | Risk: imitators (Medium) | no risk section; brief or open questions |
| P023 | `concept/brief` | Risk: voice rights and publicity claims (Medium) | no risk section; brief or open questions |
| P024 | `concept/brief` | Risk: seasonality, Q4-heavy (Low-Med) | no risk section; brief or open questions |
| P025 | `concept/brief` | Risk: single-source codec clones (Low) | no risk section; brief or open questions |
| P063 | `concept/decisions` | Which name ships? | adds an option |
| P068 | `concept/decisions` | Which 3D printer? | purchase |
| P069 | `concept/decisions` | Rev A sleep: light-sleep poll or deep sleep with interrupt wake? | firmware direction |
| P070 | `concept/decisions` | Audio storage: microSD or SPI flash, and in which revision? | roadmap |
| P071 | `concept/decisions` | Stretch gags: overhead-bin shake and scanner beep | scope |
| P072 | `concept/decisions` | Who records the first clips? | content plan |
| P073 | `concept/decisions` | Sensor mount: mid-plate on standoffs or printed posts? | mechanical design |
| P074 | `concept/decisions` | Creator terms: how many, and what share? | commercial terms |
| P075 | `concept/decisions` | Collector tier: capped at 100 or uncapped? | tier design |
| P076 | `concept/decisions` | Dark idle: add a light sensor? | optional hardware |
| P028 | `concept/faq` | Can it ride in a checked bag? | question wording is mine |
| P029 | `concept/faq` | Will it annoy everyone around me? | question wording is mine |
| P030 | `concept/faq` | Does it need an app or pairing? | question wording is mine |
| P031 | `concept/faq` | How long do the batteries last? | question wording is mine |
| P032 | `concept/faq` | Can I change what it says or how loud it is? | question wording is mine |
| P033 | `concept/faq` | What does it react to? | question wording is mine |
| P034 | `concept/faq` | FAQ house style: the Complaint Department | house style for support |
| P045 | `concept/names` | Sass Case (product) with Baggage Claims (product line) | is a split name wanted |
| P026 | `concept/press` | Press angles on file (no release has been written) | no release exists; only angles |
| P079 | `concept/questions` | Is there an EU or Dutch audience at launch? | audience |
| P080 | `concept/questions` | Who writes and records the lines, and how many are needed? | nothing is written |
| P081 | `concept/questions` | How does a unit get its serial number? | nothing is written |
| P257 | `design/bom` | M2 self-tapping screws | not on the parts list |
| P258 | `design/bom` | Printed mid-plate | not on the parts list |
| P259 | `design/bom` | Hydrophobic mesh for the speaker grille | not on the parts list |
| P261 | `design/bom` | Field kit: spare AAs and a tiny screwdriver | not on the parts list |
| P262 | `design/bom` | Consumables: solder, hot glue, optional 3M VHB pad | consumables |
| P215 | `design/requirements` | Detect: Overhead-bin stuffing (stretch) | stretch scope |
| P216 | `design/requirements` | Detect: Scanner or scale beep by microphone (stretch) | stretch scope |
| P237 | `design/requirements` | Rev B hardware scope | Rev B scope |
| P239 | `design/wiring` | Battery negative to ground | two wordings |
| P246 | `design/wiring` | Schematic image: what it shows and what it leaves out | check the drawing |
| P425 | `marketing/ads` | Amplified unbranded clip (whichever passes 50k views in 72 h) | paid amplification creative |
| P454 | `marketing/announce` | Welcome sequence (three emails, in character) | no email copy exists |
| P455 | `marketing/announce` | Hotline reveal email | no email copy exists |
| P456 | `marketing/announce` | Post-purchase sequence | no email copy exists |
| P457 | `marketing/announce` | Launch-day email to the list | no email copy exists |
| P458 | `marketing/announce` | Wholesale follow-up sequence | no email copy exists |
| P459 | `marketing/announce` | Press note | no press note exists |
| P426 | `marketing/campaigns` | Marketing plan and budget | which total is right |
| P373 | `marketing/competitors` | Novelty sound gadgets on Etsy and eBay | no competitor research exists |
| P374 | `marketing/competitors` | A Bluetooth speaker | no competitor research exists |
| P375 | `marketing/competitors` | Another candle (any $20-30 gift) | no competitor research exists |
| P376 | `marketing/competitors` | Doing nothing; imitators after launch | no competitor research exists |
| P411 | `marketing/imagery` | Exploded 3D view and schematic | files are missing |
| P439 | `marketing/launch` | Launch: unbranded clips (Phase 1 gate) | no dates in the documents |
| P440 | `marketing/launch` | Launch: Kickstarter | no dates in the documents |
| P446 | `marketing/links` | Links and QR codes the plans call for | hosts and codes are not fixed |
| P372 | `marketing/personas` | The audience that never pays: handlers and bystanders | an audience, not a buyer |
| P453 | `marketing/social` | Recurring posts the plans call for (no copy written) | no text exists |
| P367 | `production/compliance` | Product safety and labelling for a battery-powered novelty | not addressed in any document |
| P318 | `production/economics` | Electronics (PCB + PCBA + parts) | the section has one amount per line, the PRD has four volumes |
| P319 | `production/economics` | Speaker + storage | one amount per line against four volumes |
| P320 | `production/economics` | Battery holder, switches, hardware | one amount per line against four volumes |
| P321 | `production/economics` | Enclosure | one amount per line against four volumes |
| P323 | `production/economics` | Assembly & test labor | one amount per line against four volumes |
| P330 | `production/economics` | 3D printer | capital, not unit cost |
| P342 | `production/suppliers` | Turnkey PCB assembly house (not chosen) | no supplier is named |
| P343 | `production/suppliers` | Voice actor (not chosen) | no supplier is named |
| P344 | `production/suppliers` | Enclosure tooling: print farm, soft tooling, injection molder (not chosen) | no supplier is named |
| P345 | `production/suppliers` | Fulfilment partner (3PL, not chosen) | no supplier is named |
| P298 | `prototype/tests` | Boot log | which boot log is right |
| P302 | `prototype/tests` | Calibration drops at three heights | no pass condition in the documents |
| P303 | `prototype/tests` | Free-fall | no procedure in the documents |
| P304 | `prototype/tests` | Carousel | no procedure in the documents |
| P305 | `prototype/tests` | Conveyor | no procedure in the documents |
| P306 | `prototype/tests` | Inverted | no procedure in the documents |
| P307 | `prototype/tests` | Governor | no procedure in the documents |
| P308 | `prototype/tests` | Controls | no procedure in the documents |
| P309 | `prototype/tests` | Loudness | no procedure in the documents |
| P310 | `prototype/tests` | Shock survival and drop tests (Rev B exit) | no procedure in the documents |
| P311 | `prototype/tests` | Idle false positives | no procedure in the documents |
| P164 | `research/claims` | The Wilhelm scream can be used as a product sound and in the launch video | rights not addressed in any document |
| P202 | `research/claims` | Three AA alkaline cells last 3-6 months | a bench measurement, not research |
| P203 | `research/claims` | The hard-impact gag is detected 100% of the time | a bench measurement, not research |
| P204 | `research/claims` | A foam or loose sensor mount destroys the jerk signatures the classifier depends on | a bench measurement, not research |
| P205 | `research/claims` | A 1 kOhm series resistor on the DFPlayer RX line stops random triggers | a bench check, not research |
| P206 | `research/claims` | One Hotline worker renders about 120 clips a minute at concurrency 4 | a load test, not research |
| P462 | `sales/channels` | Amazon FBA | fee is a range |
| P463 | `sales/channels` | Kickstarter early bird | fee is a range |
| P464 | `sales/channels` | Kickstarter standard | fee is a range |
| P465 | `sales/channels` | DTC site / TikTok Shop | two channels in one row |
| P469 | `sales/channels` | Creator affiliate codes | cost of creator codes |
| P470 | `sales/channels` | Licensing to luggage brands | not priced |

## (c) Superseded by the decisions of 22 Nov: confirm (47 rows)

The gadget is a tag on a loop with a name card and a tracker pocket; the envelope is 80 x 60 x 42 mm; the design direction, colours and tagline are being chosen. None of these rows was entered. `C confirm` leaves them out; name any you want kept and the wording to use.


**Describes the strap mounting or the puck; superseded by the tag decision. Confirm the wording (or drop it).** (19)

| id | section | title |
|---|---|---|
| P012 | `concept/brief` | Form and first principles (first proposal) |
| P015 | `concept/brief` | Road to the quick buck (first proposal) |
| P064 | `concept/decisions` | Which enclosure build? |
| P220 | `design/requirements` | Enclosure |
| P260 | `design/bom` | Printed items in the box: compliance card, luggage tag, frequent-flyer card |
| P263 | `design/enclosure` | Enclosure settings the documents do state |
| P265 | `prototype/printing` | Print-in-place clamshell |
| P267 | `prototype/printing` | One-piece TPU boot (Level 3) |
| P282 | `prototype/assembly` | Phase 6 - Integration |
| P283 | `prototype/assembly` | Phase 8 - Pack-out |
| P285 | `prototype/assembly` | Gyro axis check on a turntable |
| P301 | `prototype/tests` | Strap fit |
| P322 | `production/economics` | Strap + packaging + booklet |
| P341 | `production/suppliers` | Amazon |
| P377 | `marketing/positioning` | Positioning |
| P380 | `marketing/positioning` | Two markets: checked bag and carry-on |
| P398 | `marketing/imagery` | Device close-up and inserts |
| P407 | `marketing/imagery` | Safety card, six frames |
| P461 | `sales/listing` | Amazon listing not started |

**Carries a tagline or text on the product; taglines are being chosen now.** (18)

| id | section | title |
|---|---|---|
| P037 | `concept/names` | Emotional Baggage |
| P051 | `concept/names` | Now available as literal luggage. |
| P052 | `concept/names` | the suitcase that talks back |
| P053 | `concept/names` | It's the Furby of luggage. |
| P054 | `concept/names` | AA-powered. No lithium. Airline-legit. |
| P055 | `concept/names` | AA POWER - checked-bag legal. No lithium, no drama. |
| P056 | `concept/names` | Because somebody at the airport should be honest about what's happening to your stuff. |
| P057 | `concept/names` | the only product in your store that demos itself to people who are already mad about bags. |
| P058 | `concept/names` | the world's sassiest suitcase |
| P059 | `concept/names` | CHECK MY BAG IN |
| P060 | `concept/names` | $24.95 - UNDER THE LIMIT |
| P061 | `concept/names` | Your bag filed its complaint |
| P378 | `marketing/positioning` | Four messages from the launch video |
| P396 | `marketing/brand` | Brand kit: text on the product |
| P406 | `marketing/imagery` | Hero suitcase with the oversized tag |
| P412 | `marketing/landing` | Gate (home) |
| P416 | `marketing/landing` | Product |
| P423 | `marketing/landing` | Kickstarter bridge page |

**Enclosure size: settled at 80 x 60 x 42 mm from your documentation. Marked resolved; the 80 x 60 x 40 mm project box is not entered.** (2)

| id | section | title |
|---|---|---|
| P107 | `concept/questions` | Enclosure height: 42 mm or 40 mm |
| P255 | `design/bom` | Enclosure (ENC1) |

**Brand kit, logo or colour; the design direction and colours are being chosen now.** (6)

| id | section | title |
|---|---|---|
| P184 | `research/claims` | AMS Lite adds $100 and prints a second colour in the same job |
| P268 | `prototype/printing` | Collector edition shell |
| P393 | `marketing/brand` | Brand kit: voice |
| P394 | `marketing/brand` | Brand kit: the cast |
| P395 | `marketing/brand` | Brand kit: visual language (airport infrastructure) |
| P410 | `marketing/imagery` | Press kit |

**A print job for the Rev A shell; the tag changes what is printed. Confirm it still applies.** (2)

| id | section | title |
|---|---|---|
| P266 | `prototype/printing` | Two-piece shell and mid-plate, one plate (Level 1) |
| P269 | `prototype/printing` | Batch plates for the 100-unit run |

## (d) Low or medium confidence, or not borne out on checking (23 rows)

`D enter`, `D leave out`, or by id.

| id | section | title | why it was held |
|---|---|---|---|
| P002 | `concept/story` | Decided and still open: conflicts the story does not list | Confidence medium: combined or inferred from several lines. |
| P221 | `design/requirements` | Firmware sketch compiles | Confidence medium: Not compiled here. Line numbers and counts are mine. |
| P050 | `concept/names` | @TheBagComplains | The kind text is longer than the field allows, so it cannot be entered as written. |
| P137 | `research/claims` | US gifts, novelty and souvenir market was about $32.7B in 2025, growing about 6.4% a year through 2034 | Says the three other market reports are unnumbered; the chat numbers them 8, 10 and 15. |
| P138 | `research/claims` | Gag gifts sell in a $12-15 band on Etsy and eBay | Adds the judgement "Neither is a price study". |
| P148 | `research/claims` | A 2,000-backer campaign at a $24 average grosses about $48k and contributes about $8-12k after COGS, fulfillment and marketing | Its arithmetic is the reviewer's. |
| P156 | `research/claims` | Wholesale at $14.50 against a $29.95 MSRP gives retailers a 2x markup, and that is enough for airport retail | Its arithmetic (2.07) is the reviewer's. |
| P158 | `research/claims` | Alkaline batteries are allowed in carry-on and checked bags with essentially no restrictions | The body is an instruction, not a statement in the document. |
| P160 | `research/claims` | Alkaline AA cells need no UN38.3 testing | The excerpt says "no UN38.3 lithium cells"; the title says more. |
| P161 | `research/claims` | With the radios disabled the device needs only FCC Part 15 unintentional-radiator treatment, by self-declaration, and the ESP32-S3 module is itself FCC certified | The body joins two documents into an inference. |
| P167 | `research/claims` | Cargo holds stay between -10 C and +45 C | The design package does not give this as the reason PETG is enough. |
| P173 | `research/claims` | DFPlayer Mini averages $5.50 each in an Amazon two-pack | The excerpt supports the body, not the titled price. |
| P176 | `research/claims` | A microSD card that holds three voice packs costs $2 | The cited excerpt is not the line that states it. |
| P178 | `research/claims` | The other small prototype parts are in stock at Micro Center for same-day pickup at the listed prices | "In stock at the listed prices" is the reviewer's reading. |
| P312 | `prototype/builds` | Rev A - dev-module prototype | Links five tests to the build by inference. |
| P327 | `production/economics` | Retail run | Adds a comparison the PRD does not make. |
| P368 | `marketing/personas` | P1 - Frequent leisure flyer, 25-45 | Persona assembled from several lines of two documents. |
| P369 | `marketing/personas` | P2 - Gag-gift buyer | Persona assembled from several lines of two documents. |
| P370 | `marketing/personas` | P3 - Travel content creator | Persona assembled from several lines of two documents. |
| P371 | `marketing/personas` | P4 - Airport gift shop and novelty retail buyer | Persona assembled from several lines of two documents. |
| P447 | `marketing/social` | POV: your suitcase gets body-shamed at check-in | The cut times do not agree with the script's own beat times. |
| P449 | `marketing/social` | my luggage after 4 hours in the cargo hold | "8 seconds, not 15" is the reviewer's remark. |
| P451 | `marketing/social` | crew rested me on the WET tarmac?? sir I am luggage | The channel text is longer than the field allows, so it cannot be entered as written. |

## (e) The product's own website platform (48 rows, one question)

**Should the app's worked example cover the product's own website platform plan** (the Shopify plan, the two web blueprints, the schema and compose files, the Hotline worker)? `E yes` or `E no`. If yes, the 21 rows with no section today need a place in the app first, and the 27 rows that only matter for that plan (hosting and tool prices, web launch phases, extra site pages) are entered with them.

| id | section | title |
|---|---|---|
| P471 | `unmapped: web platform` | Website Plan Rev A: stack and monthly cost |
| P472 | `unmapped: web platform` | Website Plan Rev A: back-office modules |
| P473 | `unmapped: web platform` | Website Plan Rev A: data model |
| P474 | `unmapped: web platform` | Website Plan Rev A: automated flows |
| P475 | `unmapped: web platform` | Website Plan Rev A: weekly analytics one-pager |
| P476 | `unmapped: web platform` | Blueprint Rev A: system shape |
| P477 | `unmapped: web platform` | Blueprint Rev A: routes and back office |
| P478 | `unmapped: web platform` | Blueprint Rev A: user flows |
| P479 | `unmapped: web platform` | Blueprint Rev A: API routes and worker queues |
| P480 | `unmapped: web platform` | Blueprint Rev A: security and privacy |
| P481 | `unmapped: web platform` | Blueprint Rev A: deploy, runbook and service levels |
| P482 | `unmapped: web platform` | Database schema file (Rev A) |
| P483 | `unmapped: web platform` | Compose file (Rev A) |
| P484 | `unmapped: web platform` | Blueprint Rev B: version pins and starter |
| P485 | `unmapped: web platform` | Blueprint Rev B: media in Postgres |
| P486 | `unmapped: web platform` | Blueprint Rev B: three uses of vector search |
| P487 | `unmapped: web platform` | Blueprint Rev B: email, social and compose map |
| P488 | `unmapped: web platform` | Blueprint Rev B: migration from Rev A |
| P489 | `unmapped: web platform` | Hotline audio worker: the design decision |
| P490 | `unmapped: web platform` | Hotline audio worker: the eight hops |
| P491 | `unmapped: web platform` | Hotline audio worker: timing, failure and capacity |
| P067 | `concept/decisions` | Which web stack for the product site? |
| P168 | `research/claims` | Self-hosting Postiz without forking it triggers no AGPL source-disclosure duty |
| P169 | `research/claims` | Novelty brands are sued over website accessibility; WCAG 2.2 AA is the bar |
| P170 | `research/claims` | EU visitors need double opt-in for email under CAN-SPAM and GDPR |
| P190 | `research/claims` | Shopify Basic is $39 a month ($29 on annual billing; new stores 3 days free then $1 a month for 3 months); Shopify Payments is 2.9% + 30c online |
| P191 | `research/claims` | Klaviyo is free to 250 profiles and 500 sends, then $20 a month for 500 profiles and about $100 a month at 5,000; it bills on active profiles |
| P192 | `research/claims` | Viral Loops Start-up is $49 a month for 1,000 participants, with built-in fraud flags |
| P193 | `research/claims` | Vercel and Supabase free tiers cost about $0 until traffic passes 100k hits a month; Supabase Pro is $25 a month above 500 MB and Vercel Pro $20 a month |
| P194 | `research/claims` | Judge.me, Shopify Inbox and Microsoft Clarity have free tiers; Sky Pilot is about $5-15 a month; two domains cost about $25 a year |
| P195 | `research/claims` | Running cost of $240 a month at a 5,000 list is under 1.5% of one 1,000-unit batch's gross margin |
| P196 | `research/claims` | PostgreSQL 19 was released on 19 Nov 2026 and 18.7 is the mature release to pin |
| P197 | `research/claims` | pgvector 0.8.7 fixes an IVFFlat buffer overflow present in 0.8.4 to 0.8.6 |
| P198 | `research/claims` | Vercel's nextjs/saas-starter has about 16k stars, an MIT licence, and pins a Next 15 canary |
| P199 | `research/claims` | Postiz v2.11.3 is the last release without Temporal and covers 30+ channels including TikTok, Instagram, YouTube and X |
| P200 | `research/claims` | Self-hosting on one 4 vCPU / 8 GB VPS costs about $24-40 a month and saves about $100-150 a month against a SaaS stack at 5,000 contacts; Resend is free to 3k emails a month |
| P201 | `research/claims` | Live text-to-speech for 100k Hotline tickets would cost $1-2k |
| P413 | `marketing/landing` | Moments |
| P419 | `marketing/landing` | Voice-pack store |
| P420 | `marketing/landing` | Stories wall |
| P421 | `marketing/landing` | Press |
| P422 | `marketing/landing` | Legal pages |
| P441 | `marketing/launch` | Web phase W0 (week 1, about $100) |
| P442 | `marketing/launch` | Web phase W1 (weeks 2-3, about $50 a month) |
| P443 | `marketing/launch` | Web phase KS (launch month) |
| P444 | `marketing/launch` | Web phase DTC (after fulfilment, about $140 a month) |
| P445 | `marketing/launch` | Web phase SCALE |
| P460 | `marketing/announce` | Email lists |
