// @vitest-environment jsdom
// Review N3: the account screens render without the app shell only while AUTH2 is on. With it off, /auth/... does
// not exist, and its "not found" page sits in the normal shell like any other unknown address.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { adminServer, on, renderWithClient, shimBrowser } from "../admin-ui/harness";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/auth/sign-up", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { Shell } from "@/components/Shell";

beforeEach(() => {
  shimBrowser();
  adminServer([
    on("GET", "/api/projects", () => ({ body: { projects: [] } })),
    on("GET", "/api/auth/me", () => ({ body: { user: { username: "demo", usingDefaultPassword: false } } })),
  ]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the shell around /auth/...", () => {
  it("is left out while AUTH2 is on", () => {
    renderWithClient(<Shell auth2><p>account screen</p></Shell>);
    expect(screen.getByText("account screen")).toBeTruthy();
    expect(screen.queryAllByRole("navigation")).toEqual([]);
  });

  it("is there while AUTH2 is off", async () => {
    renderWithClient(<Shell auth2={false}><p>not found</p></Shell>);
    expect(screen.getByText("not found")).toBeTruthy();
    expect((await screen.findAllByRole("navigation")).length).toBeGreaterThan(0);
  });
});
