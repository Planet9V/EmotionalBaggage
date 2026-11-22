<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Walk through the Hotline TTS audio worker flow

Two new artifacts: the **sequence diagram** covering all 13 hops from wizard submit to reveal email, and the **flow spec** with the job payload contract, fragment library layout, and exact ffmpeg command. Here's the walkthrough:

## The design decision that shapes everything

The worker does **not** call a live TTS API. Instead it stitches from a fixed fragment library — 3 intros × 12 locations × 15 insults × 5 trauma-tiered outros, pre-rendered once per voice pack from your contracted VO. Only ~35 files total. That one decision kills three risks at once: near-zero marginal cost (versus \$1–2k of live TTS at 100k tickets), sub-2-second render times, and zero external API dependency the night a claim goes viral.

## Lifecycle, hop by hop

1. **Submit → commit → enqueue.** The Server Action commits the `claim_tickets` row first, *then* enqueues post-commit — never inside the transaction. If the worker is down, the row still exists and a sweeper can re-enqueue later.
2. **Dedup by claim number.** The BullMQ `jobId` is the claim number itself. User mashes submit three times, Stripe-of-moderation retries, whatever — every duplicate collapses into one job.
3. **Optimistic lock.** The consumer re-reads the row `FOR UPDATE` and requires `render_status='pending'`. A replayed job after a crash becomes a no-op instead of a double render.
4. **Fragment resolution.** Claim-number parity picks the intro (so the site doesn't sound like a broken record), the wizard choices pick location and insult, and the trauma slider (1–5) picks the outro tier. Four files, ~200KB.
5. **Cache-warm fetch.** Fragments live in a 512MB LRU disk cache on the worker; steady-state hit rate is >95% since the entire library fits in a shoebox. Cache fills once at boot and validates against an etag manifest.
6. **Single ffmpeg pass.** The concat demuxer joins the four files — no intermediate files on disk — while `loudnorm=I=-16:TP=-1.5` normalizes loudness (critical: loudly inconsistent audio reads "broken toy," not "funny") and short fades hide the splice seams.
7. **Idempotent upload.** `PUT bc-hotline/<claim_no>.mp3`, immutable, year-long cache headers. A retry *overwrites the same key* — safe by construction.
8. **Commit + chain.** The row flips to `rendered`, then two follow-on jobs fire: the reveal email ("Your bag filed its complaint") and the Klaviyo event that drops the lead into the nurture flow.

The reveal page doesn't block on audio: the claim-ticket *image* renders on a parallel, faster queue, so the user sees the fake legal document instantly and the audio player pops in a few seconds later via polling. Cold path end-to-end runs 6–9 seconds; warm cache, 3–4.

## Failure handling

ffmpeg exits non-zero or S3 hiccups → automatic retry at 5s/30s/3min backoff → three strikes lands in the dead-letter queue with an admin alert badge in the moderation inbox. A poisoned fragment file gets quarantined in the manifest rather than poisoning every ticket that touches it.

## Capacity math that matters for launch day

At concurrency 4 with ~2-second stitches, one worker on a single vCPU share handles ~120 renders/minute — comfortably above the 500-concurrent-claim load test target in the spec. If the Complaint Desk stunt lands on the news and tickets spike past that, the scaling answer is boring and correct: one more worker container, done.

The one knob I'd tell you to watch in the first 48 hours isn't throughput — it's the **trauma→outro mapping**. If everyone drags the slider to 5 ("scarred"), the severity-five outro gets old fast; the fix is recording second and third alternates per tier, which is a VO-session line item, not a code change.

