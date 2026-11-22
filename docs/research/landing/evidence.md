# Landing page, pricing and sign-up: evidence review

Date read for every source: 2026-11-21. Web research only; no application code was touched.

Labels: **measured** = data from a study or dataset; **observed** = usability testing or expert review; **opinion** = guidance or argument with no data of its own; **normative** = a standard or vendor specification that states a requirement (used for W3C and Stripe, where "evidence" is the rule itself).

How to read the numbers: every figure below was taken from the page at the URL beside it, fetched on this run, with the year of the data stated. Pages were read through an extraction tool, so each figure should be re-checked on the page before it is quoted publicly. Almost none of the conversion data is about a product like this one (a paid, self-serve workbench for people with a physical-product idea); the closest populations are B2B SaaS landing pages and B2B self-serve software. E-commerce checkout findings are carried over by analogy and marked as such.

---

## Sources read (37)

### Nielsen Norman Group

**S1. Scrolljacking 101**
- URL: https://www.nngroup.com/articles/scrolljacking-101/
- Published: 2023-08-06 (Sara Paul)
- Measured what, on whom: qualitative usability testing of sites from several industries that alter scrolling (Apple, BBC, Crypto.com and others); participant count not stated.
- Finding: most participants were at least mildly disoriented by altered scrolling, the problem grew with the length of the hijacked section and with text that had to be read inside it, and it was worse on phones; short, storytelling uses below the first screen were tolerated.
- Label: observed

**S2. Scroll Fading 101**
- URL: https://www.nngroup.com/articles/scroll-fading-101/
- Published: 2023-12-08 (Sara Paul)
- Measured what, on whom: qualitative usability testing of sites using fade-in-on-scroll; participant count not stated.
- Finding: content that appears only on scroll makes people think the page has ended and makes fast scrollers miss text; fades work when used on a few elements, played once, and kept between about 100 and 400 ms.
- Label: observed

**S3. The Role of Animation and Motion in UX**
- URL: https://www.nngroup.com/articles/animation-purpose-ux/
- Published: 2020-01-12 (Page Laubheimer)
- Measured what, on whom: expert analysis with product examples; cites Pratt et al. 2010 on motion capturing attention.
- Finding: motion earns its place when it gives feedback, shows a state change, explains where something went, or hints how to interact; decorative motion pulls attention involuntarily and wears thin fast.
- Label: observed (expert review)

**S4. Executing UX Animations: Duration and Motion Characteristics**
- URL: https://www.nngroup.com/articles/animation-duration/
- Published: 2020-02-09 (Page Laubheimer)
- Measured what, on whom: expert guidance drawing on published books and NN/g response-time research; no new study.
- Finding: interface animations should mostly run 100 to 400 ms, about 100 ms for simple feedback and 200 to 300 ms for larger screen changes, with anything at 500 ms or more feeling slow; ease-out for entrances, ease-in for exits; honour reduce-motion settings and avoid parallax and scrolljacking.
- Label: opinion (expert guidance)

**S5. Scrolling and Attention**
- URL: https://www.nngroup.com/articles/scrolling-and-attention/
- Published: 2018-04-15 (Therese Fessenden)
- Measured what, on whom: eye tracking, over 130,000 fixations from 120 participants on 1920x1080 screens across news, shopping, blog and reference pages; compared with a 2010 study.
- Finding: about 57% of viewing time went to the first screen and 74% to the first two (2018 data), down from 80% on the first screen in 2010, so people do scroll but attention falls steeply.
- Label: measured

**S6. How Long Do Users Stay on Web Pages?**
- URL: https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/
- Published: 2011-09-11 (Jakob Nielsen), reporting Liu, White and Dumais (Microsoft Research, SIGIR 2010)
- Measured what, on whom: dwell times from a browser plug-in, 205,873 pages and over 2 billion visits (2010 data).
- Finding: the chance of leaving is highest in the first 10 seconds and stays high for about the next 20, after which people who remain tend to stay for minutes, so the page has to state its value almost at once.
- Label: measured (old data: 2010)

