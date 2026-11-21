// Robustness review S3: a name is judged by what it resolves to, and the address checked is the one connected to.
import { afterEach, describe, expect, it, vi } from "vitest";

const answers: { address: string; family: number }[][] = [];
vi.mock("node:dns", async (orig) => {
  const real = (await orig()) as typeof import("node:dns");
  const lookup = (host: string, opts: unknown, cb: (e: Error | null, list: { address: string; family: number }[]) => void) => {
    if (host.endsWith(".test-rebind")) return cb(null, answers.shift() ?? []);
    return (real.lookup as unknown as (h: string, o: unknown, c: unknown) => void)(host, opts, cb);
  };
  return { ...real, default: { ...real, lookup }, lookup };
});

const { safeFetch, resolveAllowed, checkAddress } = await import("@/lib/net/outbound");

afterEach(() => {
  answers.length = 0;
});

describe("names", () => {
  it("refuses a name that resolves to a metadata address", async () => {
    answers.push([{ address: "169.254.169.254", family: 4 }]);
    const e = (await safeFetch("http://meta.test-rebind/").then(() => null, (x) => x)) as { cause?: { code?: string } } | null;
    expect(e?.cause?.code).toBe("EADDRBLOCKED");
  });

  it("refuses a name when any of its addresses is forbidden", async () => {
    answers.push([
      { address: "127.0.0.1", family: 4 },
      { address: "169.254.169.254", family: 4 },
    ]);
    await expect(resolveAllowed("mixed.test-rebind")).rejects.toMatchObject({ code: "EADDRBLOCKED" });
  });

  it("looks the name up once per connection: a second answer cannot slip in after the check", async () => {
    answers.push([{ address: "127.0.0.1", family: 4 }], [{ address: "169.254.169.254", family: 4 }]);
    // nothing listens on 127.0.0.1:9; what matters is that only the first, checked answer was used
    const e = (await safeFetch("http://twice.test-rebind:9/").then(() => null, (x) => x)) as { cause?: { code?: string } } | null;
    expect(e?.cause?.code).toBe("ECONNREFUSED");
    expect(answers).toHaveLength(1);
  });

  it("checkAddress words the refusal for a save-time check", async () => {
    answers.push([{ address: "fe80::1", family: 6 }]);
    expect(await checkAddress("https://ll.test-rebind/x")).toMatch(/resolves to fe80::1/);
  });
});
