import { describe, expect, it } from "vitest";
import { hashPassword, parseStoredHash, SCRYPT, verifyPassword } from "@/lib/auth";

describe("password hashing", () => {
  it("verifies the password it hashed and refuses another", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(await verifyPassword("correct horse battery stapler", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("stores one self-describing string with the parameters, a salt and the hash", async () => {
    const stored = await hashPassword("pw");
    expect(stored).toMatch(new RegExp(`^scrypt\\$ln=${SCRYPT.ln},r=${SCRYPT.r},p=${SCRYPT.p}\\$[A-Za-z0-9_-]+\\$[A-Za-z0-9_-]+$`));
    const parsed = parseStoredHash(stored)!;
    expect(parsed.salt.length).toBe(SCRYPT.saltLength);
    expect(parsed.key.length).toBe(SCRYPT.keyLength);
    expect(stored).not.toContain("pw$");
  });

  it("gives two different hashes for one password (a random salt each time)", async () => {
    const [a, b] = await Promise.all([hashPassword("same"), hashPassword("same")]);
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("still verifies a hash made with other parameters (they are read from the string)", async () => {
    const cheaper = await hashPassword("old", { ln: 14, r: 8, p: 1 });
    expect(cheaper.startsWith("scrypt$ln=14,r=8,p=1$")).toBe(true);
    expect(await verifyPassword("old", cheaper)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["plain text", "demo"],
    ["another algorithm", "bcrypt$2b$10$abcdefghijklmnopqrstuv"],
    ["missing hash", "scrypt$ln=17,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA"],
    ["bad base64", "scrypt$ln=17,r=8,p=1$!!!!!!!!!!!!!!!!!!!!$????????????????????????"],
    ["cost too high (would allocate gigabytes)", "scrypt$ln=30,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
    ["cost too low", "scrypt$ln=2,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
    ["r zero", "scrypt$ln=14,r=0,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
    ["trailing text", "scrypt$ln=14,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA$x"],
  ])("refuses a malformed stored string (%s) without throwing", async (_name, stored) => {
    expect(parseStoredHash(stored)).toBeNull();
    await expect(verifyPassword("demo", stored)).resolves.toBe(false);
  });

  it("refuses a stored value that is not a string", async () => {
    expect(parseStoredHash(null)).toBeNull();
    expect(parseStoredHash(42)).toBeNull();
    await expect(verifyPassword("x", undefined as unknown as string)).resolves.toBe(false);
  });
});
