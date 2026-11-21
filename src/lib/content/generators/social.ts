// 8.11 Social posts, one generator per channel. Each post is tied to one message, within the channel's
// limit, with media chosen from the imagery list (shot keys). Posting is done elsewhere: these are rows.
import { z } from "zod";
import type { Generator } from "@/lib/ai/drafts/types";
import { SOCIAL_CHANNELS, checkSocial, refusals, type SocialSpec } from "../channels";
import { SHOTS } from "@/lib/market/imagery";
import { CONTENT } from "../schemas";
import { BASE_FROM, CONTENT_RULES, blockedNoMessage, clean, cleanBlock, commonRow, header, messagesBlock, proofBlock, resolve, voiceBlock, withProof } from "./shared";

const row = z.object({ ...commonRow, text: z.string().min(1).max(4000), postTitle: z.string().max(300).optional(), mediaShotKeys: z.array(z.string().max(60)).max(4).default([]) });
type Row = z.infer<typeof row>;

function socialGenerator(spec: SocialSpec): Generator<Row> {
  return {
    id: `social-${spec.id}`,
    label: spec.label,
    action: `Draft a week of ${spec.label} posts`,
    from: [...BASE_FROM, "marketing/imagery"],
    to: CONTENT.social,
    kind: "section",
    applies: () => true,
    revises: false,
    blocked: blockedNoMessage,
    buildPrompt: (ctx) => {
      const shots = (ctx.rows["marketing/imagery"] ?? []).map((i) => `- "${String(i.data.shotKey ?? "")}": ${i.title}${i.data.fileId ? " (file ready)" : " (no file yet)"}`);
      const keys = shots.length ? shots.join("\n") : SHOTS.map((s) => `- "${s.key}": ${s.title}`).join("\n");
      return {
        system: [
          `You write ${spec.label} posts for a product: seven posts, one for each day of a week, each a different angle on one approved message (they may use different messages).`,
          `Each post: "text" at most ${spec.max} characters${spec.xWeight ? " (emoji count 2, a web address counts 23)" : ""}${spec.title ? `; "postTitle" at most ${spec.title.max} characters` : ""}. No hashtags unless they add meaning, at most two. No web addresses: the poster adds the link.`,
          `"mediaShotKeys": zero to two keys from the imagery list below that suit the post.`,
          CONTENT_RULES,
        ].join("\n\n"),
        user: [header(ctx), messagesBlock(ctx), proofBlock(ctx), voiceBlock(ctx), `Imagery list:\n${keys}`].join("\n\n"),
      };
    },
    schema: row,
    toDraft(r, ctx, run) {
      if (run.index >= 7) return { ok: false, reason: "only seven posts are kept per run" };
      const res = resolve(ctx, r.messageId, r.proofIds);
      if (!res.ok) return res;
      const text = cleanBlock(r.text);
      const postTitle = r.postTitle ? clean(r.postTitle) : "";
      const problems = checkSocial(spec, text, postTitle);
      const hard = refusals(problems);
      if (hard.length) return { ok: false, reason: `over ${spec.label}'s limit: ${hard.map((h) => h.message).join(" ")}` };
      const known = new Set((ctx.rows["marketing/imagery"] ?? []).map((i) => String(i.data.shotKey ?? "")).concat(SHOTS.map((s) => s.key)));
      const media = r.mediaShotKeys.filter((k) => known.has(k));
      const title = (postTitle || text).slice(0, 90);
      const data = withProof(ctx, CONTENT.social, title, text, { channel: spec.label, ...(postTitle ? { postTitle } : {}), mediaShotKeys: media }, res.r);
      return { ok: true, drafts: [{ title, body: text, data, op: { op: "add" }, basedOn: r.basedOn }], notes: problems.map((p) => `${title.slice(0, 30)}: ${p.message}`) };
    },
  };
}

export const socialGenerators = SOCIAL_CHANNELS.map(socialGenerator);
