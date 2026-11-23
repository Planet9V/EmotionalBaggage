"use client";

/**
 * The count line above an early-access form. Drawn by the server with the count it read; in the browser it follows
 * the page's one store (./places.ts), so every count line on the page shows the same, latest reading.
 */
import { countLine, type PublicPlaces } from "@/lib/accessRequests/shared";
import { cn } from "@/lib/utils";
import { usePlaces } from "./places";

export function CountLine({ initial, compact }: { initial: PublicPlaces; compact: boolean }) {
  const p = usePlaces(initial) ?? initial;
  return (
    // the block that has just given its answer shows the answer alone
    <p className={cn("flex items-center gap-2 font-semibold text-primary group-has-[[data-early-answer]]/early:hidden", compact ? "text-[15px]" : "text-base")} data-early-count={p.left}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
      {countLine(p)}
    </p>
  );
}
