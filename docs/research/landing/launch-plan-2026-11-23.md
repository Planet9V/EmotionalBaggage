# Launch and traffic plan: 50 early-access places, then paying subscribers

23 November 2026. Analysis and drafts only. Nothing was posted, sent or changed, and no account was created. Builds on `conversion-review-2026-11-22.md` (benchmarks in its section 3.3), `story-design-and-plan.md` (the scene bible) and `proposition-brief.md`.

**How this was done.** The live page was read as text on 23 Nov (it showed "50 of 50 early-access places left", so nobody has signed up yet). Community rules and launch results were searched and read on the web the same day. Every number about this product's own traffic is an **estimate** and is labelled so. Labels used for outside figures: **measured** (a dataset), **anecdote** (one founder's own report), **opinion** (advice with no data).

**Four findings that shape the plan**

1. **The two best-known launch sites do not fit a sign-up list.** Hacker News says of Show HN: "Off topic: blog posts, sign-up pages, newsletters, lists" and "Don't post landing pages or fundraisers" [S1]. Product Hunt does not feature "waitlisted products (unless immediate access is provided)" [S2]. Both are kept for the day a visitor can open something without waiting, and are not relied on to fill the 50.
2. **The 50 will come from small, well-aimed sources.** Founders report 16 to 25% of visitors signing up from a well-matched Reddit post (anecdotes, small numbers) [S9][S10][S11], against a 3.8% median for SaaS landing pages overall (measured) [S20]. A few hundred of the right visitors fill 50 places; a few thousand of the wrong ones do not.
3. **A new account posting a link is removed in many places.** Reddit's own help page says to "post authentic content into communities where you have a personal interest" and to "tread carefully" if most posts link to your own business [S7]. Which accounts the owner already has, with history, decides which channels are open this week.
4. **What the copy may promise is narrower than the headline.** The page itself says the example is "planned, not yet built or sold", that none of its 59 research claims is verified, and that the listing is not started. Every draft below says "designed, costed and planned", never "built", "on sale" or "listed".

**Two things on the live page to settle before sending traffic** (for the build team, no owner input needed beyond a yes):
- The worked example's own marketing rows mention "free voice packs" and "a free unit". They belong to the gadget, not to the service, but a skimming visitor may read "free". The owner's rule is that nothing says free.
- The address is a `railway.app` subdomain. Links on a hosting subdomain look temporary and are more likely to be filtered as spam by communities. A proper domain is a business choice (section 6).

---

## 1. The goal in numbers

**Goal 1:** 50 early-access places claimed (email plus "What do you want to make?"). No payment is taken.
**Goal 2:** the first paying subscribers from those 50 (Maker $20 a month, Studio $40 a month), once accounts, workspaces and Stripe are live.
**Goal 3:** 100 subscribers. The conversion review put this at roughly 20,000 to 30,000 qualified visits with a free plan. With nothing free, expect the upper end or beyond (section 4.4).

### 1.1 Funnel model for the two launch weeks (all figures are estimates)

"Visits" are visits to `/welcome` carrying that channel's tag. "Rate" is form sends divided by visits. Places beyond 50 go to the waiting list.

| # | Channel | Visits low / likely / high | Sign-up rate low / likely / high | Places low / likely / high | Where the rate comes from |
|---|---|---|---|---|---|
| 1 | Owner's own network: LinkedIn post plus about 30 personal messages | 60 / 150 / 400 | 3% / 5% / 8% | 2 / 8 / 32 | Estimate. Warm traffic converts best: Unbounce measured email traffic at 16.9% against 3.8% overall for SaaS pages [S20]; marked down because his network is engineers in another field |
| 2 | Reddit: three posts (r/hwstartups, r/SideProject, one feedback sub) | 100 / 400 / 2,500 | 2% / 5% / 8% | 2 / 20 / 200 | Anecdotes: 173 visits and 34 sign-ups [S9]; about 200 visits and 55 sign-ups [S10]; about 900 visitors from one post with 100 upvotes [S11]. Those products could be used at once; a list is a harder ask, so the rate is cut to a quarter |
| 3 | Creators and newsletters: 10 short emails | 0 / 100 / 2,000 | 3% / 5% / 8% | 0 / 5 / 160 | Estimate. No measured reply rate was found [S19]. Likely case assumes one small mention |
| 4 | Show HN, only once the example opens without a form | 20 / 150 / 8,000 | 1% / 2% / 3% | 0 / 3 / 240 | Measured: median Show HN score is 2 points; 6% reach 50 [S4]. Anecdotes: about 500 visitors [S5]; 7,000 to 10,000 from four hours in first place [S6]. Rate is an estimate: this audience dislikes sign-up forms [S1] |
| 5 | Indie Hackers: one build story | 20 / 80 / 400 | 2% / 4% / 8% | 0 / 3 / 32 | Estimate; no measured figure found |
| 6 | Short video: the film cut for TikTok, Reels and Shorts, about 6 clips | 10 / 60 / 600 | 1% / 2% / 4% | 0 / 1 / 24 | Measured: accounts under 2,000 followers average 2,429 views a video on TikTok, 1,484 on Reels, about 1,290 on Shorts [S16]. Clicks from a clip to a website: no measured source found; assumed 0.2 to 1% of views |
| 7 | Hackaday.io project page for the tag, then the tips line | 0 / 80 / 1,500 | 2% / 3% / 5% | 0 / 2 / 75 | Estimate. Readers land on the project page first; a share go on to the site |
| 8 | Maker forums and Discords, by taking part (no link posts) | 10 / 50 / 200 | 3% / 6% / 10% | 0 / 3 / 20 | Estimate |
| | **Total, two weeks** | **220 / 1,070 / 15,600** | blended 2% / 4% / 5% | **4 / 45 / 50 and a waiting list** | |
| opt. | Small paid test, $300 on Reddit ads | 200 / 400 / 600 | 1.5% / 2.9% / 4% | 3 / 12 / 24 | Measured: paid social converts at 2.9% on SaaS pages [S20]. Cost per click of $0.50 to $1.50 is an estimate |
| held | Product Hunt | not counted | | | Kept for the paid opening (finding 1) |

