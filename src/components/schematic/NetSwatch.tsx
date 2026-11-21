import { cn } from "@/lib/utils";
import { NET_COLOR, type NetClass } from "@/lib/domain";
import { CLASS_LABEL } from "./model";

/** A coloured stroke and the class name: the word carries the meaning, the colour supports it. */
export function NetSwatch({ netClass, className = "" }: { netClass: NetClass; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className="inline-block h-[3px] w-4 rounded-full" style={{ background: NET_COLOR[netClass] }} />
      <span>{CLASS_LABEL[netClass]}</span>
    </span>
  );
}
