// 8.12 Launch email, press note and a three-email sequence outline, from the approved press release.
// A press release counts as approved when its status is reviewed or final. Nothing here sends anything.
import { z } from "zod";
import type { Generator, GenContext } from "@/lib/ai/drafts/types";
import { block } from "@/lib/ai/drafts/prompt";
import { CONTENT } from "../schemas";
import { BASE_FROM, CONTENT_RULES, blockedNoMessage, clean, cleanBlock, commonRow, header, messagesBlock, proofBlock, resolve, voiceBlock, withProof } from "./shared";

const FROM = [...BASE_FROM, "concept/press"];

export const approvedPress = (ctx: GenContext) => (ctx.rows["concept/press"] ?? []).filter((p) => p.status === "reviewed" || p.status === "final");

const blocked = (ctx: GenContext) => blockedNoMessage(ctx) || (approvedPress(ctx).length ? "" : "Mark a press release reviewed or final first (Concept, Press release). The launch pieces are written from it.");

const pressBlock = (ctx: GenContext) => block("Approved press release", approvedPress(ctx), { bodyMax: 6000 });

const emailRow = z.object({ ...commonRow, subjects: z.array(z.string().min(1).max(200)).min(3).max(5), previewText: z.string().max(300), body: z.string().min(1).max(8000) });
const noteRow = z.object({ ...commonRow, subjects: z.array(z.string().min(1).max(200)).min(1).max(3), body: z.string().min(1).max(3000) });
const seqRow = z.object({ ...commonRow, step: z.number().int().min(1).max(3), sendOffsetDays: z.number().int().min(-30).max(60), goal: z.string().min(1).max(400), subjects: z.array(z.string().min(1).max(200)).min(1).max(3), previewText: z.string().max(300).default(""), body: z.string().min(1).max(3000) });

export const launchEmail: Generator<z.infer<typeof emailRow>> = {
  id: "launch-email",
  label: "Launch email",
  action: "Draft the launch email",
  from: FROM,
  to: CONTENT.launch,
  kind: "section",
  applies: () => true,
  revises: false,
  blocked,
  buildPrompt: (ctx) => ({
    system: [
      "You write the launch email from the approved press release: three to five subject lines, one preview text of at most 90 characters, and a body of short paragraphs separated by blank lines, ending with one call to action line. No headings or markup in the body. Dates and prices not on record are written as to be confirmed.",
      "Return exactly one row, tied to one approved message.",
      CONTENT_RULES,
    ].join("\n\n"),
    user: [header(ctx), pressBlock(ctx), messagesBlock(ctx), proofBlock(ctx), voiceBlock(ctx)].join("\n\n"),
  }),
  schema: emailRow,
  toDraft(r, ctx, run) {
    if (run.index > 0) return { ok: false, reason: "only one launch email is drafted per run" };
    const res = resolve(ctx, r.messageId, r.proofIds);
    if (!res.ok) return res;
    const subjects = r.subjects.map(clean);
    const body = cleanBlock(r.body);
    const title = `Launch email: ${subjects[0]}`.slice(0, 200);
    const data = withProof(ctx, CONTENT.launch, title, body, { kind: "email", subjects, previewText: clean(r.previewText), pressReleaseId: approvedPress(ctx)[0]?.id }, res.r);
    return { ok: true, drafts: [{ title, body, data, op: { op: "add" }, basedOn: [...(r.basedOn ?? []), ...approvedPress(ctx).map((p) => p.id)] }], notes: r.previewText.length > 90 ? ["The preview text is over 90 characters; mail apps cut it."] : [] };
  },
};

export const pressNote: Generator<z.infer<typeof noteRow>> = {
  id: "press-note",
  label: "Press note",
  action: "Draft the press note",
  from: FROM,
  to: CONTENT.launch,
  kind: "section",
  applies: () => true,
  revises: false,
  blocked,
  buildPrompt: (ctx) => ({
    system: [
      "You write a short note a founder sends to one journalist or editor to offer the story: one to three subject lines and a body of at most 150 words that says what the product is, why it matters to that reader's audience, what you can offer (a sample, an interview, images) only if on record, and one ask. No attachments are mentioned. Return exactly one row, tied to one approved message.",
      CONTENT_RULES,
    ].join("\n\n"),
    user: [header(ctx), pressBlock(ctx), messagesBlock(ctx), proofBlock(ctx), voiceBlock(ctx)].join("\n\n"),
  }),
  schema: noteRow,
  toDraft(r, ctx, run) {
    if (run.index > 0) return { ok: false, reason: "only one press note is drafted per run" };
    const res = resolve(ctx, r.messageId, r.proofIds);
    if (!res.ok) return res;
    const subjects = r.subjects.map(clean);
    const body = cleanBlock(r.body);
    const title = `Press note: ${subjects[0]}`.slice(0, 200);
    const data = withProof(ctx, CONTENT.launch, title, body, { kind: "press-note", subjects, pressReleaseId: approvedPress(ctx)[0]?.id }, res.r);
    return { ok: true, drafts: [{ title, body, data, op: { op: "add" }, basedOn: [...(r.basedOn ?? []), ...approvedPress(ctx).map((p) => p.id)] }] };
  },
};

export const launchSequence: Generator<z.infer<typeof seqRow>> = {
  id: "launch-sequence",
  label: "Launch sequence",
  action: "Draft the three-email launch sequence",
  from: FROM,
  to: CONTENT.launch,
  kind: "section",
  applies: () => true,
  revises: false,
  blocked,
  buildPrompt: (ctx) => ({
    system: [
      "You outline a three-email launch sequence: step 1 before launch (a teaser), step 2 on launch day, step 3 a follow-up. For each: its step number, the day it goes out as an offset from launch day (negative before), its one goal, one to three subject lines, preview text, and a short body outline of two to four sentences. Return exactly three rows, each tied to one approved message.",
      CONTENT_RULES,
    ].join("\n\n"),
    user: [header(ctx), pressBlock(ctx), messagesBlock(ctx), proofBlock(ctx), voiceBlock(ctx)].join("\n\n"),
  }),
  schema: seqRow,
  toDraft(r, ctx, run) {
    if (run.index >= 3) return { ok: false, reason: "a sequence has three emails" };
    const res = resolve(ctx, r.messageId, r.proofIds);
    if (!res.ok) return res;
    const subjects = r.subjects.map(clean);
    const body = cleanBlock(r.body);
    const title = `Sequence ${r.step}: ${subjects[0]}`.slice(0, 200);
    const data = withProof(ctx, CONTENT.launch, title, body, { kind: "sequence", step: r.step, sendOffsetDays: r.sendOffsetDays, goal: clean(r.goal), subjects, previewText: clean(r.previewText), pressReleaseId: approvedPress(ctx)[0]?.id }, res.r);
    return { ok: true, drafts: [{ title, body, data, op: { op: "add" }, basedOn: [...(r.basedOn ?? []), ...approvedPress(ctx).map((p) => p.id)] }] };
  },
};

export const launchGenerators = [launchEmail, pressNote, launchSequence];
