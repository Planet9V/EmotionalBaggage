// "Test connection" for Payments, Email and Voice, in the same form as the other tests in ./connection.ts: one
// cheap call with a time limit, through the outbound guard, answered as { ok, message } in plain words. Each tests
// the SAVED values (save first). Secrets never appear in an answer.
import { getCredential } from "@/lib/settings";
import { secretFor, stripeApiBase } from "@/lib/secretOrigin";
import { getSpeechSynthesizer, SpeechError } from "@/lib/voice/speech";
import { call, httpFailure, readJson, type TestResult } from "./connection";
import { getMailSender, MailNotConfigured, readMailSettings } from "./mail";
import { SmtpError } from "@/lib/auth2/smtpSender";
import { stripeMode } from "./stripe";

/** A harmless read: GET /v1/balance answers for any working secret key and changes nothing. */
export async function testStripe(ms: number): Promise<TestResult> {
  const base = stripeApiBase();
  const [pub, s] = await Promise.all([getCredential("stripe", "publishableKey"), secretFor("stripe", "secretKey", base)]);
  if (s.refused) return { ok: false, message: `The saved secret key is only sent to ${s.boundTo}, not ${base}. Enter it again.` };
  if (!s.value) return { ok: false, message: "No Stripe secret key is saved. Save it first." };
  const key = s.value;
  const mode = stripeMode(key);
  if (pub && stripeMode(pub) !== mode) return { ok: false, message: `The publishable key is a ${stripeMode(pub) ?? "unknown"} key and the secret key a ${mode ?? "unknown"} key. Both must be test keys or both live keys.` };
  const c = await call(`${base}/v1/balance`, { headers: { authorization: `Bearer ${key}` } }, [key], ms);
  if ("fail" in c) return c.fail;
  if (c.res.status === 403 && key.startsWith("rk_")) {
    await c.res.body?.cancel().catch(() => undefined);
    return { ok: true, message: `Stripe accepted the restricted ${mode} key; it may not read the balance, which is fine if billing does not need it.`, detail: { mode } };
  }
  if (c.res.status !== 200) return httpFailure(c.res, "Stripe", [key], "Check the key.");
  const j = (await readJson(c.res)) as { object?: string; livemode?: boolean } | undefined;
  if (j?.object !== "balance") return { ok: false, message: "Something answered, but not Stripe's API." };
  const live = j.livemode === true;
  return { ok: true, message: `Stripe accepted the secret key. It is a ${live ? "live" : "test"} key: ${live ? "real payments would be taken" : "no real money moves"}.`, detail: { mode: live ? "live" : "test" } };
}

/** Connects, greets, signs in when a user name is set, and disconnects. No message is sent. */
export async function testSmtp(ms: number): Promise<TestResult> {
  const setup = await getMailSender({ timeoutMs: ms });
  if (!setup.configured) return { ok: false, message: setup.reason };
  try {
    await setup.sender.verify();
    const s = await readMailSettings();
    return { ok: true, message: `The mail server at ${setup.server} answered${s.mode === "smtp" && s.username ? " and accepted the user name and password" : ""}. No message was sent.` };
  } catch (e) {
    return { ok: false, message: e instanceof SmtpError ? e.message : "The mail server test failed before an answer came back." };
  }
}

/** Sends one short message to the address typed in Admin, Email. */
export async function testMailMessage(to: string, ms: number): Promise<TestResult> {
  const setup = await getMailSender({ timeoutMs: ms });
  if (!setup.configured) return { ok: false, message: setup.reason };
  try {
    await setup.sender.send({
      to,
      subject: "Test message from Concept to Realization",
      text: "This is a test message sent from Admin, Email. The mail server settings work.\n\nConcept to Realization",
      html: "<p>This is a test message sent from Admin, Email. The mail server settings work.</p><p>Concept to Realization</p>",
    });
    return { ok: true, message: `The mail server accepted a test message to ${to}. Check that inbox, and the spam folder.` };
  } catch (e) {
    if (e instanceof MailNotConfigured) return { ok: false, message: e.reason };
    return { ok: false, message: e instanceof SmtpError ? e.message : "The test message could not be sent." };
  }
}

const VOICE_TEST_TEXT = "This is a test of the narration voice.";
/** Larger test audio is not handed back to the browser to play. */
const MAX_PLAYBACK_BYTES = 1_000_000;

/** Synthesises one short sentence, only when a provider is set up. The audio goes back to the browser, never stored. */
export async function testVoice(ms: number): Promise<TestResult> {
  const s = await getSpeechSynthesizer();
  if (!s.configured) return { ok: false, message: s.reason };
  try {
    const { audio, contentType } = await s.synth.synthesize(VOICE_TEST_TEXT, { timeoutMs: ms });
    const kb = Math.max(1, Math.round(audio.byteLength / 1024));
    const who = s.settings.provider === "elevenlabs" ? "ElevenLabs" : "The speech endpoint";
    return {
      ok: true,
      message: `${who} spoke the test sentence: ${kb} KB of ${contentType}.${s.settings.provider === "elevenlabs" ? " ElevenLabs counts the characters against the account's quota." : ""}`,
      detail: audio.byteLength <= MAX_PLAYBACK_BYTES ? { audio: `data:${contentType.split(";")[0]};base64,${Buffer.from(audio).toString("base64")}` } : {},
    };
  } catch (e) {
    return { ok: false, message: e instanceof SpeechError ? e.message : "The voice test failed before an answer came back." };
  }
}
