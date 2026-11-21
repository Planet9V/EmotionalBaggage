import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { contrastReport } from "@/lib/content/landing";
import { param, projectOf } from "@/lib/content/http";
import { renderLanding } from "@/lib/content/load";

/** The landing page as HTML, drawn from its section rows. Not published anywhere: this is what the preview frame shows. */
export const GET = route(async (req: Request) => {
  const p = await projectOf(req);
  const s = param(req, "scheme");
  const out = await renderLanding(p.id, p.name, "preview", s === "dark" ? "dark" : s === "light" ? "light" : "auto");
  return NextResponse.json({
    html: out.html,
    problems: out.problems,
    unapproved: out.unapproved,
    sections: out.sections.length,
    contrast: contrastReport(out.env.primary),
  });
});
