/**
 * An SMTP MailSender (the interface in ./mail.ts), on nodemailer. Its settings come from Admin, Email
 * (src/lib/admin/mail.ts, getMailSender); nothing here reads the environment.
 *
 * - The server's name is resolved through the app's outbound guard (src/lib/net/outbound.ts, resolveAllowed), and
 *   the connection is made to the checked address, with the name kept for the TLS certificate check.
 * - Every connection has time limits, so a server that never answers cannot hold a request.
 * - Errors are cleaned of the password before anyone sees them; the message itself is never logged here.
 */
import nodemailer from "nodemailer";
import { resolveAllowed } from "@/lib/net/outbound";
import { scrub } from "@/lib/secrets/scrub";
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
class SmtpError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "SmtpError";
  }
}

function plain(e: unknown, cfg: SmtpConfig): SmtpError {
  const err = e as { code?: string; responseCode?: number; message?: string; name?: string };
  const secrets = [cfg.password];
  const code = err?.code;
  if (code === "EAUTH") return new SmtpError(`The mail server refused the user name or password${err.responseCode ? ` (SMTP ${err.responseCode})` : ""}. Check them in Admin, Email.`, code);
  if (code === "ETIMEDOUT" || code === "ETIMEOUT" || err?.name === "TimeoutError") return new SmtpError(`The mail server did not answer within ${Math.round((cfg.timeoutMs ?? 10_000) / 1000)} seconds.`, code);
  if (code === "ECONNREFUSED") return new SmtpError("Nothing answered at that address and port (connection refused). Check the host and port.", code);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new SmtpError("That mail server name could not be found. Check the host.", code);
  if (code === "EADDRBLOCKED") return new SmtpError(scrub(err.message ?? "That address is not allowed.", secrets), code);
  if (code === "ETLS" || /certificate|ssl|tls/i.test(err?.message ?? "")) {
    return new SmtpError(`The secure connection failed: ${scrub(err?.message ?? "", secrets).slice(0, 200)}. Check the security setting: port 465 is usually TLS, 587 STARTTLS.`, code);
  }
  return new SmtpError(`The mail server answered with an error: ${scrub(err?.message ?? String(e), secrets).slice(0, 300)}`, code);
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
