// The shopping list: what is still to be bought, grouped by supplier, with totals worked out from the chosen offers.
// Money is added in the currency's minor units (two decimals for dollars, none for yen, three for dinar) so a total is never off by a rounding crumb. No currency conversion: one currency per concept.
import { toCsvText } from "@/lib/csv";
import { DEFAULT_CURRENCY, toInputText, toMinor } from "@/lib/economics/money";
import { readSourcing, type Offer } from "./schemas";

export type ListPart = { id: number; ref: string; title: string; qty: number | null; status: string; data: Record<string, unknown> };

type Line = {
  partId: number;
  ref: string;
  title: string;
  partNumber: string;
  supplier: string;
  url: string;
  checkedAt: string;
  /** pieces still needed */
  need: number;
  packSize: number;
  packs: number;
  /** pieces bought beyond the need, because packs are whole */
  spare: number;
  priceMinor: number;
  totalMinor: number;
};

type Group = { supplier: string; lines: Line[]; totalMinor: number };
export type Shopping = { groups: Group[]; unchosen: { partId: number; ref: string; title: string; need: number; offers: number }[]; totalMinor: number; excluded: { partId: number; ref: string; title: string; why: string }[] };

/** Printed parts, parts in hand and parts already ordered are not on the list. A part with a received quantity needs only the rest. */
export function needOf(p: ListPart): { need: number; why?: string } {
  const qty = p.qty ?? 1;
  if (p.status === "to print") return { need: 0, why: "printed, not bought" };
  if (p.status === "in hand") return { need: 0, why: "already in hand" };
  const o = readSourcing(p.data).order;
  // Already ordered and not yet reported short: nothing is left to order. A short order needs the rest.
  if (o?.status !== "short" && (p.status === "ordered" || o?.status === "ordered" || o?.status === "shipped")) return { need: 0, why: "already ordered" };
  const got = o?.status === "received" ? (o.qtyReceived ?? qty) : (o?.qtyReceived ?? 0);
  const need = Math.max(0, qty - got);
  return need === 0 ? { need: 0, why: "received" } : { need };
}

const chosenOffer = (p: ListPart): Offer | null => {
  const s = readSourcing(p.data);
  return s.offers.find((o) => o.id === s.chosen) ?? null;
};

/** `currency` sets the minor unit the totals are added in; an offer's price is in the concept's one currency. */
export function shoppingList(parts: ListPart[], currency: string = DEFAULT_CURRENCY): Shopping {
  const by = new Map<string, Group>();
  const unchosen: Shopping["unchosen"] = [];
  const excluded: Shopping["excluded"] = [];
  for (const p of parts) {
    const { need, why } = needOf(p);
    if (need === 0) {
      excluded.push({ partId: p.id, ref: p.ref, title: p.title, why: why ?? "nothing needed" });
      continue;
    }
    const o = chosenOffer(p);
    if (!o) {
      unchosen.push({ partId: p.id, ref: p.ref, title: p.title, need, offers: readSourcing(p.data).offers.length });
      continue;
    }
    const packs = Math.ceil(need / o.packSize);
    const price = toMinor(o.price, currency);
    const line: Line = {
      partId: p.id, ref: p.ref, title: p.title, partNumber: o.partNumber ?? "", supplier: o.supplier, url: o.url ?? "", checkedAt: o.checkedAt,
      need, packSize: o.packSize, packs, spare: packs * o.packSize - need, priceMinor: price, totalMinor: packs * price,
    };
    const g = by.get(o.supplier) ?? { supplier: o.supplier, lines: [], totalMinor: 0 };
    g.lines.push(line);
    g.totalMinor += line.totalMinor;
    by.set(o.supplier, g);
  }
  const groups = [...by.values()].sort((a, b) => a.supplier.localeCompare(b.supplier));
  for (const g of groups) g.lines.sort((a, b) => a.ref.localeCompare(b.ref) || a.title.localeCompare(b.title));
  return { groups, unchosen, excluded, totalMinor: groups.reduce((a, g) => a + g.totalMinor, 0) };
}

/** CSV of the list, one row per line, a subtotal row per supplier and a final total. Formula-looking text is neutralised. */
export function shoppingCsv(s: Shopping, currency: string): string {
  const money = (minor: number) => toInputText(minor, currency);
  const head = ["Supplier", "Reference", "Part", "Part number", "Needed", "Pack size", "Packs to buy", "Spare pieces", `Price per pack (${currency})`, `Line total (${currency})`, "Link", "Price checked"];
  const rows: (string | number)[][] = [head];
  for (const g of s.groups) {
    for (const l of g.lines) rows.push([g.supplier, l.ref, l.title, l.partNumber, l.need, l.packSize, l.packs, l.spare, money(l.priceMinor), money(l.totalMinor), l.url, l.checkedAt]);
    rows.push([`${g.supplier} subtotal`, "", "", "", "", "", "", "", "", money(g.totalMinor), "", ""]);
  }
  for (const u of s.unchosen) rows.push(["No supplier chosen", u.ref, u.title, "", u.need, "", "", "", "", "", "", ""]);
  rows.push(s.groups.length ? ["Total", "", "", "", "", "", "", "", "", money(s.totalMinor), "", ""] : ["Total", "Nothing is priced yet", "", "", "", "", "", "", "", "", "", ""]);
  return toCsvText(rows, { trailingNewline: false });
}

/** The per-piece price a chosen offer gives the part (pack price over pack size), for the economics to read. */
export const pieceUnitPrice = (o: Offer): number => Math.round((o.price / o.packSize) * 1e6) / 1e6;
