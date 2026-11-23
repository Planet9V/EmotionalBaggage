"use client";

// The product's parts, for the side of a 3D view: a grouped, searchable list (the keyboard's way in to the model),
// and, for the part that is chosen, its card: what it does, its size, cost and source, and the nets that join it to
// other parts, each of those a button that goes to it. Every word is read from the example's parts list and
// schematic (model.ts); nothing here is typed in but the names of the controls.
import { useState } from "react";
import { X } from "lucide-react";
import { GET_VIEWS } from "../content";
import { PART_GROUPS, byTagOrder, type Product, type ProductPart } from "./model";

const C = GET_VIEWS.product;
const NET_TONE: Record<string, string> = { power: "border-[#f0a04a]/60 text-[#f6b877]", ground: "border-white/25 text-secondary", signal: "border-[#6ea8ff]/60 text-[#9cc3ff]", audio: "border-[#c5a7f5]/60 text-[#d6c1f8]" };

function Card({ part, product, onChoose, onClose }: { part: ProductPart; product: Product; onChoose: (ref: string) => void; onClose: () => void }) {
  const title = (ref: string) => product.parts.find((p) => p.ref === ref)?.title ?? ref;
  const row = "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 border-t border-hairline py-2 text-[13px] leading-snug";
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-part-card={part.ref}>
      <div className="flex items-start gap-2 border-b border-hairline px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">
            <span className="font-mono font-semibold text-dutchOrange-300">{part.ref}</span> · {C.groups[part.group]}
          </p>
          <h4 className="mt-0.5 text-base font-semibold leading-snug text-primary">{part.title}</h4>
        </div>
        <button type="button" onClick={onClose} aria-label={C.all} className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        <p className="py-3 text-[15px] leading-relaxed text-secondary">{part.does}</p>
        <dl>
          {part.spec ? (
            <div className={row}>
              <dt className="text-muted">{C.size}</dt>
              <dd className="tabular-nums text-primary">{part.spec}</dd>
            </div>
          ) : null}
          {part.qty !== null && part.qty > 1 ? (
            <div className={row}>
              <dt className="text-muted">{C.qty}</dt>
              <dd className="tabular-nums text-primary">{part.qty}</dd>
            </div>
          ) : null}
          {part.cost ? (
            <div className={row}>
              <dt className="text-muted">{C.cost}</dt>
              <dd className="tabular-nums text-primary">
                {part.cost}
                {part.costAt ? <span className="text-secondary">, {part.costAt}</span> : null} <span className="text-muted">({C.costNote})</span>
              </dd>
            </div>
          ) : null}
          {part.source ? (
            <div className={row}>
              <dt className="text-muted">{C.source}</dt>
              <dd className="text-primary">{part.source}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-3 border-t border-hairline pt-3 text-[13px] font-medium text-muted">{C.joins}</p>
        {part.nets.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-secondary">{C.noJoins}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {part.nets.map((n) => (
              <li key={n.net} className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[12px] leading-none ${NET_TONE[n.netClass] ?? NET_TONE.signal}`} title={C.netClass[n.netClass]}>
                  {n.net}
                </span>
                <span className="sr-only">({C.netClass[n.netClass]}) to</span>
                {n.to.map((ref) => (
                  <button key={ref} type="button" onClick={() => onChoose(ref)} title={title(ref)} aria-label={`${ref}, ${title(ref)}`} className="inline-flex min-h-8 items-center rounded-md border border-hairline px-2 font-mono text-[12px] text-primary hover:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus max-md:min-h-11 max-md:px-3">
                    {ref}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        )}
        {part.placed === "illustrative" ? <p className="mt-3 text-[13px] leading-snug text-muted">{C.illustrative}</p> : null}
        {!part.body ? <p className="mt-3 text-[13px] leading-snug text-muted">{C.listOnly}</p> : null}
      </div>
    </div>
  );
}

/**
 * `part` is the chosen part (its card is shown) or null (the list is). `onClose`, where given, puts the panel away
 * (a sheet on a phone, a collapsible panel beside the picture).
 */
export function PartsPanel({ product, part, onChoose, onHover, onClose, searchId }: { product: Product; part: ProductPart | null; onChoose: (ref: string | null) => void; onHover?: (ref: string | null) => void; onClose?: () => void; searchId: string }) {
  const [query, setQuery] = useState("");
  if (part) return <Card part={part} product={product} onChoose={onChoose} onClose={() => onChoose(null)} />;
  const q = query.trim().toLowerCase();
  const groups = PART_GROUPS.map((g) => ({ g, parts: product.parts.filter((p) => p.group === g && (!q || `${p.ref} ${p.title}`.toLowerCase().includes(q))) })).filter((x) => x.parts.length);
  return (
    <>
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <label className="sr-only" htmlFor={searchId}>{C.search}</label>
        <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={C.search} className="h-9 min-w-0 flex-1 rounded-md border border-hairline bg-[#0b0c0e] px-2.5 text-[15px] text-primary placeholder:text-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus max-lg:h-11" />
        {onClose ? (
          <button type="button" onClick={onClose} aria-label={C.close} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3" data-product-parts>
        {groups.length === 0 ? <p className="px-2 py-3 text-[13px] text-secondary">{C.none}</p> : null}
        {groups.map(({ g, parts }) => (
          <div key={g}>
            <p className="px-2 pb-1 pt-3 text-[13px] font-medium text-muted">{C.groups[g]}</p>
            <ul>
              {parts.map((p) => (
                <li key={p.ref}>
                  <button type="button" onClick={() => onChoose(p.ref)} onPointerEnter={() => onHover?.(p.ref)} onPointerLeave={() => onHover?.(null)} className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 py-1 text-left text-[13px] leading-snug text-secondary hover:bg-white/5 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus max-lg:min-h-11">
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <span className="shrink-0 font-mono text-[12px] text-dutchOrange-300">{p.ref}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * The tags a 3D view sets on its parts, in the order they are kept when there is not room for all: the parts with
 * a place of their own, each by its name with a few more words for the pointer; then, for a chosen part, the parts
 * it is joined to and the name of each net half way along the line to them.
 */
export function tagsFor(product: Product, on: boolean, chosen: string | null, only?: (p: ProductPart) => boolean): { ref: string; text: string; note?: string }[] | undefined {
  const part = chosen ? product.parts.find((p) => p.ref === chosen) : null;
  const drawn = new Set(product.parts.filter((p) => p.body).map((p) => p.ref));
  // the parts the chosen one is joined to are named too, so each line ends at a name
  const joined = new Set(part?.nets.flatMap((n) => n.to) ?? []);
  const tags: { ref: string; text: string; note?: string }[] = on || part ? byTagOrder(product.parts.filter((p) => p.body && (p.ref === chosen || joined.has(p.ref) || (on && p.placed !== "illustrative" && (!only || only(p)))))).map((p) => ({ ref: p.ref, text: p.name, note: p.note || undefined })) : [];
  if (part) {
    const nets = new Map<string, string[]>();
    for (const n of part.nets) for (const to of n.to) if (drawn.has(to)) nets.set(to, [...(nets.get(to) ?? []), n.net]);
    for (const [to, names] of nets) tags.push({ ref: `${part.ref}>${to}`, text: names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ") });
  }
  return tags.length ? tags : undefined;
}