**S7. Show Pricing on B2B Sites**
- URL: https://www.nngroup.com/articles/show-price/
- Published: 2013-12-01 (Hoa Loranger)
- Measured what, on whom: summary of several usability studies with business buyers; counts not given.
- Finding: price was the first thing business buyers looked for, and participants left sites that hid it for competitors that showed it; sample prices for typical cases worked better than calculators.
- Label: observed

**S8. Social Proof in the User Experience**
- URL: https://www.nngroup.com/articles/social-proof-ux/
- Published: 2014-10-19 (Jen Cardello)
- Measured what, on whom: application of Cialdini's principles plus observations from usability sessions; no effect sizes.
- Finding: showing what other people did can help, but small numbers work against you (a participant read a modest share count as a sign of unpopularity) and social widgets add clutter and load time.
- Label: observed

**S9. Website Forms Usability: Top 10 Recommendations**
- URL: https://www.nngroup.com/articles/web-form-design/
- Published: 2016-05-01 (Kathryn Whitenton)
- Measured what, on whom: practitioner guidance; cites Seckler et al. (CHI 2014), where forms that followed usability guidelines were submitted without error on the first try 78% of the time against 42% for forms that did not (2014 data).
- Finding: cut every field that can be dropped, derived or asked later, keep at most one or two optional fields, and lay fields out in one column.
- Label: opinion, resting on one cited measured study

### Baymard Institute (e-commerce checkout; applies to SaaS sign-up by analogy only)

**S10. Delayed account creation**
- URL: https://baymard.com/research-articles/delayed-account-creation
- Published: 2023-09-19 (Edward Scott)
- Measured what, on whom: Baymard's large-scale checkout usability testing and its benchmark of e-commerce sites.
- Finding: asking shoppers to create an account before or during the purchase made some hesitate or stop, and offering it afterwards performed better; 42% of benchmarked sites still interrupt early (2023 benchmark).
- Label: observed, with one benchmark figure

**S11. Make guest checkout the most prominent option**
- URL: https://baymard.com/research-articles/make-guest-checkout-prominent
- Published: 2023-01-17 (Edward Scott)
- Measured what, on whom: usability testing plus a survey of 4,384 US adults (2022 data).
- Finding: 24% of US online shoppers said they had abandoned a purchase in the previous quarter only because the site made them create an account.
- Label: measured (survey) and observed

**S12. Checkout UX 2026: current state**
- URL: https://baymard.com/research-articles/current-state-of-checkout-ux
- Published: 2024-11-13, updated 2026-11-03
- Measured what, on whom: Baymard's 2026 benchmark of leading US and European shops plus a survey of over 1,000 shoppers.
- Finding: 17% of shoppers had abandoned a purchase in the past three months because checkout was too long or complicated, and 68% were reluctant to give a phone number (2026 data).
- Label: measured

### Unbounce

**S13. Conversion Benchmark Report 2024**
- URL: https://unbounce.com/conversion-benchmark-report/
- Published: 2024
- Measured what, on whom: Unbounce-hosted landing pages (see S15 for the dataset).
- Finding: the all-industry median conversion rate was 6.6%, pages written at a 5th to 7th grade reading level converted at 11.1% against 5.3% for professional-level writing, and word count, reading time and long words all correlated negatively with conversion (2023-24 data). Correlation only; no experiment.
- Label: measured

**S14. Conversion Benchmark Report: SaaS**
- URL: https://unbounce.com/conversion-benchmark-report/saas-conversion-rate/
- Published: 2024 edition
- Measured what, on whom: SaaS landing pages within the same dataset.
- Finding: SaaS pages had a 3.8% median conversion rate, well under the all-industry figure, simple copy converted far better than professional-level copy (12.9% against 2.1%), the best pages ran roughly 250 to 725 words, and 79% of SaaS landing-page visits were on mobile (2023-24 data).
- Label: measured

**S15. Conversion Benchmark Report: methodology**
- URL: https://unbounce.com/conversion-benchmark-report/methodology/
- Published: 2024
- Measured what, on whom: describes the dataset: over 41 thousand landing pages, 57 million conversions, over 464 million unique visitors, 23 July 2023 to 23 July 2024.
- Finding: the benchmarks describe Unbounce customers' campaign landing pages (pages with under 50 visitors or no conversions excluded), with "conversion" left undefined on this page, so they include lead forms and click-throughs, not paid sign-ups.
- Label: measured (method note)

