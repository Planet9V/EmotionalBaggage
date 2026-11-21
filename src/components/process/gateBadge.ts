import type { StatusTone } from "@/lib/statusTones";
import type { StageView } from "@/lib/process/client";

/** The gate's status in a word, for a StatusBadge. */
export function gateBadge(s: Pick<StageView, "result" | "overridden">): { text: string; tone: StatusTone } {
  if (s.result.met) return { text: "Met", tone: "success" };
  if (s.overridden) return { text: "Passed by override", tone: "info" };
  const left = s.result.checks.filter((c) => !c.met).length;
  return { text: `${left} ${left === 1 ? "check" : "checks"} to meet`, tone: "warning" };
}
