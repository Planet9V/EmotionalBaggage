import { describe, expect, it } from "vitest";
import { scrub } from "@/lib/secrets/scrub";

describe("scrub", () => {
  it("removes the exact values the caller holds, everywhere they occur", () => {
    expect(scrub("a KEY1 b KEY1", ["KEY1", null, undefined, ""])).toBe("a [hidden] b [hidden]");
    expect(scrub("pw hunter22!", "hunter22!")).toBe("pw [hidden]");
  });

  it("removes a secret that contains another whole", () => {
    expect(scrub("x abcdef y", ["abc", "abcdef"])).toBe("x [hidden] y");
  });

  it("returns the text unchanged when there is nothing to hide", () => {
    expect(scrub("connection refused at 10.0.0.2:8080")).toBe("connection refused at 10.0.0.2:8080");
  });

  it("hides a bearer token and a basic credential without being given the value", () => {
    expect(scrub("401 for Authorization: Bearer abc.DEF-123_x~y+z/==")).toBe("401 for Authorization: Bearer [hidden]");
    expect(scrub("sent Basic dXNlcjpwYXNz")).toBe("sent Basic [hidden]");
  });

  it("hides provider keys", () => {
    expect(scrub("token sk-abcdefghijkl and Bearer xyz")).toBe("token [hidden] and Bearer [hidden]");
    expect(scrub("key sk-proj-AbC_123-xyz987 rejected")).toBe("key [hidden] rejected");
    expect(scrub("or-v1-abcdef123456")).toBe("[hidden]");
  });

  it("hides a key in a URL query, keeping the rest of the address", () => {
    expect(scrub("GET https://api.example.com/v1/x?api_key=SEKRET123&limit=5 failed")).toBe("GET https://api.example.com/v1/x?api_key=[hidden]&limit=5 failed");
    expect(scrub("https://h/p?limit=5&access_token=abc.def&x=1")).toBe("https://h/p?limit=5&access_token=[hidden]&x=1");
    expect(scrub("https://h/p?KEY=zzz")).toBe("https://h/p?KEY=[hidden]");
  });

  it("hides basic auth in a URL", () => {
    expect(scrub("fetch https://admin:s3cr3t@10.0.0.5/rr_status failed")).toBe("fetch https://[hidden]@10.0.0.5/rr_status failed");
    expect(scrub("ftp://token123@host/file")).toBe("ftp://[hidden]@host/file");
    expect(scrub("postgres://app:pa%40ss@db:5432/c2r")).toBe("postgres://[hidden]@db:5432/c2r");
  });

  it("hides a key inside JSON", () => {
    const body = JSON.stringify({ error: "bad", api_key: "abc\"def", nested: { password: "p w", token: "t0k3n", limit: 5 } });
    const out = scrub(body);
    expect(out).not.toContain("abc");
    expect(out).not.toContain("p w");
    expect(out).not.toContain("t0k3n");
    expect(out).toContain('"limit":5');
    expect(JSON.parse(out).api_key).toBe("[hidden]");
  });

  it("hides name=value pairs in a log line", () => {
    expect(scrub("login failed password=hunter2x user=bob")).toBe("login failed password=[hidden] user=bob");
  });

  it("does not hide ordinary words that only resemble a name", () => {
    expect(scrub("the monkey said no; keyboard layout; author: Ada")).toBe("the monkey said no; keyboard layout; author: Ada");
  });
  it("hides a Perplexity key by its shape and by its value", () => {
    expect(scrub("bad key pplx-abcdef123456 sent")).not.toContain("abcdef123456");
    expect(scrub("rejected abc", "abc")).toBe("rejected [hidden]");
  });
});
