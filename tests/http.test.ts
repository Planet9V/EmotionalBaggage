// @vitest-environment jsdom
// The one browser API wrapper: errors carry status and detail, a 401 sends the browser to sign in, and a stored file's bytes are read in one place.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, fetchFileBytes } from "@/lib/http";

const reply = (status: number, body: unknown, bytes?: ArrayBuffer) =>
  vi.fn(async () => ({ ok: status < 400, status, json: async () => body, arrayBuffer: async () => bytes ?? new ArrayBuffer(0) }) as unknown as Response);

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("throws an ApiError with the server's words, the status and the detail", async () => {
    vi.stubGlobal("fetch", reply(409, { error: "Rows are waiting.", detail: { pending: 3 } }));
    const e = await api("/api/x").catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toBeInstanceOf(Error);
    expect(e).toMatchObject({ message: "Rows are waiting.", status: 409, detail: { pending: 3 } });
  });
  it("says what failed when the server said nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => { throw new Error("no body"); } }) as unknown as Response));
    await expect(api("/api/x")).rejects.toThrow("Request failed (500)");
  });
  it("sends JSON headers with a body, and returns the answer", async () => {
    const f = reply(200, { ok: 1 });
    vi.stubGlobal("fetch", f);
    expect(await api("/api/x", { method: "POST", body: "{}" })).toEqual({ ok: 1 });
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ "Content-Type": "application/json" });
  });
  it("sends the browser to sign in on a 401, with the page it was on as next", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { pathname: "/s/design/bom", search: "?item=3", assign });
    vi.stubGlobal("fetch", reply(401, { error: "Sign in to continue." }));
    await expect(api("/api/x")).rejects.toThrow("Sign in to continue.");
    expect(assign).toHaveBeenCalledWith("/sign-in?next=%2Fs%2Fdesign%2Fbom%3Fitem%3D3");
  });
  it("only throws on the sign-in page itself", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { pathname: "/sign-in", search: "", assign });
    vi.stubGlobal("fetch", reply(401, { error: "Wrong password." }));
    await expect(api("/api/x")).rejects.toThrow("Wrong password.");
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("fetchFileBytes", () => {
  it("returns the bytes of a stored file", async () => {
    const f = reply(200, {}, new Uint8Array([1, 2, 3]).buffer);
    vi.stubGlobal("fetch", f);
    expect(new Uint8Array(await fetchFileBytes(7))).toEqual(new Uint8Array([1, 2, 3]));
    expect(f.mock.calls[0][0]).toBe("/api/files/7");
  });
  it("fails with the caller's sentence, or a plain one, and signs out on a 401", async () => {
    vi.stubGlobal("fetch", reply(404, {}));
    await expect(fetchFileBytes(7)).rejects.toThrow("Request failed (404)");
    await expect(fetchFileBytes(7, (s) => `The file could not be fetched (${s}).`)).rejects.toThrow("The file could not be fetched (404).");
    const assign = vi.fn();
    vi.stubGlobal("location", { pathname: "/s/design/model", search: "", assign });
    vi.stubGlobal("fetch", reply(401, {}));
    await expect(fetchFileBytes(7)).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalled();
  });
});
