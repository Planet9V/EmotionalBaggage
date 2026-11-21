/** Statuses to offer in a select: the section's list plus the item's own value if it is not in it. */
export function statusOptions(list: string[] | undefined, current: string): string[] {
  const base = list && list.length ? list : [];
  return current && !base.includes(current) ? [...base, current] : base;
}