### CXL

**S16. Pricing page study, part 2: highlighting a plan and plan order**
- URL: https://conversionxl.com/research-study/pricing-page-study-highlight/
- Published: date not shown
- Measured what, on whom: eye tracking and a choice survey on two versions of one survey tool's pricing page, with participants given a scenario; sample sizes shown only in images.
- Finding: a highlighted plan was looked at sooner when plans ran cheap to expensive (p = 0.0171), and participants picked the highlighted plan more often when the expensive plan came first; one product, hypothetical buyers.
- Label: measured (small lab study)

**S17. Which types of social proof work best?**
- URL: https://cxl.com/research-study/social-proof/
- Published: 2016-09-06, updated 2017-12-01
- Measured what, on whom: eye tracking on a hosting page with eight proof types plus a control, then a recall survey of 1,153 people (2016 data).
- Finding: testimonials with a photo and well-known client logos were recalled as trust-building more than photo-less testimonials and unknown logos, and follower counts made no reliable difference; proof was first looked at only after about 8.3 seconds on average.
- Label: measured

**S18. Value proposition study**
- URL: https://conversionxl.com/research-study/value-proposition-study/
- Published: date not shown
- Measured what, on whom: four versions of the value statement on one financial-services landing page; eye tracking (about 194 people) and a survey (215 people).
- Finding: versions with more descriptive text and bullets were noticed sooner, read longer, and left people better able to say what the service does, while a short paragraph alone performed worst.
- Label: measured (small lab study)

**S19. Form design principles: 13 best practices**
- URL: https://cxl.com/blog/form-design-best-practices/
- Published: 2022-12-29, updated 2026-11-10 (Alex Birkett)
- Measured what, on whom: review article; reports CXL's own test in which a single-column form (n = 356) was completed about 15.4 seconds faster than a multi-column one (n = 346).
- Finding: single-column forms are faster to complete, and the article itself concedes that cutting fields does not always raise conversion.
- Label: measured for the single-column result; opinion for the rest

**S20. Should you really reduce form fields?**
- URL: https://cxl.com/blog/reduce-form-fields/
- Published: 2019-08-28, updated 2022-12-20 (Shanelle Mullin)
- Measured what, on whom: collected third-party tests; the one with numbers in the text is a lead form where removing 3 of 9 fields lowered conversion by 14%, and rewording the labels on all 9 raised it by 19.2% (year of test not shown).
- Finding: fewer fields is not a law; which fields are asked and how they are worded can matter more than the count.
- Label: measured (single case studies, weak)

### Self-serve pricing and free-to-paid conversion

