// The Railway layout (docs/guide/railway.md): every service image listens where the platform tells it. The
// planner and the slicer read HOST and PORT (Railway's private network is IPv6 in older environments, so they
// are given HOST=::), the web image reads PORT and HOSTNAME through Next's standalone server, and the health
// checks the guide names exist.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOC_PAGES, readDoc } from "@/lib/docs";

describe("images for a hosted install", () => {
  it("the planner and slicer listen on $HOST:$PORT", () => {
    for (const f of ["planner/Dockerfile", "slicer/Dockerfile"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).toMatch(/ENV HOST=0\.0\.0\.0 PORT=8000/);
      expect(s, f).toMatch(/--host \\"\$HOST\\" --port \\"\$PORT\\"/);
    }
    expect(readFileSync("slicer/Dockerfile", "utf8")).toMatch(/os\.environ\.get\('PORT', '8000'\)/);
  });
  it("the web image listens on $PORT and every interface, behind client-address", () => {
    const s = readFileSync("Dockerfile", "utf8");
    expect(s).toMatch(/PORT=3000 HOSTNAME=0\.0\.0\.0/);
    expect(s).toMatch(/node", "-r", "\.\/client-address\.cjs", "server\.js"/);
  });
  it("the Railway guide is listed under Documentation and says what was deployed and what was not", () => {
    expect(DOC_PAGES.map((d) => d.slug)).toContain("railway");
    const g = readDoc("railway" as never);
    expect(g).toMatch(/slicer has not been deployed/);
    expect(g).toMatch(/Deploy latest commit/);
    for (const v of ["RAILWAY_DOCKERFILE_PATH", "RAILWAY_SHM_SIZE_BYTES", "PLANNER_URL", "SLICER_URL", "TRUST_PROXY", "DATABASE_URL", "railway.internal", "/api/health"]) expect(g).toContain(v);
  });
});
