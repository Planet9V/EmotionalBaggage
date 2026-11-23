// The mail interface (trial task 4): three messages in plain sentences, the same words as text and HTML, and a sender
// that writes to the log and sends nothing.
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentMailSender, render } from "@/lib/auth2/mail";

afterEach(() => vi.restoreAllMocks());

const LINK = "http://localhost:3322/auth/confirm?token=abc&x=<y>";

describe("mail", () => {
  it("builds the confirmation email with the link, how long it works, and what to do if unasked", () => {
    const m = render({ kind: "confirm-email", to: "ada@example.test", name: "Ada", link: LINK });
    expect(m.to).toBe("ada@example.test");
    expect(m.subject).toBe("Confirm your email address for Concept to Realization");
    expect(m.text).toContain("Hello Ada,");
    expect(m.text).toContain(`Confirm my address: ${LINK}`);
    expect(m.text).toContain("24 hours");
    expect(m.text).toMatch(/did not create an account/);
  });

  it("builds the reset email: once, one hour, signs out everywhere", () => {
    const m = render({ kind: "reset-password", to: "a@example.test", link: LINK });
    expect(m.subject).toBe("Choose a new password for Concept to Realization");
    expect(m.text).toContain("Hello,");
    expect(m.text).toContain("works once, for one hour");
    expect(m.text).toContain("signs this account out everywhere");
  });

  it("builds the invitation email naming who invited and to which workspace", () => {
    const m = render({ kind: "invitation", to: "b@example.test", link: LINK, workspace: "Bag Lab", inviter: "Ada" });
    expect(m.subject).toBe("Ada invited you to Bag Lab on Concept to Realization");
    expect(m.text).toContain("works for 7 days");
    expect(render({ kind: "invitation", to: "b@example.test", link: LINK, workspace: "Bag Lab", inviter: "Ada", days: 3 }).text).toContain("works for 3 days");
  });

  it("escapes names and links in the HTML", () => {
    const m = render({ kind: "invitation", to: "b@example.test", link: LINK, workspace: "<script>x</script>", inviter: "A & B" });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("A &amp; B");
    expect(m.html).toContain('href="http://localhost:3322/auth/confirm?token=abc&amp;x=&lt;y&gt;"');
  });

  it("outside production, with no mail service, the sender writes to the log and sends nothing", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await (await currentMailSender())!.send(render({ kind: "confirm-email", to: "c@example.test", link: LINK }));
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toMatch(/^\[auth2 mail, not sent\] to c@example.test: Confirm your email address/);
  });

  it("in production with no mail service there is no sender ('no mail' mode)", async () => {
    const env = process.env as Record<string, string | undefined>;
    const keep = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      expect(await currentMailSender()).toBeNull();
    } finally {
      env.NODE_ENV = keep;
    }
  });
});
