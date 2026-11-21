# User guide

This guide describes what the workbench does today. Where something is not built yet, it says so.

## What this is

A workbench that takes a product concept through seven stages, from the first idea to sales. Every concept uses the same stages and the same structure, so anything you learn on one concept applies to the next. The example concept that ships with it is **Baggage Claims MK1**.

```mermaid
flowchart LR
  A[1 Concept] --> B[2 Research] --> C[3 Design] --> D[4 Prototype] --> E[5 Production] --> F[6 Marketing] --> G[7 Sales]
  C -. parts list .-> D
  C -. wiring .-> D
```

The dotted lines are the links that work today: the parts list and the wiring you enter in Design drive the Prototype screens. The other stages do not feed each other yet.

## Getting around

- **Concept switcher** (top of the sidebar): choose which concept you are working on. **New concept** starts the wizard. **All concepts** opens the Concepts page.
- **Stages and sections** (sidebar): the seven stages, each with its sections.
- **Order of operations**: the build order worked out from your steps.
- **Report**: everything recorded for the concept on one printable page.
- **Integrations**: what is and is not connected to outside services, each with a link to where it is set.
- **Admin**: keys, models, printers and the audit log. Features that need a model, key or printer say so and link to the right tab.
- **Dark theme**: bottom of the sidebar.

## Concepts

The Concepts page lists every concept with its name, one line, product type, stage, when it last changed and how many rows it has. Search covers names and descriptions. Sort by last changed or by name.

- **Open** makes a concept the current one and takes you to its overview.
- The menu on each row has Edit, Duplicate, Export as JSON, Archive (or Restore) and Delete.
- **Edit** changes the name, the one line, the product type and the stage. Changing the product type tells you which sections will be hidden. Their rows are kept, not deleted; change the type back to see them again.
- **Duplicate** copies every row and file into a new concept. Activity history, reviewer messages, research answers and stage decisions stay with the original.
- **Archive** takes a concept out of the sidebar. It stays under Archived on this page, where you can export, restore or delete it. Nothing is deleted.
- **Delete** lists what will go and offers a JSON download first. It needs the concept's exact name typed. The deletion is recorded in the audit log, which is kept. If the deleted concept was open, the app opens another. If it was Admin's default concept, that setting is cleared.
- **Linking to a concept:** add `?concept=<id>` to any address, for example `/report?concept=baggage-claims`, to open that concept there.

## Chat

Chat (in the sidebar) answers questions about the open concept using only what is recorded for it: its rows and its saved research answers. Each answer cites its sources as small numbers. Point at one to see what it is, and select it to open the section that holds it; the full numbered list is under the answer. If nothing recorded covers your question, the answer says so. Under each answer you can see which model answered and how the sources were found: by meaning, by matching words, or both joined. Matching words folds word forms, so "wires" finds "wire", and a question that names a section, such as "What is still open in Bill of materials?", brings in that section's rows. Chats are kept per concept. Start a new one with New chat, and delete one with the bin beside it.

Chat needs a reasoning model chosen in Admin, Models. If the screen says search by meaning is not set up, choose an embedding model in Admin and then "Index this concept". Until then chat still works, but finds sources by matching the words of your question. Index again after adding many rows or research answers.

Not verified: chat has been run against a stand-in model only, so nothing here says how good a real model's answers are.

## History, activity and traceability

- **History.** In a row's editor, History lists that row's changes newest first, with who and when. Each field shows before and after; "Restore this value" puts one old value back as a new, recorded change.
- **Activity** (in the sidebar) lists every change in the concept, filtered by section and kind.
- **Traceability.** In a requirement's editor, pick the tests that check it and the parts it needs; a pick saves at once. Requirements then show "2 tests, 1 part" or "No test covers this". The Traceability page shows the requirement-by-test matrix with each test's status, and three lists of gaps: requirements with no test, tests that check no requirement, and parts no requirement needs. Deleting a test or part asks first and removes it from every requirement and build that named it.

## Drafting with AI, challenge and impact

Sections a generator can fill have a **Draft with AI** button. It says what it will read; when you run it, the rows it proposes wait for review as drafts, each with the rows it came from. Edit, approve or reject each one, or approve a whole run. A draft never counts as a row until you approve it. Running again asks before marking older waiting drafts superseded. Generators read approved rows only.

An approved press release or FAQ entry is attacked once by the reviewer; **Revise with this critique** makes a new draft. In any row's editor, **Challenge this** asks the reviewer to argue against the row (saved in Challenge with a link back), and **Verify this** opens Research with the row as the question.

After you change a decision, a requirement or a part, a notice says how many rows it affects. **Show what it affects** lists them by section with the reason, and **Propose updates** drafts changes to them, each shown before and after. Unit economics and the decision tree are listed as "Review by hand".

**Drafts** in the sidebar lists every draft of the concept. **Optimise** offers lower parts cost, fewer parts and shorter print time, measured from your rows: cost only when every part is priced, print time only from times entered after slicing.

