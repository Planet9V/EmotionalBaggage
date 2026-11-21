// Comparing two rates (two creatives' click-through or conversion) without calling a gap real on
// tiny numbers. The method is Newcombe's hybrid score interval for the difference of two
// independent proportions (method 10 in R. G. Newcombe, "Interval estimation for the difference
// between independent proportions: comparison of eleven methods", Statistics in Medicine 17,
// 873-890, 1998). It builds on the Wilson score interval of each rate, so it behaves at small counts
// and at rates near 0% or 100%, where the plain "Wald" interval does not.

const Z95 = 1.959963984540054;

export type Interval = { low: number; high: number };

/** Wilson score interval for x successes in n trials. Null when n is 0. */
export function wilson(x: number, n: number, z = Z95): Interval | null {
  if (!(n > 0) || x < 0 || x > n) return null;
  const p = x / n;
  const z2 = z * z;
  const centre = 2 * n * p + z2;
  const half = z * Math.sqrt(z2 + 4 * n * p * (1 - p));
  const denom = 2 * (n + z2);
  return { low: Math.max(0, (centre - half) / denom), high: Math.min(1, (centre + half) / denom) };
}

export type Difference = {
  /** a's rate minus b's rate, as fractions */
  difference: number;
  low: number;
  high: number;
  rateA: number;
  rateB: number;
  /** the interval leaves out zero: the data distinguish the two rates at 95% */
  distinguishable: boolean;
  method: string;
};

export const METHOD_NAME = "Newcombe hybrid score interval (method 10), 95%";

/** a: xA of nA, b: xB of nB. Null when either side has no trials. */
export function compareRates(xA: number, nA: number, xB: number, nB: number, z = Z95): Difference | null {
  const wa = wilson(xA, nA, z);
  const wb = wilson(xB, nB, z);
  if (!wa || !wb) return null;
  const pA = xA / nA;
  const pB = xB / nB;
  const d = pA - pB;
  const low = d - Math.sqrt((pA - wa.low) ** 2 + (wb.high - pB) ** 2);
  const high = d + Math.sqrt((wa.high - pA) ** 2 + (pB - wb.low) ** 2);
  return { difference: d, low, high, rateA: pA, rateB: pB, distinguishable: low > 0 || high < 0, method: METHOD_NAME };
}

/** The sentence under a comparison. Says what the interval is and what it means; never "winner". */
export function describeDifference(d: Difference | null, what: string, nameA: string, nameB: string): string {
  if (!d) return `${what}: there are no trials on one side yet, so the two cannot be compared.`;
  const pts = (x: number) => `${(x * 100).toFixed(2)} points`;
  const range = `${pts(d.low)} to ${pts(d.high)}`;
  const gap = `${nameA} ${(d.rateA * 100).toFixed(2)}% against ${nameB} ${(d.rateB * 100).toFixed(2)}% (a gap of ${pts(d.difference)}; ${METHOD_NAME}: ${range})`;
  return d.distinguishable
    ? `${what}: ${gap}. The interval leaves out zero, so the gap is unlikely to be chance alone.`
    : `${what}: ${gap}. The interval includes zero, so these numbers cannot tell the two apart. More clicks or orders are needed before choosing one.`;
}
