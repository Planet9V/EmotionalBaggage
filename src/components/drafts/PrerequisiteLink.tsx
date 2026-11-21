"use client";

import Link from "next/link";
import { storeHref, storeLabel } from "@/components/plan/format";
import type { GeneratorInfo } from "@/lib/ai/drafts/shared";

/** Where to go to meet a generator's prerequisite: the first section it reads that is still empty, else the first it reads. */
export function prerequisiteStore(g: Pick<GeneratorInfo, "from" | "counts">) {
  return g.from.find((s) => !(g.counts[s] > 0)) ?? g.from[0] ?? null;
}

/** " Open Design / Parts list." after a blocked hint, so the prerequisite is one click away (U16). */
export function PrerequisiteLink({ generator }: { generator: Pick<GeneratorInfo, "from" | "counts"> }) {
  const store = prerequisiteStore(generator);
  const href = store ? storeHref(store) : null;
  if (!store || !href) return null;
  return (
    <>
      {" "}
      <Link href={href} className="text-link underline">
        Open {storeLabel(store)}
      </Link>
    </>
  );
}