**Reading it.** The likely case is about 1,100 visits and about 45 places in two weeks, so the 50 fill in two to three weeks. The low case (about 4 places) is what happens if the owner has no aged accounts and posts are removed. The high case needs one post to catch (a Reddit post that reaches the sub's front page, or a creator mention), which nobody can plan for.

### 1.2 From 50 places to subscribers (estimates)

| Step | Low | Likely | High | Source |
|---|---|---|---|---|
| Early-access members who open a workspace when invited | 40% (20) | 60% (30) | 80% (40) | Estimate |
| Members who become paying subscribers | 5% (3) | 15% (8) | 25% (12) | Informal founder poll: 5 to 25% of a waiting list pays; about 20% when people get in within a month, under 10% after three months [S21] |
| Monthly revenue from them at $20 to $40 | about $60 | about $180 | about $300 | Arithmetic on the row above |

The 50 are worth more as evidence than as revenue: 50 written answers to "What do you want to make?", 30 or so real first sessions, and the first true quotes and numbers the page is allowed to show.

---

## 2. Channels ranked by ICE

**Scoring.** Impact, Confidence and Ease are each 1 to 10 (Ease 10 is the least work). **ICE is the average of the three**, as in the conversion review. Impact is judged against filling 50 places with people who make physical products. Scores are judgement.

| Rank | Channel | I | C | E | ICE |
|---|---|---|---|---|---|
| 1 | Owner's own network (LinkedIn post and personal messages) | 6 | 7 | 9 | 7.3 |
| 2 | Reddit (r/hwstartups, r/SideProject, a feedback sub) | 8 | 6 | 6 | 6.7 |
| 3 | Creators and newsletters (10 emails) | 7 | 4 | 6 | 5.7 |
| 4 | Show HN (conditional) | 8 | 3 | 6 | 5.7 |
| 5 | Indie Hackers build story | 4 | 5 | 8 | 5.7 |
| 6 | Short video of the film | 6 | 4 | 6 | 5.3 |
| 7 | Hackaday.io project and tips line | 6 | 4 | 5 | 5.0 |
| 8 | Product Hunt (held for the paid opening) | 7 | 4 | 4 | 5.0 |

Campaign tag for everything in this plan: `utm_campaign=early50`. The funnel records source, medium and campaign only, so the place is written into the source (for example `reddit-hwstartups`).

### 2.1 Owner's own network: LinkedIn and personal messages (ICE 7.3)

- **Who is there.** Engineers, integrators and small manufacturers who already know the owner. Not all are makers, but engineers are the people most likely to have a product idea in a drawer, and small product firms are one of the three audiences on the page.
- **What is allowed.** A personal post about one's own work is ordinary use. Personal messages to people he knows are fine; bulk messages to strangers are not part of this plan.
- **Angle.** The proof story, told in the first person: "I had a joke product idea and wanted to see how far one person could take it. Here is how far."
- **Asset.** The post in 3.5, one image (the parts list with its unit cost, or the 3D view), and a three-line personal message.
- **Owner effort.** 3 hours: edit the post, send about 30 messages, answer comments for two days.
- **Expected result (estimate).** 60 to 400 visits; 2 to 32 places; likely 8.
- **Tags.** `?utm_source=linkedin&utm_medium=social&utm_campaign=early50`; for messages `utm_source=personal&utm_medium=message`.
- **Timing.** Buffer's analysis of 4.8 million posts: Wednesday is the strongest day, the best hours are roughly 3 to 8 pm local, top slot Wednesday 4 pm (measured) [S13].
- **Risk.** Low. It mixes the consultancy's audience with a side product; the owner decides whether he wants that (section 6).

### 2.2 Reddit (ICE 6.7)

- **Who is there.** r/hwstartups: about 43,000 members, self-described as "a blend of r/DIY and r/startups content - like a Hacker News for hardware"; its stated good posts include prototyping and manufacturing how-tos, success stories and physical Kickstarter pages [S8]. Recent posts read on a mirror were mostly founders asking about their own products [S8b]. r/SideProject: about 911,000 members, "a subreddit for sharing and receiving constructive feedback on side projects" [S8c]. r/AlphaandBetausers and r/roastmystartup are named by practitioners as open to founders seeking first users (opinion) [S12].
- **What is allowed.** **The sidebars could not be read on this run** (Reddit blocks automated reading), so no subreddit rule is quoted here; the owner or the build team must read each sidebar before posting, which takes two minutes each. What was read: Reddit's own help page, "Post authentic content into communities where you have a personal interest", and if most of your posts link to your business, "tread carefully" [S7]. Third-party summaries (not rule text): r/SideProject is for showing what you built; r/startups allows promotion only in its "Share Your Startup" thread; r/Entrepreneur and r/smallbusiness restrict it to set threads or days; several subs filter accounts with little history [S12][S12b]. One founder reports automatic removals for a new account and posting in daily threads in its place [S10].
- **Not recommended for a link:** r/3Dprinting, r/arduino, r/electronics, r/Entrepreneur, r/startups. Their rules were not read and practitioners describe them as strict. Take part there with answers only.
- **Angle.** The proof story as a lesson, with the numbers on the page, and a question at the end. The link goes last or in a comment if the sub prefers that.
- **Asset.** The two posts in 3.4; two images (parts list with cost at two volumes; the status board).
- **Owner effort.** 5 hours: read three sidebars, post on three separate days, answer every comment within the first two hours of each.
- **Expected result (estimate).** 100 to 2,500 visits; 2 to 200 places; likely 20.
- **Tags.** `utm_source=reddit-hwstartups`, `reddit-sideproject`, `reddit-alphabeta`; `utm_medium=community`; `utm_campaign=early50`.
- **Timing.** No measured source for these subs was found. Convention (opinion): weekday mornings US time, 7 to 9 am Central.
- **Risk.** Removal for self-promotion, or a silent filter on a new account. Never post the same text in two subs on one day. If a post is removed, do not repost; message the moderators once and move on.

### 2.3 Creators and newsletters (ICE 5.7)

- **Who is there.** Maker YouTube channels and newsletters whose readers design, print and try to sell things. The ten types are listed in 3.7. Named examples of the kind found on this run: Hardware FYI (Substack), Hackster's newsletter, the hardware list at InboxReads [S18]. Their submission terms were not readable; check each before writing.
- **What is allowed.** A short personal email. Hackaday's tip page puts the general rule well: "Don't send us press releases" [S3].
- **Angle.** The joke opens the email (it is the reason to click); the proof is the reason to cover it. Offer an early-access place and a walk-through, ask for nothing else.
- **Asset.** The email in 3.7; the 30-second clip; a one-paragraph description; one image.
- **Owner effort.** 4 hours: pick ten, write one true sentence about each one's recent work, send, follow up once after three to four days (opinion) [S19].
- **Expected result (estimate).** Most will not answer. 0 to 2,000 visits; likely 100 from one small mention; 0 to 160 places; likely 5.
- **Tags.** `utm_source=<name-of-channel>&utm_medium=creator&utm_campaign=early50`, one source per recipient so each mention can be counted.
- **Risk.** Low. A creator may ask for a sponsorship fee; that is the ad-budget decision in section 6. Anyone who covers it after receiving something of value must say so; an early-access place that takes no payment should still be mentioned by them.

### 2.4 Show HN (ICE 5.7, conditional)

- **Who is there.** Engineers and founders; many build hardware on the side. Sceptical of AI claims and of sign-up forms.
- **What is allowed.** "Show HN is for something you've made that other people can play with." "Off topic: blog posts, sign-up pages, newsletters, lists, and other reading material." "Don't post landing pages or fundraisers." "Please make it easy for users to try your thing out, ideally without barriers such as signups or emails." "Please don't ask friends to upvote or comment." [S1]
- **The condition.** Post only when a visitor can open the worked example and move around in it without typing an email (a read-only example). The page today is a sign-up page with live viewers on it; posted as it is, it risks being flagged. If the read-only example is not ready in these two weeks, skip Show HN now and use it at the paid opening.
- **Angle.** The proof story, with the honest limits first. The guarantees ("no invented numbers", "claims need proof") are the hook for this audience, and the 0 of 59 verified claims is a strength here, not a weakness.
- **Asset.** Title and first comment in 3.2; the read-only example link.
- **Owner effort.** 4 hours: post, then stay at the keyboard for three to four hours answering every comment plainly.
- **Expected result.** Measured: of 188,085 Show HN posts, the median score is 2 points, 10% reach 24 and 6% reach 50 [S4]. Anecdotes when it works: about 500 visitors from HN on one hardware story [S5]; about 7,000 visits in four hours in first place and over 10,000 in the day [S6]. Estimate here: 20 to 8,000 visits, likely 150; 0 to 240 places, likely 3.
- **Tags.** `?utm_source=hackernews&utm_medium=community&utm_campaign=early50` (Hacker News strips nothing, but keep the address short: link to the example, not the form).
- **Timing.** One dataset finds the highest share of posts reaching 50 points at Monday 00:00 UTC, which is Sunday 6 pm Central, then Saturday evening Central (measured, 2021 onward) [S4]. A second-hand summary of another analysis says Tuesday to Thursday and Wednesday morning Pacific do better [S4b]. The sources disagree; Sunday 6 pm Central is chosen because the larger dataset supports it and the owner is free to answer comments then.
- **Risk.** Flagged as a sign-up page; harsh comments about AI. Answer once, calmly, with what is on the page.

### 2.5 Indie Hackers (ICE 5.7)

- **Who is there.** Solo founders, mostly software. Few makers, but they are generous with feedback on pages and pricing.
- **What is allowed.** Its own posting advice: descriptive titles, short skimmable posts, and "putting your company's name in the title is almost never helpful" [S15]. No removal policy for product posts was found on the pages read. A commenter notes new members cannot post at once, so create the account early (owner decision, section 6).
- **Angle.** A build story with a number in the title: what one worked example cost to carry through seven stages, what is honest to claim with no customers.
- **Asset.** A 300-word version of the r/SideProject post.
- **Owner effort.** 1.5 hours.
- **Expected result (estimate).** 20 to 400 visits; likely 80; 0 to 32 places; likely 3.
- **Tags.** `utm_source=indiehackers&utm_medium=community&utm_campaign=early50`.
- **Risk.** Low. Low reach.

### 2.6 Short video of the film (ICE 5.3)

- **Who is there.** Everyone, which is the weakness. The joke travels; the buyer is a small share of the viewers.
- **What is allowed.** Posting one's own clips is the purpose of all three platforms. A link sits in the profile (TikTok, Instagram) or the description (Shorts), so the profile must exist and carry the tagged link.
- **Angle.** The joke, with one bridge line at the end: "This started as a joke. Then it got a parts list." Then the end card.
- **Asset.** Three vertical cuts (3.6) exported from the existing scenes, with burned-in captions. Exporting 9:16 video from the 3D scenes is a job for the build team, not the owner.
- **Owner effort.** 4 hours over two weeks: approve the cuts, post six clips across three platforms, reply to comments.
- **Expected result.** Measured: accounts under 2,000 followers average 2,429 views a video on TikTok, 1,484 on Reels and about 1,290 on Shorts, from 6.2 million videos [S16]. Averages are pulled up by the few clips that catch; most get fewer. Estimate: 10,000 to 30,000 views in total, 10 to 600 visits, likely 60, and about 1 place. Its real job is attention and reusable clips for every other channel, not sign-ups.
- **Tags.** `utm_source=tiktok`, `instagram`, `youtube`; `utm_medium=video`; `utm_campaign=early50`.
- **Timing (measured, Buffer, local time)** [S14]: TikTok Sunday 9 am, and evenings 6 to 11 pm; Instagram Thursday 9 am, Wednesday strongest; YouTube Shorts Friday 4 pm.
- **Risk.** Viewers think a talking luggage tag is for sale. Every caption says it is an idea, designed and costed, not yet built.

### 2.7 Hackaday.io and the tips line (ICE 5.0)

- **Who is there.** Hardware hobbyists and engineers who read build logs.
- **What is allowed.** Hackaday's tip page: "This also includes projects you yourself document", and "Don't send us press releases" [S3]. Its editors' advice: say what it is, why you built it and how it works, with good photographs and a public link; a Hackaday.io page is suggested as the place to host it [S3b].
- **Angle.** The device, not the service: a motion-sensing luggage tag that knows when it is weighed, thrown or left in the dark. How the detection works (free-fall over 0.3 s, the carousel's periodic motion) is the interesting part. The workbench is mentioned once, as how the parts list and cost were kept.
- **Asset.** A Hackaday.io project page with the schematic, parts list, detection rules and the film. **A photograph of a printed, working tag is what turns this from weak to strong**; without one, post the project page only and hold the tip.
- **Owner effort.** 3 hours for the page from existing material (the build team can draft it); 15 minutes for the tip.
- **Expected result (estimate).** 0 to 1,500 visits; likely 80; 0 to 75 places; likely 2.
- **Tags.** `utm_source=hackadayio&utm_medium=community&utm_campaign=early50`.
- **Risk.** Being read as an advertisement for a paid service. Keep the page about the device.

### 2.8 Product Hunt (ICE 5.0, held)

- **Who is there.** Founders and early adopters of software; few makers.
- **What is allowed.** Launches "go live at 12:01 AM Pacific Time" (2:01 am Central). Only featured launches compete for the day's ranking, and featuring is the team's choice. Not featured: "Waitlisted products (unless immediate access is provided)" and "hardware without a prominent digital component". Never pay for upvotes [S2][S2b].
- **Decision.** Do not launch during early access. Launch on the day paid workspaces open, when a visitor can start at once.
- **Angle then.** The proof story, with the film as the gallery video.
- **Asset.** Tagline, description and maker comment in 3.3; five gallery images; the 30-second clip.
- **Owner effort.** 10 hours including the day itself.
- **Expected result.** Anecdotes: third place brought 1,305 visitors and 210 sign-ups for a founder with 10,000 followers [S17]; second place brought 4,400 visits and 600 registrations on the day [S17b]; a solo founder with no audience finished 74th with 10 points [S17c]; one roundup reports 746 visits and 32 sign-ups [S17d]. Median points needed for the top five range from 165 on Saturday to 235 on Thursday (measured by Databox, reported second-hand) [S17d]. Estimate for a solo founder with no audience: 100 to 1,500 visits.
- **Tags.** `utm_source=producthunt&utm_medium=launch&utm_campaign=open`.
- **Risk.** Not featured, which means little traffic for a day of work.

### Not in the top 8

- **Printables and MakerWorld.** Model-sharing sites, not places to announce a service. MakerWorld's guidelines say "Do not post advertising information on your account name, description, pictures, etc." [S22]. The honest use is to publish the tag's printable enclosure as a model when it exists, with the story in the description, and no service pitch.
- **Maker Discords and forums** (Hackster, element14, small hardware Slacks) [S23]. Worth joining and answering questions; no link posts. Counted in row 8 of the model.
- **X, Bluesky, Threads.** Without an existing following a post reaches almost nobody. Reuse the clips there if the owner already has an account; measured best times are weekday mornings [S14].
- **Kickstarter-preparation audiences.** The people closest to buying. They gather in r/hwstartups and around crowdfunding-preparation services more than in one forum; reach them through 2.2 and 2.3.

---

## 3. The two stories, and draft copy

| | Story A: the joke | Story B: the proof |
|---|---|---|
| What it is | A luggage tag that heckles its own trip | One real idea carried from a one-line brief to a costed design, a launch plan and a channel plan |
| Built for | Attention, short video, the first line of an email | The people who will sign up: makers and first-time founders |
| Use it on | TikTok, Reels, Shorts, the opening of creator emails, the Product Hunt video | Reddit, Show HN, Indie Hackers, LinkedIn, Hackaday.io |
| Always ends with | The bridge: "It started as a joke. Then it got a parts list." | The honest limit: designed, costed and planned; not yet built or sold |
| Never | Implies the tag can be bought | Uses "built", "on sale", "listed", a time saving, or a customer |

Rules kept in every draft: nothing says free; no "open source"; no testimonials, users or numbers that are not on the page; the only scarcity is the real 50 places. Figures quoted are those on the live page on 23 Nov (parts $30.01 at prototype volume; unit cost $16.00 at 1,000; planned price $25; 24-step launch plan; 0 of 59 research claims verified). If the page changes, change the drafts. Text in [brackets] is for the owner to fill.

### 3.1 The one-line versions

- Joke: "A luggage tag that complains about how your bag is treated."
- Proof: "One product idea, taken from a one-line brief to a costed design and a launch plan, with every number shown."
- Offer: "50 early-access places. No payment is taken during early access. Afterwards Maker is $20 a month and Studio is $40 a month."

### 3.2 Show HN (post only under the condition in 2.4)

**Title (80 characters; the limit is 80):**
`Show HN: I took a joke gadget from one line to a costed design, in one workbench`

**Link:** the read-only worked example.

**First comment:**

> I'm [name], an engineer in Kansas City. The joke: a tag on your suitcase handle that senses what is happening to the bag and complains about it. Weighed at check-in, thrown onto the belt, left in the dark, going round the carousel.
>
> I wanted to see how far one person could take an idea like that, so I built a workbench that carries a physical product through seven stages: concept, research, design, prototype, production, marketing, sales. A model drafts each stage from the one before it; nothing stands until I approve it.
>
> The link opens the tag as a worked example on its real data: the parts list ($30.01 for one prototype, $16.00 a unit at 1,000), the schematic, the 3D model, the enclosure checks, the channel sums and a 24-step launch plan.
>
> What it is not: the tag has not been built or sold. The research stage lists 59 claims and none is verified yet, and the workbench shows that instead of hiding it. The marketplace and printer connections have only been run against stand-ins.
>
> The rules I held it to: no invented numbers, every claim needs a source, every change is recorded.
>
> It will be a paid service ($20 and $40 a month). I'm opening 50 early-access places first and taking no payment during that period. I'd most like to hear from people who have taken a product to a first production run: which stage is modelled wrongly?

### 3.3 Product Hunt (for the paid opening)

**Name:** Concept to Realization [or the final name]

**Tagline (59 characters; the limit is commonly 60, check on the form):**
`Take a physical product idea from one line to a launch plan`

**Description (about 250 characters):**
> A workbench for makers and first-time founders. Seven stages from concept to sales. AI drafts each stage from the last one; you approve what stands. See one real product worked through all of it, with its parts list, unit cost and launch plan.

**Maker comment:**

> Hello, I'm [name]. This began as a joke: a luggage tag that complains about how your bag is treated (the film is in the gallery).
>
> I used the joke to build the tool I wanted: one place that takes a physical product from a one-line idea through research, design, prototype, production, marketing and sales. Each stage is drafted from the one before, and nothing is published or spent without your approval.
>
> The tag is the worked example, shown on its real data: a parts list with a cost at each batch size, a schematic, a 3D model, channel sums and a launch plan. It is designed and costed. It has not been built or sold, and the page says exactly what is still open.
>
> Plans are Maker at $20 a month and Studio at $40 a month. [Founding-member term, if the owner sets one.]
>
> I would value blunt feedback from anyone who has shipped hardware: where does the process not match what really happens?

### 3.4 Two Reddit posts

Read each sidebar first (2.2). Post from the owner's own aged account. Different text, different days.

**Post 1, for r/hwstartups** (a how-to with real numbers, which the sub's own description names as a good post [S8])

**Title:** `I costed a joke product from one prototype to 1,000 units. Here is the sheet, and what I still don't know.`

> I'm an engineer, not a consumer-products person. I had a silly idea: a luggage tag with a motion sensor that reacts to what happens to the bag (weighed, thrown, left in the dark, on the carousel). I used it as the test case for carrying an idea all the way through, on paper, before spending anything.
>
> Where it stands:
> - One prototype: $30.01 in parts.
> - At 1,000 units: $16.00 a unit.
> - Planned price: $25. Net after fees comes to about $19.55 a unit through Amazon FBA and $14.50 wholesale, on the sheet.
> - Not built yet. Not sold. 59 research claims listed, none verified so far.
>
> What I learned doing it:
> 1. The enclosure and the battery decided the cost more than the electronics did.
> 2. The channel sums changed which price was even possible, so I should have done them before the design, not after.
> 3. Writing down every claim I was relying on was uncomfortable. Most of them were guesses.
>
> Questions for people who have done a first production run:
> - What does a sheet like this usually miss between prototype and 1,000 units?
> - At a $25 price, is wholesale worth doing at all?
>
> I built a workbench to keep all of this in one place and I'm opening 50 early-access places for it (it will be a paid service, no payment during early access). Link in my first comment if that is allowed here; happy to leave it out.

*Before posting: check the two channel figures and the three lessons against the example's rows; remove any lesson the owner does not recognise as true.*

**Post 2, for r/SideProject** (showing what you built is what the sub is for [S8c][S12])

**Title:** `It started as a joke about a suitcase. Now it is a workbench that takes a product idea through seven stages.`

> The joke: a tag on your suitcase handle that complains. On the check-in scale: "Are you... calling me FAT?" On the carousel: "Wheeee! Again! Again!"
>
> I made a short animated film of it, then kept going, because I wanted to know what it takes to turn an idea like that into a product. The side project became the tool: one workbench that takes a physical product from concept through research, design, prototype, production, marketing and sales. A model drafts each stage from the last. You approve what stands.
>
> The page shows the tag worked through every stage on its real data: parts list, schematic, 3D model, unit cost, launch plan. It also shows what is not done (the tag is not built, none of its research claims is verified yet).
>
> I'm one person. It will be a paid service ($20 and $40 a month); I'm opening 50 early-access places first, with no payment during early access.
>
> I'd like feedback on two things: does the first screen tell you what this is in five seconds, and does the example make you believe it or doubt it?
>
> [link with `utm_source=reddit-sideproject`]

### 3.5 LinkedIn post

> A while ago I had a joke idea: a luggage tag that complains about how your bag is treated. Weighed at check-in. Thrown onto the belt. Left in the dark.
>
> Most ideas like that stay jokes. I wanted to see how far one person could take one, so I built the tool to do it: a workbench that carries a physical product through seven stages, from concept to sales. AI drafts each stage from the one before. You decide what stands.
>
> The tag is the worked example. It now has a parts list ($30.01 for one prototype, $16.00 a unit at 1,000), a schematic, a 3D model and a launch plan. It has not been built or sold yet, and the page says so.
>
> If you, or an engineer you know, have a product idea in a drawer: I'm opening 50 early-access places. No payment during early access; afterwards it is $20 or $40 a month.
>
> The film and the example are here: [link]
>
> What idea have you been sitting on?

*Put the link in the post, not the first comment, so the tag is counted. Attach the parts-list image or the 30-second clip.*

**Personal message (three lines):**
> [Name], odd one from me. I turned a joke product idea into a tool for taking physical products from idea to launch plan. I'm letting 50 people in early. Would you look at the page and tell me what is unclear? [link]

### 3.6 Three short-video cut lists

Source: the six scenes on the page (handle, scale, toss, dark hold, carousel, scale again), lines verbatim from the scene bible. Vertical 9:16, captions burned in (most short video is watched without sound), the "sensed" label kept in the lower third. The first two seconds are the hook. Final two to three seconds: end card.

**End card, all cuts:** line 1 "It started as a joke. Then it got a parts list." Line 2 "50 early-access places". Line 3 the short address. When the 50 are gone, line 2 becomes "Join the waiting list" the same day.

**Cut A, 15 seconds: the scale** (one joke, fastest hook)

| Time | Picture | Text on screen |
|---|---|---|
| 0 to 2 s | The bag lands on the check-in scale; display climbs to 62 | "My suitcase has opinions." |
| 2 to 6 s | Stillness, held beat; lower third WEIGH_IN | the tag: "Are you... calling me FAT?" |
| 6 to 9 s | The agent, straight-faced | "Sir, the bag is over the limit." |
| 9 to 12 s | Back to the display, still 62 | the tag: "Sixty-two pounds? That's mostly SOUVENIRS." |
| 12 to 15 s | End card | as above |

Caption: "A luggage tag that talks back. It is an idea, designed and costed, not built yet. I'm using it to show how a product idea gets made. 50 early-access places, link in profile."

**Cut B, 30 seconds: the trip** (three jokes, the main cut)

| Time | Picture | Text on screen |
|---|---|---|
| 0 to 2 s | Mid-air freeze of the bag in the handler's toss | "What your suitcase would say if it could." |
| 2 to 7 s | THUD; lower third FREEFALL + IMPACT | "OW! ...I felt that in my flip-flops." |
| 7 to 13 s | The scale, 62 lbs, held beat | "Are you... calling me FAT?" |
| 13 to 19 s | The dark hold, slow push-in; DARK_IDLE | "Hello? ...Anyone? ...Cool, cool. I'll just be here." |
| 19 to 24 s | The carousel bend; CAROUSEL | "Wheeee! Again! Again!" |
| 24 to 27 s | Cut to the parts list and the 3D model turning | "It started as a joke. Then it got a parts list." |
| 27 to 30 s | End card | as above |

Caption: "It started as a joke about a suitcase. Then I worked out what it would take to make it: parts, cost, launch plan. Not built yet. The tool I used takes any product idea through the same stages. 50 early-access places, link in profile."

**Cut C, 45 seconds: joke to product** (for LinkedIn, the Product Hunt gallery and creator emails)

| Time | Picture | Text on screen |
|---|---|---|
| 0 to 2 s | Close-up of the tag on the handle, name and tagline readable | "This is a joke that got out of hand." |
| 2 to 8 s | The handle grab; HANDLE_GRAB | "Whoa whoa whoa — are you gonna buy me dinner first?" |
| 8 to 14 s | The scale | "Are you... calling me FAT?" |
| 14 to 19 s | The toss | "OW! ...I felt that in my flip-flops." |
| 19 to 24 s | The carousel | "Wheeee! Again! Again!" |
| 24 to 28 s | One typed line going into the workbench | "So I typed the idea in. One line." |
| 28 to 34 s | Parts list, then schematic, then the 3D model | "Parts: $30.01 for one. $16.00 each at 1,000." |
| 34 to 39 s | Channel sums, then the launch plan | "Then the channels and a 24-step launch plan." |
| 39 to 42 s | The status board | "Designed and costed. Not built yet. Every open item shown." |
| 42 to 45 s | End card | as above |

Caption: "One product idea, taken from a single line to a costed design and a launch plan. The tag is the example; the workbench is for your idea. 50 early-access places. No payment during early access; then $20 or $40 a month."

*Check before publishing: that the handle scene line suits the owner's professional audience on LinkedIn; cut C works without it.*

### 3.7 Email to ten maker channels and newsletters

Ten **types** to choose one each from (no names are suggested here; pick ones the owner really watches or reads):

1. A 3D-printing channel that designs functional parts, 20,000 to 200,000 subscribers.
2. An electronics channel that builds small battery devices with microcontrollers.
3. A product-design or industrial-design channel that shows process, not only results.
4. A "I tried to sell my invention" channel that follows products to market.
5. A channel or blog on small-batch manufacturing and moving from prototype to production.
6. A crowdfunding-preparation newsletter or podcast.
7. A hardware-startup newsletter (of the Hardware FYI kind [S18]).
8. A maker-community newsletter attached to a project site (of the Hackster kind [S18]).
9. A newsletter for people selling their own products on marketplaces.
10. A travel-gadget or funny-gadget channel (for the joke only; lowest chance of sign-ups).

Smaller channels answer more often than large ones (opinion). Keep it to 50 to 80 words and one ask (opinion) [S19].

**Subject:** `A luggage tag that complains, and what it took to cost it`

> Hi [first name],
>
> Your video on [specific thing, one true detail] is why I'm writing.
>
> I made a 30-second film of a joke product: a luggage tag that heckles its own trip [link to clip]. Then I took it through every stage to a parts list and unit cost, in a workbench I built for that.
>
> Would you like an early-access place to try it on an idea of yours? No payment, and no obligation to mention it.
>
> [Name], [contact address]

**Follow-up, once, after three to four days, same thread:**
> [First name], in case this slipped past: the 30-second film is here [link]. If it is not for you, no reply needed.

---

## 4. Two-week calendar, and what comes after

All times Central. Thursday 26 November is Thanksgiving; the days around it are poor for professional posts and good for hobby time, so week 1 is preparation and warm contacts, and the public posts start Monday 30 November.

### 4.1 Day by day

| Day | Date | Owner does | Time | Why then |
|---|---|---|---|---|
| 1 | Mon 23 Nov | Settle the section 6 decisions. List accounts with history. Read three subreddit sidebars | 1.5 h | Decisions gate everything |
| 2 | Tue 24 Nov | Edit the drafts in section 3. Ask the build team for the three video cuts, the read-only example and tagged links | 2 h | |
| 3 | Wed 25 Nov | Send 15 personal messages to people who make things. Start answering questions in r/hwstartups (no links) | 1 h | Warm contacts first; builds account history |
| 4 | Thu 26 Nov | Nothing (Thanksgiving) | | |
| 5 | Fri 27 Nov | Create the video profiles if approved. Post cut A to YouTube Shorts at 4 pm | 0.5 h | Shorts' best slot is Friday 4 pm [S14] |
| 6 | Sat 28 Nov | Start the Hackaday.io project page from existing material. Second 15 personal messages | 2 h | |
| 7 | Sun 29 Nov | Post cut A to TikTok at 9 am. **If the read-only example is live: Show HN at 6 pm, then stay for three hours** | 0.5 h, or 4 h | TikTok's best slot is Sunday 9 am [S14]; Show HN window [S4] |
| 8 | Mon 30 Nov | r/SideProject post, 7 to 9 am. Answer every comment for two hours | 2 h | Convention for US mornings (opinion) |
| 9 | Tue 1 Dec | Send the ten creator and newsletter emails, morning. Post cut B to TikTok in the evening, 6 to 9 pm | 3 h | Evenings are strong on TikTok [S14] |
| 10 | Wed 2 Dec | LinkedIn post at 4 pm. Answer comments that evening and next morning | 1.5 h | Wednesday 4 pm is LinkedIn's top slot [S13] |
| 11 | Thu 3 Dec | r/hwstartups post, 7 to 9 am. Cut B to Instagram Reels at 9 am | 2 h | Instagram's best slot is Thursday 9 am [S14] |
| 12 | Fri 4 Dec | Indie Hackers story, morning. Cut B to YouTube Shorts at 4 pm. Follow up the creator emails | 2 h | |
| 13 | Sat 5 Dec | Publish the Hackaday.io page; send the tip only if there is a photograph of a real tag. Third Reddit post in a feedback sub | 1.5 h | |
| 14 | Sun 6 Dec | Cut C to TikTok at 9 am. Review the two weeks against section 5; decide which two channels to repeat | 1.5 h | |

About 22 hours of the owner's time over two weeks, or 26 with Show HN. Every morning from day 3: ten minutes in Admin, Funnel (section 5), and a personal reply to each new sign-up within a day.

### 4.2 When the 50 fill

The page already turns the form into a waiting list. Around it:

1. The same day, change the end card and every pinned post from "50 early-access places" to "Join the waiting list". Leaving the old line up after the places are gone would be false scarcity.
2. Do not raise the limit quietly. If the owner wants a second group, name it ("the next 50 open on [date]").
3. Tell the waiting list one true thing: when the paid plans open and what they cost.
4. Keep posting. The waiting list is the audience for the paid opening.

### 4.3 Turning the 50 into the first paying subscribers

**What the product must have ready first** (from `docs/TASKS.md`; none of this is the owner's to build):

- The sign-in cut-over and accounts (task 1).
- Each member's ideas separated in their own workspace, with its security review passed. The task board makes this a hard requirement before the first early-access workspace opens, because the page promises "your ideas are kept in your own workspace" (task 2).
- The mail server set in Admin, so sign-ups get a confirmation and invitations can be sent.
- Stripe subscriptions, plan limits and the billing page (task 5), before anyone is asked to pay.
- Terms and a privacy page, and a cancel-and-export answer.

**What to send, when, and what to ask**

| When | What | The one question |
|---|---|---|
| Within 24 hours of sign-up | A short personal reply from the owner, by name. Thanks; what early access is; the honest date range for opening | "What is the first thing you would want it to do for [their idea]?" |
| Weekly until workspaces open | Three lines: what shipped this week, what is next, one picture | none |
| When workspaces open: invitations in groups of 10, the best-matched ideas first | "Your place is open." A 20-minute start call offered to each | "May I watch you do the first ten minutes?" |
| Day 3 after first sign-in | A check-in | "Where did you get stuck?" |
| Day 14 after first sign-in | The price conversation, plainly | "It becomes $20 a month for Maker. Would you pay that today? If not, what is missing?" |
| When Stripe is live: two weeks' notice, then the paid opening | Date, price, what happens to their work if they do not subscribe, the founding-member term if one is set | "Subscribe" (they enter a card themselves; nobody is moved to paid automatically) |
| After the first month paid | A request | "May I quote you, by name, on the page?" (the first true testimonials) |

Speed matters more than polish: the founder poll puts conversion near 20% when people get in within a month and under 10% after three months [S21]. If workspaces will not be ready within about four weeks of a person's sign-up, say so in the first reply.

### 4.4 After the 50: the road to 100 subscribers (estimates)

- With nothing free, the nearest measured shape is a trial that asks for a card: about 3.5% of visitors start, and 25 to 35% of those pay when done well, or about 1 paying subscriber per 100 qualified visitors [S24]. A page with no trial at all will be lower. On that basis 100 subscribers needs 10,000 to 30,000 qualified visits, and the two launch weeks bring about 1,100.
- So the paid opening needs its own push: Product Hunt and Show HN on the day a visitor can start at once (2.4, 2.8), a second round with the creators who answered, and the first members' real results on the page.
- The steady source afterwards is search: one written, worked page per question a maker types ("how much does it cost to make a prototype of...", "unit cost at 1,000 units"), each built from the example's real rows. That is a content task for later, not for these two weeks.
- Whether a trial exists at all is an open business decision (section 6).

---

## 5. What to measure each morning

### 5.1 The morning read, in Admin, Funnel (ten minutes)

| Look at | Question it answers |
|---|---|
| Visits yesterday, by `utm_source` and referrer host | Which post or message brought people |
| For each source: visits, form starts, form sends, and sends divided by visits | Which source brings people who sign up |
| Share of visits that reached the early-access section | Whether people get that far |
| Form starts against form sends | Whether the form itself loses people (the required "What do you want to make?" field) |
| Film starts, by source | Whether the joke is being watched by the people it was aimed at |
| Phone against desktop, by source | Video traffic is nearly all phone; check its rate separately |
| Places left | When to switch the end card (4.2) |
| The answers typed into "What do you want to make?" | The real product ideas. Read every one; this is the best market research the plan produces |

Visits with no tag and no referrer are mostly personal messages and people typing the address; count them with the owner's network.

### 5.2 Thresholds (rules of thumb set for this plan; estimates, not benchmarks)

Do not judge a source on fewer than 100 visits; below that the rate is noise.

| Result after at least 100 visits from a source | Verdict | Do |
|---|---|---|
| 4% or more sign up | It works | Repeat it within a week with a new angle; it is above the 3.8% SaaS median [S20] |
| 2 to 4% | Fair | Keep it, and run that source's page experiment (5.3) |
| Under 2% after 200 visits | Stop | No more owner time there |
| Many visits, under 1%, mostly phones, film watched | The joke worked and the bridge did not | Fix the landing for video traffic (experiment 1) before posting more clips |
| A post removed, or no visits within 24 hours | The account or the rule, not the copy | Do not repost. Check the sidebar; move to the next place |

For the two weeks as a whole: 25 places by the end of day 10 is on course for 50 within three weeks. Under 10 by day 10 means the sources are wrong, not the page; go back to section 6 (accounts, the paid test).

### 5.3 Three cheap page experiments, each tied to a source

There is too little traffic for a split test. Run each as a before-and-after on one source, one week each, and compare the sign-up rate for that source only.

1. **Video traffic (`utm_medium=video`): land on the film.** Send clip links to the film section with one sentence above it ("The tag is the example. The workbench is for your idea.") and the early-access form directly under it. Hypothesis: people who came for the joke leave when the first screen is about something else. Measure: sign-up rate for video sources, target from under 1% to 2%.
2. **Maker traffic (`reddit-*`, `hackernews`, `hackadayio`): land on the proof, with the honest headline.** Send these links to the worked example with the form beneath it, and try the hero line "Your product idea, designed, costed and ready to launch." in place of "built and on sale", which this audience will check against the example. Measure: share reaching the form and sign-up rate for these sources.
3. **Network and LinkedIn traffic: a person next to the form.** Add the owner's name, face and two sentences beside the early-access form, and make "What do you want to make?" answerable in a few words (a shorter hint, or optional). Hypothesis: people who came because of him want to see him; people from small firms may not want to write their idea down. Measure: form starts against sends for `linkedin` and `personal`.

Experiments 1 and 2 need only a link to a section if the page's sections can be linked to; otherwise each is a small page change for the build team.

---

## 6. What the owner must supply or decide (business only)

| # | Decision | Why it matters | Default if no answer |
|---|---|---|---|
| 1 | **His name and face** on the page and the posts | With no customers, a real person is the cheapest trust there is; Show HN, Reddit and LinkedIn all read better in the first person | Posts go out under his name without a photograph |
| 2 | **Which accounts he already has, with history:** Reddit (age and karma), Hacker News, LinkedIn, Product Hunt, Indie Hackers, YouTube, TikTok, Instagram, X or Bluesky | New accounts are filtered or removed in many communities [S7][S10][S12b]. This decides which of the top 8 are open this week | Assume LinkedIn only; Reddit and Show HN move two to four weeks later while accounts gain history |
| 3 | **Personal profile or a separate one** for this product on LinkedIn, given the consultancy | His network is the top-ranked channel, and it is also his professional audience | Personal profile, one post |
| 4 | **A small paid test, $200 to $500** (Reddit ads aimed at the hardware and 3D-printing subs) | Buys about 200 to 600 visits and a clean read on the page without waiting for a post to catch. The $5,000 marketing budget in the task board is the gadget's, not the service's, so this is a new decision | No paid test |
| 5 | **A contact address** for replies, creator emails and the page | The page shows none. Every email in this plan needs a reply address | None can be sent |
| 6 | **The public product name**, if "Concept to Realization" is not final | Product Hunt, the video profiles and a domain all fix the name | Keep "Concept to Realization" |
| 7 | **A proper domain** in place of the `railway.app` address | Trust, and links less likely to be filtered | Launch on the current address |
| 8 | **A founding-member term** for the 50 (for example the opening price held for a stated period) | Gives the 50 a reason to pay when billing starts. It must be real and written down | No term offered; the drafts leave the bracket out |
| 9 | **A date range he will stand behind** for opening workspaces to the 50 | The first reply to every sign-up should say it; conversion falls with waiting [S21] | "As soon as it is ready", which converts worse |
| 10 | **Whether paid plans get a trial period** | It changes the road to 100 subscribers (4.4). "Nothing free" was ruled; a card-first trial was not ruled in or out | No trial |
| 11 | **Whether to make one real tag and photograph it** before the Hackaday tip and the paid opening | One photograph of a printed, working tag turns "planned" into "made" for every channel | Tip held; copy stays "designed and costed" |
| 12 | **Is the handle-scene line acceptable** on LinkedIn and Product Hunt | It is his joke; it is the one line some professional audiences may not like | Cut C runs without it on LinkedIn |

---

## 7. Sources

Read on 23 November 2026. "Could not read" means the page was blocked or failed.

**Rules pages (primary)**
- S1. Hacker News, Show HN guidelines: https://news.ycombinator.com/showhn.html
- S2. Product Hunt, featuring guidelines: https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines
- S2b. Product Hunt, how Product Hunt works: https://help.producthunt.com/en/articles/17734306-1-how-product-hunt-works
- S3. Hackaday, Submit a tip: https://hackaday.com/submit-a-tip/
- S3b. Hackaday, "How best to get your project on Hackaday" (27 Apr 2021): https://hackaday.com/2021/04/27/how-best-to-get-your-project-on-hackaday
- S7. Reddit Help, "What constitutes spam? Am I a spammer?": https://support.reddithelp.com/hc/en-us/articles/360043504051-What-constitutes-spam-Am-I-a-spammer
- S15. Indie Hackers, "Tips for making successful posts on Indie Hackers" (7 Mar 2020): https://www.indiehackers.com/post/tips-for-making-successful-posts-on-indie-hackers-b04454a57a
- S22. MakerWorld, community guidelines (read in part): https://makerworld.com/community-guidelines

**Communities (third-party descriptions; not rule text)**
- S8. The Hive Index, r/hwstartups (about 43,000 members; the sub's own description quoted): https://thehiveindex.com/communities/r-hwstartups/
- S8b. A read-only Reddit mirror of r/hwstartups, recent posts only, no sidebar: https://redlib.hackliberty.org/r/HWStartups
- S8c. The Hive Index, r/SideProject (about 911,000 members): https://thehiveindex.com/communities/r-sideproject
- S12. Redship, "The complete guide to Reddit self-promotion rules in 2026" (a vendor's summary; opinion): https://redship.io/blog/reddit-self-promotion-rules-2026
- S12b. Indie Hackers, "Every subreddit has different unwritten rules" (a vendor author's summaries; member counts and thresholds are his, undated): https://www.indiehackers.com/post/every-subreddit-has-different-unwritten-rules-and-heres-how-to-decode-them-before-posting-1wSck8RGykjDv4FAwS69
- S18. Hardware newsletters found: https://hardwarefyi.substack.com/about (could not read), https://hackster.io/newsletter/sign_up , https://inboxreads.co/topics/hardware (not read; listed for the owner)
- S23. The Hive Index, hardware communities: https://thehiveindex.com/topics/hardware/

**Launch results**
- S4. Dan F. King, "Show HN by the numbers: 188,000 posts, 14 years of data" (23 Apr 2026). Measured: https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/
- S4b. "Show HN 2025: the numbers behind Hacker News' launchpad" (a second-hand summary of a Sturdy Statistics analysis; method not given): https://news.lavx.hu/article/show-hn-2025-the-numbers-behind-hacker-news-launchpad
- S5. Indie Hackers, "Front page of HN: the full postmortem" (Aidlab, Oct 2025). Anecdote: https://www.indiehackers.com/post/front-page-of-hn-the-full-postmortem-traffic-lessons-surprises-cbe9e0a7f6
- S6. Indie Hackers, "I made it to the first page of Hacker News, here are the numbers" (Jun 2026). Anecdote: https://www.indiehackers.com/post/i-made-it-to-the-first-page-of-hacker-news-here-are-the-numbers-5e36e860c1
- S9. Product Hunt forum, "Reddit marketing: I got 173 visits and 34 signups". Anecdote: https://www.producthunt.com/p/undefined/reddit-marketing-i-got-173-visits-and-34-signups-to-my-visual-research-os-a-story-how-it-happened
- S10. Indie Hackers, "Results from launching on Reddit" (Aug 2023). Anecdote: https://www.indiehackers.com/post/results-from-launching-on-reddit-943b431d47
- S11. Indie Hackers, "100 upvotes, 18k views, 900 users, all from one Reddit post" (Aug 2026). Anecdote: https://www.indiehackers.com/post/100-upvotes-18k-views-900-users-all-from-one-reddit-post-324a597206
- S17. Product Hunt forum, "We placed 3rd on Product Hunt and earned $543". Anecdote: https://www.producthunt.com/p/indiemerger/we-placed-3rd-on-product-hunt-and-earned-543
- S17b. Product Hunt forum, own.page launch (second place). Anecdote: https://www.producthunt.com/p/own-page/1-900-signups-15-800-unique-website-visits-and-own-page-s-product-hunt-launch
- S17c. Product Hunt forum, "What I learned launching solo on Product Hunt, with zero existing audience" (Jul 2026). Anecdote: https://www.producthunt.com/p/wrapt-ai/what-i-learned-launching-solo-on-product-hunt-with-zero-existing-audience
- S17d. Mean CEO blog, "Product Hunt launch statistics (2026)" (a roundup; the Databox figures are second-hand): https://blog.mean.ceo/?p=11218

**Timing and video (measured unless marked)**
- S13. Buffer, "The best time to post on LinkedIn in 2026: 4.8 million posts analyzed": https://buffer.com/resources/best-time-to-post-on-linkedin/
- S14. Buffer, "The best time to post on social media in 2026" (52 million posts): https://buffer.com/resources/best-time-to-post-social-media
- S16. Metricool, Short Video Report 2026 (6,177,375 videos, 375,462 accounts): https://metricool.com/short-video-report-2026 ; the figures by account size were read through Merca2.0 (17 Nov 2026): https://www.merca20.com/tiktok-is-the-best-platform-for-starting-from-scratch-small-accounts-get-nearly-2500-views-per-video/
- S19. ChannelCrawler, "Cold outreach: 7 steps to get seen and replied to" (a vendor; opinion, no data): https://channelcrawler.com/insights/strategy-and-data/email-youtubers-get-reply

**Benchmarks carried over from the conversion review**
- S20. Unbounce, Conversion Benchmark Report, SaaS: https://unbounce.com/conversion-benchmark-report/saas-conversion-rate/
- S21. Lenny Rachitsky, "What is good waitlist conversion" (1 Mar 2022; informal poll): https://www.lennysnewsletter.com/p/what-is-good-waitlist-conversion
- S24. ChartMogul, The SaaS Conversion Report (Jan 2026), read through Userpilot's summary: https://chartmogul.com/reports/saas-conversion-report/ and https://userpilot.com/blog/free-trial-conversion-rate/

**Not found**
- A measured sign-up rate for Show HN or Reddit traffic to an early-access form. Only founders' own reports.
- A measured click rate from a short video to a website for small accounts.
- A measured reply rate for cold emails to creators.
- A measured best posting time for the named subreddits.

**Could not check**
- The sidebar rules of r/hwstartups, r/SideProject, r/3Dprinting, r/Entrepreneur, r/startups and the feedback subs (Reddit blocks automated reading). **Read each before posting.**
- Member counts are from third-party listings and differ between sources (r/SideProject is given as 200,000 in two vendor articles and 911,000 in the Hive Index).
- Whether the live page's sections can be linked to directly, and whether a read-only example exists today.
- Product Hunt's current tagline length limit.
- The submission terms of the newsletters in S18.