## Editing the 3D model and routing wires

In **3D model**, select a part, pick Move or Rotate and drag (steps of 1 mm and 15 degrees) or type the numbers. Arrow keys nudge, R turns, Ctrl+Z undoes and Ctrl+Shift+Z redoes. **Section cut** hides one side along each axis. **Measure**: click two points. Under **Real shape**, attach an STL or STEP file for a part; a file that looks like metres or inches is flagged and you choose the unit, it is never rescaled for you. Export the assembly or one part as STL, and the enclosure and printed parts as 3MF.

**Route wires** needs the planner. Each wire is routed around the parts and its length is saved; the build sheet then shows "routed" lengths. Moving a part marks those lengths out of date until you route again. A wire end with no pin position starts at the middle of the part's face, and the page says how many do. **Draw the harness** on the Wiring page draws the harness diagram with WireViz.

## Starting a concept

**New concept** opens a six-step wizard: name and one-line description, who it is for and why, how it works, whether any part is 3D printed and its outer size, the parts you already know, the cheapest test, and the sales channel, price and candidate names. Only the name is required. The wizard saves exactly what you typed and turns blanks into open questions.

After the wizard you land on the overview. The app does not yet tell you what to do next; work down the sidebar from Concept.

## The stages

### 1 Concept

| Section | What you do there |
|---|---|
| Brief | Record what the product is, who it is for, why now. |
| Press release | The announcement you would publish on launch day, written before anything is built. Draft it with AI from the brief; once approved the reviewer attacks it once, and you can revise with the critique. |
| FAQ | The questions buyers and sceptics will ask, with straight answers. Draft with AI from the brief and press release; approved entries are attacked by the reviewer like the press release. |
| Challenge | Ask the AI reviewer to push back on the proposition. Needs an AI key; without one the box is disabled. |
| Names and taglines | Collect candidates and move them between candidate, shortlist, chosen and rejected. |
| Decision tree | Lay out the decisions the concept depends on. Click a decision to see its options, outcomes and what it depends on, and choose an option. A decision cannot be chosen until the decisions it depends on are made. |
| Open questions | Keep the list of things you do not know yet. |

### 2 Research

| Section | What you do there |
|---|---|
| Ask | Put a question to Perplexity and keep the answer with its sources. Needs a Perplexity key. Each question is billed to your Perplexity account; Perplexity's own estimate of the cost is shown after the answer. |
| Claims to verify | The claims the concept rests on, each unverified, verified or wrong. |

**Checking a claim.** Open a saved answer in Ask, choose **Use as evidence** beside one of its sources, pick the claim, and say whether that source supports it, contradicts it, or is unclear. You can add a quote.

- A claim becomes **verified** when at least one source supports it and none contradicts it.
- It becomes **wrong** when a source contradicts it and none supports it.
- Otherwise it stays **unverified**. When sources disagree it is shown as *Disputed: sources disagree*.

The verdict on each source is yours; the app records it and works the status out from it. The Claims to verify board shows each claim's evidence on its card and in its editor: every source's title, what it says about the claim, the quote, and the day it was judged, with the status and its reason in words, for example "Verified: 1 source supports it, none contradicts". Remove a source there or in Ask. You can still set a status by hand, but only to one the evidence allows: verified needs at least one supporting source and none contradicting; wrong is refused while sources support the claim and none contradicts it; unverified is always allowed. A new claim cannot start as verified. The next change to a claim's evidence sets its status from the evidence again. Saved answers keep each source's title, so they read the same after a reload; answers saved before this change show the address instead.

Nothing here has been run against the real Perplexity service yet. It is built to Perplexity's published documentation and tested against a stand-in.

### 3 Design

| Section | What you do there |
|---|---|
| Requirements | What the product must do. |
| Bill of materials | The parts list: reference, quantity, source, search term, cost. Import and export CSV. The total is worked out for you. |
| Physical layout | Place each part inside the enclosure in top, front and side views. Drag to move, arrow keys to nudge. The app warns about parts that overlap, sit outside the enclosure or float. |
| 3D model | The same parts in 3D. Slide to explode the assembly, click a part to focus on it, and switch on the wire overlay. |
| Schematic | Parts, pins and the wires between them. Drag from pin to pin to add a wire. Exports a wiring table, a netlist and a drawing. |

Parts are drawn as boxes and cylinders from the sizes you enter. Schematic parts are drawn as boxes with pins, not as standard symbols. Parts cannot be rotated yet.

### 4 Prototype

