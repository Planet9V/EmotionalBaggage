// @vitest-environment jsdom
// U4: one error component (title, plain sentence, what to do, a link), Admin links on every not-configured
// or unreachable-service error, an app not-found page, and no raw "fetch failed" shown to a user.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ErrorPanel, LoadError } from "@/components/ui/states";
import { adminLinkFor } from "@/lib/adminLinks";
import { plainMessage, plainNetworkReason } from "@/lib/net/plain";
import { messageOf } from "@/lib/queries";

afterEach(cleanup);

const refused = () => new TypeError("fetch failed", { cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8811"), { code: "ECONNREFUSED" }) });

describe("plain network failures", () => {
  it("never says 'fetch failed'", () => {
    expect(plainNetworkReason(refused())).toBe("nothing is answering at that address");
    expect(plainNetworkReason(new TypeError("fetch failed"))).toBe("it could not be reached");
    expect(plainNetworkReason(Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe("it did not answer in time");
    expect(plainMessage(new Error("The printer refused the file."))).toBe("The printer refused the file.");
    expect(plainMessage(new TypeError("fetch failed"))).toBe("It could not be reached.");
    expect(messageOf(new TypeError("Failed to fetch"))).not.toMatch(/fetch/i);
  });
});

describe("Admin links", () => {
  it("points every set-up problem at the page that fixes it", () => {
    expect(adminLinkFor("No reasoning model is chosen. Choose one in Admin, Models.")?.href).toBe("/admin?tab=models");
    expect(adminLinkFor("Could not reach Perplexity: nothing is answering at that address.")?.href).toBe("/admin?tab=credentials");
    expect(adminLinkFor("The planner service is not running.")?.href).toBe("/admin?tab=models#planner-url");
    expect(adminLinkFor("No slicer service is set up.")?.href).toBe("/admin?tab=printers");
    expect(adminLinkFor("Something", 503)?.href).toBe("/admin?tab=models");
    expect(adminLinkFor("A title is needed.")).toBeNull();
  });
});

describe("ErrorPanel", () => {
  it("shows a title, the sentence, what to do and the Admin link, announced", () => {
    render(<ErrorPanel title="The draft did not run" message="The model host did not answer in 60 seconds." todo="Nothing was saved." onRetry={() => {}} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("The draft did not run");
    expect(alert.textContent).toContain("Nothing was saved.");
    expect(screen.getByRole("link", { name: "Open Admin, Models" }).getAttribute("href")).toBe("/admin?tab=models");
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
  });
  it("a load error caused by a service links to Admin too", () => {
    render(<LoadError what="The plan" message="The planner service is not running." onRetry={() => {}} />);
    expect(screen.getByRole("link", { name: /planner address/ })).toBeTruthy();
  });
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

describe("the source", () => {
  it("has an app not-found page that uses the error panel, and section pages call notFound()", () => {
    expect(existsSync("src/app/not-found.tsx")).toBe(true);
    expect(readFileSync("src/components/NotFoundPanel.tsx", "utf8")).toContain("ErrorPanel");
    expect(readFileSync("src/app/s/[stage]/[section]/page.tsx", "utf8")).toContain("notFound()");
  });
  it("puts no raw Error message in brackets into a sentence for the user", () => {
    const offenders: string[] = [];
    for (const f of [...files("src/app"), ...files("src/lib")]) {
      const s = readFileSync(f, "utf8");
      if (/\(\$\{\(e as Error\)\.message\}/.test(s)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
  it("hides computed times and totals when the planner is down", () => {
    const s = readFileSync("src/components/views/PlanView.tsx", "utf8");
    expect(s).toMatch(/hasSteps && plan\.engine === "networkx"/);
    expect(readFileSync("src/components/plan/PlanGraph.tsx", "utf8")).toContain("no time yet");
  });
});