**S21. ChartMogul: The SaaS Conversion Report**
- URL: https://chartmogul.com/reports/saas-conversion-report/
- Published: 2026-02-04 (Kyle Poyar, with ChartMogul and ProductLed)
- Measured what, on whom: survey of 200 B2B software products run in January 2026; self-reported; conversion means free sign-ups who pay within six months.
- Finding: median free-to-paid conversion was 8%; trials that ask for a card converted about 30% of sign-ups, more than five times those that do not, but drew fewer sign-ups (3.5% of visitors against 4.5% for a card-free trial and 9% for a free plan), netting roughly 10.5 paying customers per 1,000 visitors against 3.6 for a card-free trial and about 5 for a free plan; 80% of trial products ask for no card and 62% use a 14-day trial (2026 data).
- Label: measured (survey; the per-1,000 funnel is the report's model built from averages)

**S22. Lenny's Newsletter: What is a good free-to-paid conversion rate**
- URL: https://www.lennysnewsletter.com/p/free-trial-conversion-guide
- Published: 2023-08-01 (Kyle Poyar with Lenny Rachitsky)
- Measured what, on whom: survey of over 1,000 products run with OpenView, Growth Unhinged and Pendo, mostly B2B SaaS (2023 data).
- Finding: self-serve free plans counted as "good" at 3 to 5% free-to-paid and free trials at 8 to 12%, while free plans signed up about 9% of visitors against about 5% for trials.
- Label: measured (survey)

**S23. Paddle: The state of freemium**
- URL: https://paddle.com/blog/state-of-freemium
- Published: date not shown
- Measured what, on whom: no dataset; argument illustrated with a few well-known companies.
- Finding: argues that a free plan lowers acquisition cost and builds habit, without supplying figures of its own.
- Label: opinion

**S24. Navattic: State of the Interactive Product Demo 2026**
- URL: https://navattic.com/report/state-of-the-interactive-product-demo-2026
- Published: 2026 (exact date not shown)
- Measured what, on whom: vendor data from over 40,000 demos built on its own platform, analysing only the top 1%, 10% and 25% by click-through.
- Finding: among the best-performing demos, 66% required no form, and form-free demos had higher engagement (58% against 52%) and completion (49% against 42%) than gated ones (2025-26 data); the report does not measure effect on site conversion.
- Label: measured, but vendor-selected sample of winners; treat as weak

### Google / web.dev

**S25. prefers-reduced-motion: sometimes less movement is more**
- URL: https://web.dev/articles/prefers-reduced-motion
- Published: last updated 2019-03-11 (Thomas Steiner)
- Measured what, on whom: technical guidance.
- Finding: wrap non-essential motion so it runs only when the visitor has expressed no preference, listen for changes to the setting in script, and serve still images in place of animated ones.
- Label: opinion (platform guidance)

**S26. Learn Accessibility: Animation and motion**
- URL: https://web.dev/learn/accessibility/motion
- Published: last updated 2022-09-30
- Measured what, on whom: guidance summarising WCAG; cites that over 35% of adults have had some vestibular dysfunction by age 40 (year of the underlying data not given on the page).
- Finding: nothing may flash more than three times in a second, auto-starting motion lasting over five seconds needs a control, and because system settings differ the page should offer its own motion control as well.
- Label: opinion (platform guidance) citing a standard

**S27. How the Core Web Vitals thresholds were defined**
- URL: https://web.dev/articles/defining-core-web-vitals-thresholds
- Published: 2020-05-21, updated 2025-05-07
- Measured what, on whom: perception research plus Chrome field data on what real sites achieve.
- Finding: "good" means largest contentful paint within 2.5 s, interaction to next paint within 200 ms and cumulative layout shift of 0.1 or less, each at the 75th percentile of visits; layout shifts of 0.15 and above were consistently disruptive in Google's testing.
- Label: measured

**S28. Web Vitals**
- URL: https://web.dev/vitals/
- Published: last updated 2024-10-31
- Measured what, on whom: definition page.
- Finding: a page passes only if all three metrics meet the "good" level at the 75th percentile, split by mobile and desktop, and lab tools cannot measure interaction delay directly.
- Label: normative (Google's definition)

**S29. How to create high-performance CSS animations**
- URL: https://web.dev/articles/animations-guide
- Published: last updated 2020-10-06 (Kayce Basques, Rachel Andrew)
- Measured what, on whom: technical guidance with a demo measurement.
- Finding: animate only transform and opacity; in the article's demo, moving an element with top/left dropped 50% of frames while the transform version dropped 1% (2020 demo).
- Label: observed (demo) and opinion

**S30. Optimize Cumulative Layout Shift**
- URL: https://web.dev/articles/optimize-cls
- Published: 2020-05-05, updated 2025-02-07
- Measured what, on whom: technical guidance.
- Finding: reserve space for images, video, fonts and late content, move things with transform, and note that shifts within 500 ms of a click are forgiven but shifts caused by scrolling are not.
- Label: opinion (platform guidance)

**S31. Sign-up form best practices**
- URL: https://web.dev/articles/sign-up-form-best-practices
- Published: last updated 2020-12-09 (Sam Dutton)
- Measured what, on whom: technical guidance; no statistics.
- Finding: ask for as little as possible at sign-up, never ask for the same thing twice, mark fields up for autofill and password managers, and offer sign-in through an identity provider alongside email.
- Label: opinion

### W3C WCAG 2.2

**S32. Understanding SC 2.2.2 Pause, Stop, Hide (Level A)**
- URL: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide
- Published: page updated 2026-10-04
- Finding: anything that moves, blinks or scrolls, starts on its own, runs longer than five seconds and sits beside other content must have a way to pause, stop or hide it; motion that starts when an element scrolls into view counts as starting on its own.
- Label: normative

**S33. Understanding SC 2.3.3 Animation from Interactions (Level AAA)**
- URL: https://w3c.github.io/wcag/understanding/animation-from-interactions.html
- Published: editor's draft, date not shown
- Finding: motion triggered by the visitor's own action (parallax is named) must be switchable off unless it is essential; honouring the reduce-motion setting is an accepted way to comply; colour and opacity changes that do not move, resize or reshape anything are not "motion".
- Label: normative

**S34. Understanding SC 2.1.1 Keyboard (Level A)**
- URL: https://www.w3.org/WAI/WCAG22/Understanding/keyboard
- Published: page updated 2026-10-04
- Finding: everything the page can do must be doable from the keyboard, with no timing requirement on key presses.
- Label: normative

### Stripe documentation

**S35. Build a subscriptions integration (Stripe-hosted Checkout)**
- URL: https://docs.stripe.com/billing/subscriptions/build-subscriptions.md?payment-ui=checkout&ui=stripe-hosted&platform=web
- Published: date not shown
- Finding: see "What a payment step requires" below.
- Label: normative (vendor specification)

**S36. Configure free trials for Checkout**
- URL: https://docs.stripe.com/payments/checkout/free-trials.md?ui=full-page
- Published: date not shown
- Finding: Checkout collects a payment method for a trial by default; a card-free trial is an explicit setting, and the integrator must choose whether the subscription cancels or pauses if no payment method arrives.
- Label: normative (vendor specification)

**S37. Manage compliance requirements for trials and promotions**
- URL: https://docs.stripe.com/billing/subscriptions/trials/manage-trial-compliance.md
- Published: date not shown
- Finding: card networks impose duties on trials (a reminder before the trial ends, a cancellation link, trial wording on the card statement), and the merchant stays responsible even when not using Stripe's built-in features.
- Label: normative (vendor specification)

### What a payment step requires (from S35 to S37)

Minimum for a paid subscription through Stripe-hosted Checkout:
1. A product and a recurring price for each plan, created in Stripe; the page passes a price ID (or lookup key).
2. A server endpoint that creates a Checkout Session in subscription mode with the chosen price and a success URL, then redirects the browser to the session URL. The button on the page calls this endpoint; no card data touches our page.
3. A success page, and a cancel/return path.
4. A webhook endpoint that verifies signatures and handles at least three events: checkout completed (grant access, store the customer and subscription IDs), invoice paid (keep access), invoice payment failed (tell the customer and send them to update payment).
5. The customer portal configured so customers can at least update their payment method, plus an endpoint that opens a portal session.
6. Tax collection is optional in the API but Stripe says to confirm whether the business collects sales tax, VAT or GST before leaving it out.
7. Stripe suggests using Checkout's custom text for subscription and cancellation terms.

If a trial is offered:
- Trial length is set on the session (maximum 730 days; Stripe notes longer trials convert worse and cards expire).
- Card up front is the default. For a card-free trial set payment-method collection to "if required" and choose cancel or pause at trial end.
- With customer emails on, Stripe sends a reminder 7 days before the trial ends (immediately if the trial is shorter than 7 days), carrying the cancellation link.
- Statement descriptors are limited to 22 characters and trial text overwrites everything after the 10th, so the descriptor must read sensibly in 10.

### Could not read

- **OpenView product benchmarks and blog** (https://openviewpartners.com/blog/your-guide-to-product-led-growth-benchmarks/, https://openviewpartners.com/blog/freemium-vs-free-trial, https://openviewpartners.com/blog/product-benchmarks-2022/): all three URLs now return the firm's home page with no article content. No OpenView findings are reported here. S22 is a survey OpenView co-ran, read at Lenny's Newsletter, and S21 is the 2026 successor by the same author.
- **ProfitWell / Paddle freemium study** (https://paddle.com/studios/shows/profitwell-report/freemium-benchmarks, https://paddle.com/resources/freemium): pages opened but held no study, dataset or benchmark; only the opinion article S23 was usable. No ProfitWell data is reported.
- **NN/g "Video Usability"** (https://nngroup.com/articles/video-usability): rate limited; not read. Nothing below on video rests on it.
- **Baymard average and ideal form-field counts**: the Baymard pages read did not contain those figures, so they are not reported.
- **Stripe docs index pages** (https://docs.stripe.com/payments/checkout/free-trials, https://docs.stripe.com/billing/subscriptions/checkout) returned only a list of variants; the variant pages S35 and S36 were read instead.

---

## 1. What the evidence supports

### Headline and first screen
- Say what the product is and what the visitor gets in the first screen, in plain words. The leave-rate is highest in the first 10 seconds (S6, measured, 2010 data), and the first screen still takes about 57% of viewing time (S5, measured, 2018).
- Plain language outperforms professional-register copy on landing pages, and the gap is larger for SaaS (S13, S14, measured, 2023-24; correlational).
- A headline alone is not enough: in one lab study, a headline plus a few concrete bullets left more people able to say what the service does than a short paragraph did (S18, measured, one page).
- Consequence for an animated hero: the statement of value must be readable at once and must not wait for an animation to finish. This is an inference from S5, S6 and S2, not something any source tested directly.

### One primary action versus several
- No source read on this run measured one call to action against several. See section 4.
- What is supported is narrower: put the key action in the first screen because attention drops after it (S5, measured), and keep it visible outside any scroll-driven section (S1, observed).

### Proof (logos, testimonials, numbers), and what to do with no customers yet
- Recognisable client logos and testimonials with a real photo are remembered as trust-building; unknown logos, photo-less testimonials and follower counts are not (S17, measured, 2016, one page, recall not conversion).
- Small numbers backfire: a modest count reads as "nobody uses this" (S8, observed).
- Proof is looked at late (about 8 seconds in, S17), so it supports a decision rather than making the first impression.
- No customers yet: no source read addresses this directly. What follows is inference. S8 and S17 together say weak proof is worse than none, so leave out counts, unknown logos and anonymous quotes. Substitute things the visitor can check for themselves: a worked example of real output, the price, and what happens after sign-up. Label: inference from observed and measured findings, untested.

### Showing a worked example or demo
- No source read measured the effect of a worked example on sign-up. Indirect support: visitors need concrete detail to understand what a service does (S18, measured), and motion is justified when it explains a change or a sequence (S3, observed).
- Scroll-driven storytelling was tolerated in testing only when short, light on text, below the first screen and surrounded by normally scrolling sections (S1, observed).

### Interactive try-before-signup
- Thin evidence. In a 2026 survey, 38% of products with a free plan let people use the product before creating an account, and the report's model gives ungated free plans a better free-to-paid rate than gated ones (8% against 5.5%) at a somewhat lower sign-up rate (S21, measured, self-reported, modelled).
- A demo vendor reports that its best-performing demos are mostly form-free and that form-free demos are engaged with and completed more (S24, vendor data on a winners-only sample, 2025-26). It does not show an effect on sales.
- By analogy, asking for an account before delivering value makes some people stop, and asking afterwards works better (S10, S11, observed and measured, e-commerce).
- Net: supported as a reasonable bet, not as a proven lift.

### Pricing on the page versus hidden
- Show it. Business buyers looked for price first and left sites that hid it (S7, observed, 2013). For a self-serve product nothing read argues for hiding price.
- Give example prices for typical cases rather than a calculator (S7, observed).
- Highlighting a recommended plan draws the eye to it, and plan order changes which plan people say they would pick (S16, measured, one product, hypothetical choice).

### Free plan versus trial
- Free plans bring in about twice the sign-ups of trials; trials convert a larger share of those sign-ups. Per visitor the two come out close (S21, 2026; S22, 2023; both measured surveys). Neither is clearly better on these data.
- Trials are the more common entry point (57% of surveyed products against 26% for free plans) and 14 days is the usual length (S21, 2026).

### Asking for a card up front
- A card requirement cuts sign-ups modestly and raises the paying share of sign-ups a great deal: about 30% against single digits, and by the report's model roughly three times the paying customers per 1,000 visitors (S21, measured, 2026, self-reported, 200 products, only a fifth of trial products ask for a card).
- Caveats that belong beside that number: it measures payment within six months, not retention or refunds; products that choose a card wall may differ from those that do not; and e-commerce data show forced early commitments drive some people away (S11, measured, 2022).
- If a card is taken for a trial, card-network rules apply: reminder before the trial ends, cancellation link, statement wording (S37, normative).

### Number of sign-up fields
- Ask for the minimum at sign-up and collect the rest later (S9, S31, opinion; S12 for reluctance over phone numbers, measured, 2026).
- Fewer is not automatically better: one test lost conversions after fields were removed and gained from clearer labels (S20, measured, single case). Field relevance and wording matter.
- One column, clear labels, autofill-friendly markup (S19 measured for completion time; S9, S31 opinion). Forms that follow usability guidelines are completed without error far more often (S9 citing Seckler 2014, measured).
- Do not force account creation before the visitor has seen value where that can be avoided (S10, S11, by analogy).

### Page length
- People scroll, but about three quarters of viewing time is spent in the first two screens (S5, measured, 2018). Length is acceptable; burying the essentials is not.
- Shorter, simpler copy correlates with higher conversion on campaign landing pages; best-converting SaaS pages ran about 250 to 725 words (S13, S14, measured, 2023-24, correlational, campaign pages rather than home pages).
- A long narrative page therefore needs few words per section, the value and the action at the top, and visible cues that more follows (S5, S2).

---

## 2. Motion

### What helps
- Motion that explains: feedback on an action, a state change, where something came from or went, how to interact (S3, observed).
- Short durations: about 100 ms for small feedback, 200 to 300 ms for larger changes, nothing at or beyond 500 ms; ease-out in, ease-in out (S4, opinion; S2 observed that fades over about 500 ms were scrolled past).
- Reveal-on-scroll used on a few elements, played once and then left visible, one kind of element at a time (S2, observed).
- A short scroll-driven sequence to walk through a complex product, below the first screen, with little text inside it and ordinary scrolling before and after (S1, observed).

### What harms
- **Scroll hijacking**: disoriented most test participants; worst when long, when text must be read inside it, when direction changes, and on phones; some people thought the page was broken (S1, observed). NN/g advises against it on mobile.
- **Content hidden until scroll**: people conclude the page has ended, or scroll past before text appears; replaying the animation on every pass annoyed them (S2, observed).
- **Decorative or simultaneous motion**: pulls attention away from the message and competes with itself (S3, observed).
- **Autoplaying motion beside content**: distracting, and a Level A failure if it runs past five seconds with no control (S32, normative). Not read on this run: any measured effect of autoplay hero video on conversion.
- **Layout shift**: animating position or size properties moves surrounding content and drops frames (S29, S30). Shifts caused by scrolling count against the layout-shift score even though click-triggered ones are forgiven for 500 ms (S30).
- **Flashing**: never more than three flashes in a second (S26, citing WCAG).

### Performance budget to hold
At the 75th percentile of real visits, mobile and desktop measured separately (S27, S28):
- Largest contentful paint: 2.5 s or less
- Interaction to next paint: 200 ms or less
- Cumulative layout shift: 0.1 or less

Working rules that follow:
- Animate transform and opacity only (S29, S30). Shadows and blurs are costly to paint (S29); many simultaneous opacity changes can be too (S4).
- Reserve dimensions for every image, video, font swap and late-loading block (S30).
- The first-screen headline and main visual must paint without waiting for animation script. This is an inference from the 2.5 s target and S6, not a quoted rule.
- Do not load animation assets for visitors who asked for reduced motion (S25).
- Field data is the test of record; lab tools cannot measure interaction delay (S28).
- Mobile is the main case, not the fallback: 79% of SaaS landing-page visits in the Unbounce data were mobile (S14, 2023-24), and both scroll effects tested by NN/g were worse there (S1, S2).

### Reduced-motion and keyboard requirements
- Honour the system reduce-motion setting. Preferred pattern: motion is opt-in, running only when no preference is expressed; scripted animation must listen for the setting changing (S25).
- With reduced motion on, the page must still work and read completely: all content visible without scroll-triggered reveals, no parallax, no autoplay, stills in place of animated media (S25, S33). Opacity and colour changes that move nothing are not "motion" under 2.3.3 (S33).
- Any motion that starts by itself, including on scroll into view, and lasts over five seconds beside other content needs a pause, stop or hide control. One control for the whole page is recommended. Pausing only while focused does not count (S32, Level A).
- Provide an on-page motion control as well, because system settings differ between platforms (S26).
- Parallax and other interaction-triggered motion should be switchable off (S33, Level AAA, so a target rather than a floor).
- Everything operable by keyboard, including the pause control, any demo, the plan picker and the sign-up form (S34, Level A). That the pause control itself must be keyboard-operable is our reading of 2.1.1 applied to 2.2.2.
- Scroll-driven sections must not trap or override keyboard scrolling; this follows from S34 and S1 but is our inference.

---

## 3. Where sources disagree

- **Form fields.** NN/g says every field removed raises conversion (S9). CXL shows a test where removing fields lowered it and rewording raised it (S20). The stronger position is "ask only what is needed now, and word it well", not "minimise the count".
- **Amount of copy.** Unbounce's field data say fewer and simpler words convert better (S13, S14). CXL's lab study says more descriptive value statements are understood and recalled better (S18). They measure different things (clicks on campaign pages against comprehension in a lab); together they point to short, concrete, plain copy rather than either extreme.
- **Card up front.** Survey data favour a card wall on paying customers per visitor (S21). The e-commerce research shows forced early commitment drives people away (S11), and the same survey shows 80% of trial products choose no card (S21). The data cannot say which holds for a new product with no reputation.
- **Free plan versus trial.** S22 (2023) puts trial conversion clearly above free-plan conversion; S21 (2026) says the gap vanishes once sign-up rates are counted. Same author, later data; the later reading is the safer one.
- **The fold.** S6 (2010 data) stresses the first seconds and the first screen; S5 shows first-screen share of attention fell from 80% (2010) to 57% (2018). Both agree the first screen matters most; they differ on how much can safely sit below it.
- **Scroll-driven storytelling.** NN/g's testing found it mostly harmful yet names storytelling as the one acceptable use (S1). WCAG treats scroll-triggered motion as auto-starting and therefore subject to a pause control (S32). An "animated, narrative" page is defensible only inside those limits.
- **Motion altogether.** NN/g treats purposeful motion as a usability aid (S3); WCAG and web.dev treat motion as a risk to be controlled (S25, S26, S32, S33). These reconcile if motion is short, explanatory and fully removable.
- **Proof.** S8 says social proof helps; S17 finds several common forms of it (unknown logos, follower counts) do nothing measurable. They agree that weak proof does not help.

---

## 4. What is only convention

Commonly done; no evidence for it was found in the sources read on this run. That is not evidence against, only an absence.

- A single primary call to action per page, and repeating the same button down the page.
- Three pricing tiers with the middle one marked "most popular". S16 shows highlighting moves the eye on one page; nothing read shows it raises revenue.
- A monthly/annual toggle on the pricing table.
- "No credit card required" wording beside the button.
- A logo wall directly under the hero. S17 supports well-known logos only, and found proof is looked at late.
- An animated or video hero raising conversion. Nothing read measures it; S1 to S3 only bound the harm.
- Scroll-told product stories converting better than a static page.
- Interactive demos raising paid sign-ups. Only vendor engagement data on a selected sample (S24).
- Sticky header with a sign-up button. S1 notes sticky navigation helps people recover from a bad scroll section, which is a different claim.
- Star ratings, "trusted by N makers" counters and review-site badges for a new product. S8 suggests small counts hurt.
- Sign-in with Google or similar raising sign-up completion. Recommended by S31 without data.
- Multi-step sign-up forms outperforming one short form. Not covered by any source read.
- Countdown timers and limited-time offers. Not measured in anything read; S3 classes animated urgency as a dark pattern.
- A fixed ideal word count or page length. The Unbounce range (S14) describes pages that converted, on campaign traffic, and is not a tested rule.
- 14 days as the right trial length. It is the most common choice (S21), which is all the data say.