| Section | What you do there |
|---|---|
| Sourcing | Search links for each part at Amazon and Micro Center, and one cart link for parts that have an Amazon item number. The app does not buy anything. |
| 3D printing | Generate a print file for the enclosure (a plain tray and lid) and keep a list of print jobs. Printer status can be shown; the app cannot start a print yet. |
| Wiring and soldering | A build sheet made from the schematic: the order to solder in, which pins each wire joins, a cut list, and a tick box per wire. |
| Assembly | The assembly steps. Give a step a key, what it waits on and how long it takes, and it joins the order of operations. |
| Acceptance tests | The tests the prototype must pass, each marked not run, pass or fail. |
| Builds | Named builds (works-like, looks-like, EVT, DVT, PVT), each with exit criteria, the tests it must pass and dates. "Mark passed" is refused while a criterion is unmet or a linked test has not passed, and says why. |

Wire lengths on the cut list are estimates from the distance between parts, not routed lengths.

### 5 Production

| Section | What you do there |
|---|---|
| Unit economics | Add cost lines (packaging, labour, print material, print time, shipping in, scrap, tooling, certification, setup). The unit cost, the margin per channel, break-even and the chart of unit cost against batch size are worked out from the parts and these lines. A part with no price is listed as not priced, never counted as zero. "How this is worked out" shows the arithmetic. |
| Batch plan | Plan each batch: size, date and the build it belongs to. Each shows its worked-out unit cost, the cash it needs and what is not priced. The readiness panel lists four checks: tests, compliance, parts priced and sourced, economics complete. |
| Suppliers | Who supplies what: lead time, minimum order, location and a public website address. No personal contact details. |
| Part prices | A unit price, quantity price breaks and a supplier for each part. |
| Manufacturing methods | How each custom part or assembly step is made, with its tooling cost and extra cost per unit. |
| Compliance | A checklist of what may apply to this product in the regions you choose. The reasoning model can draft it from the brief and parts; you confirm row by row. This list is a prompt for your own checking. It is not legal or regulatory advice. |

### 6 Marketing

| Section | What you do there |
|---|---|
| Personas | Who buys this: the job they are trying to get done, what triggers the purchase, the objection, and where they look. Drafted from the brief, verified claims and saved research; you edit and approve. |
| Competitors | A sortable comparison of competitors and alternatives, including "do nothing". Prices and claims come from a cited research answer or from you; a row with no source is marked "unsourced: check this". Research competitors asks first and says Perplexity bills per question. |
| Positioning | One positioning line and three supporting messages, each with its proof; a message with no proof is flagged. The reviewer must attack it once before it can be approved. |
| Pricing | Candidate prices against the unit cost, channel fees and competitor prices, with margin worked out per channel. Margins marked with a star rest on an incomplete cost. |
| Names | Name and tagline candidates with reasons, each with links you follow and tick yourself: domain, marketplaces, trademark search pages, social handles. The app does not run the searches and never says a name is available. This is not a trademark or domain clearance. |
| Brand kit | Voice rules with do and do-not examples, colours with their contrast against white and black, type, logo files, tagline and boilerplate. A tool checks a piece of text against the voice. |
| Imagery | The shots a listing and ads need, each with its purpose, where it is used and the file. Hero and detail shots can be rendered from the 3D model. |
| Landing pages | List the pages you plan, with the path and the call to action. |
| Ads | Keep ad copy by channel, with its rule for stopping or scaling, and move each from draft to approved, running or killed. |
| Campaigns | Plan campaigns by funnel stage, budget and measure of success. |
| Social | Draft posts, approve them, copy them out, and mark them posted. |

### 7 Sales

| Section | What you do there |
|---|---|
| Amazon listing | Keep the listing text field by field. |
| Sales monitor | Log sales by hand and see totals by channel. |
| Channels and pricing | Record each channel's price, the platform's take and what is left. |

> **Going to market is not built yet.** Stages 5 to 7 are lists you fill in by hand. Nothing is generated: no positioning, brand, tagline, ad or landing page is drafted for you, no landing page is rendered, nothing is posted, and no sales arrive from Amazon. The plan covers this in its go-to-market phase.

## Order of operations and report

**Order of operations.** Every row with a key takes part. A row in the Decision tree is a decision; every other keyed row is a step.

- A step waits on the keys in its "waits on" list.
- A decision waits on the decisions it depends on, and comes before every step in each section it unlocks. A decision takes no time; it is a milestone, and it counts as made once an option is chosen.
- A finished step counts as zero. The total is the work left along the longest chain (the critical path); the planned figure beside it is the full time of that same chain.
- If rows wait on each other in a loop, no order exists for them. They, and everything that waits on them, are marked blocked until the loop is broken.
- A link to a key that does not exist is ignored and listed.

The order is worked out by the planner service. If that service is not running, the page lists the steps and decisions without an order and says so. It never guesses one.

The page does not yet draw decisions differently from steps, or the lines from a decision to the steps it unlocks.

**Report** gathers the whole concept, with its history, for printing or download.

## What is saved, and where

Everything is saved as you go in the database that runs alongside the app. Files such as print files are stored there too, up to 25 MB each. There is no undo; the activity history in the report shows what changed and when.
