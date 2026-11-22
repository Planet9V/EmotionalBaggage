/**
 * An SMTP MailSender (the interface in ./mail.ts), on nodemailer. Its settings come from Admin, Email
 * (src/lib/admin/mail.ts, getMailSender); nothing here reads the environment.
 *
 * - The server's name is resolved through the app's outbound guard (src/lib/net/outbound.ts, resolveAllowed), and
 *   the connection is made to the checked address, with the name kept for the TLS certificate check.
 * - Every connection has time limits, so a server that never answers cannot hold a request.
 * - A failure is one fixed sentence per kind (plain below); the server's own text and the password never appear.
 */
import nodemailer from "nodemailer";
import { blockedIn, blockedSentence, resolveAllowed } from "@/lib/net/outbound";
import type { MailMessage, MailSender } from "./mail";

type SmtpSecurity = "starttls" | "tls" | "none";

export type SmtpConfig = {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string | null;
  password: string | null;
  fromName: string;
  fromAddress: string;
  /** each phase (connect, greeting, a command) gets this long */
  timeoutMs?: number;
};

export type SmtpSender = MailSender & {
  /** connects, says hello, signs in when a user name is set, and disconnects; sends nothing */
  verify(): Promise<void>;
};

/** An SMTP failure with a sentence safe to show: no password, no message text. */
export class SmtpError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "SmtpError";
  }
}

/**
 * One fixed sentence per kind of failure. The server's own words (its greeting, its error text) are never repeated:
 * the address is typed by the admin and whatever answers there may be no mail server at all (review F3). Only the
 * three-digit SMTP reply code is kept, which is a number.
 */
function plain(e: unknown, cfg: SmtpConfig): SmtpError {
  const err = e as { code?: string; responseCode?: number; message?: string; name?: string };
  const code = err?.code;
  const reply = typeof err?.responseCode === "number" && err.responseCode >= 200 && err.responseCode < 600 ? ` (SMTP ${err.responseCode})` : "";
  const blocked = blockedIn(e);
  if (blocked) return new SmtpError(blockedSentence(blocked), "EADDRBLOCKED");
  if (code === "EAUTH") return new SmtpError(`The mail server refused the user name or password${reply}. Check them in Admin, Email.`, code);
  if (code === "ETIMEDOUT" || code === "ETIMEOUT" || err?.name === "TimeoutError") return new SmtpError(`The mail server did not answer within ${Math.round((cfg.timeoutMs ?? 10_000) / 1000)} seconds.`, code);
  if (code === "ECONNREFUSED") return new SmtpError("Nothing answered at that address and port (connection refused). Check the host and port.", code);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new SmtpError("That mail server name could not be found. Check the host.", code);
  if (code === "ECONNRESET" || code === "ECONNECTION") return new SmtpError("The connection was dropped before the mail server answered.", code);
  if (code === "ETLS" || code === "ESOCKET") return new SmtpError("The secure connection could not be made. Check the security setting: port 465 is usually TLS, 587 STARTTLS.", code);
  if (code === "EPROTOCOL" || code === "EGREETING") return new SmtpError("Something answered at that address, but not as a mail server. Check the host and port.", code);
  if (code === "EENVELOPE") return new SmtpError(`The mail server refused the sender or recipient address${reply}.`, code);
  if (code === "EMESSAGE") return new SmtpError(`The mail server refused the message${reply}.`, code);
  return new SmtpError(`The mail server answered with an error${reply}.`, code);
}

async function transport(cfg: SmtpConfig) {
  const ip = await resolveAllowed(cfg.host); // refuses link-local and metadata addresses, as for every outbound call
  const ms = cfg.timeoutMs ?? 10_000;
  return nodemailer.createTransport({
    host: ip,
    port: cfg.port,
    secure: cfg.security === "tls",
    requireTLS: cfg.security === "starttls",
    ignoreTLS: cfg.security === "none",
    tls: { servername: cfg.host },
    name: "localhost",
    connectionTimeout: ms,
    greetingTimeout: ms,
    socketTimeout: ms,
    dnsTimeout: ms,
    logger: false,
    debug: false,
    ...(cfg.username ? { auth: { user: cfg.username, pass: cfg.password ?? "" } } : {}),
  });
}

export function smtpSender(cfg: SmtpConfig): SmtpSender {
  return {
    async send(m: MailMessage) {
      let t: Awaited<ReturnType<typeof transport>> | null = null;
      try {
        t = await transport(cfg);
        await t.sendMail({ from: { name: cfg.fromName, address: cfg.fromAddress }, to: m.to, subject: m.subject, text: m.text, html: m.html });
      } catch (e) {
        throw plain(e, cfg);
      } finally {
        t?.close();
      }
    },
    async verify() {
      let t: Awaited<ReturnType<typeof transport>> | null = null;
      try {
        t = await transport(cfg);
        await t.verify();
      } catch (e) {
        throw plain(e, cfg);
      } finally {
        t?.close();
      }
    },
  };
}
