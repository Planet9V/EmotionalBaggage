// A small S-expression reader and writer, for the KiCad file this app writes and for reading it
// back in tests. Strings are double-quoted with backslash escapes, as KiCad writes them.
export type SNode = string | { q: string } | SNode[];

/** A quoted string atom (written with quotes) as opposed to a bare token. */
export const qs = (s: string): { q: string } => ({ q: s });

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "");

const atom = (n: SNode) => (typeof n === "string" ? n : Array.isArray(n) ? "" : `"${escape(n.q)}"`);
const isLeafList = (n: SNode[]) => n.every((x) => !Array.isArray(x));

/** Writes a node tree with tabs, one list per line once it holds other lists (KiCad's own layout). */
export function write(n: SNode, depth = 0): string {
  if (!Array.isArray(n)) return atom(n);
  const pad = "\t".repeat(depth);
  if (isLeafList(n)) {
    return `${pad}(${n.map(atom).join(" ")})`;
  }
  const head: string[] = [];
  let i = 0;
  while (i < n.length && !Array.isArray(n[i])) head.push(atom(n[i++]));
  const rest = n.slice(i).map((x) => (Array.isArray(x) ? write(x, depth + 1) : `${"\t".repeat(depth + 1)}${atom(x)}`));
  return `${pad}(${head.join(" ")}\n${rest.join("\n")}\n${pad})`;
}

/** Reads one S-expression. Quoted strings come back as { q }, bare tokens as strings. */
export function parse(text: string): SNode {
  let i = 0;
  const n = text.length;
  const ws = () => {
    while (i < n && /\s/.test(text[i])) i++;
  };
  const read = (): SNode => {
    ws();
    if (i >= n) throw new Error("unexpected end of input");
    const ch = text[i];
    if (ch === "(") {
      i++;
      const list: SNode[] = [];
      for (;;) {
        ws();
        if (i >= n) throw new Error("unclosed list");
        if (text[i] === ")") {
          i++;
          return list;
        }
        list.push(read());
      }
    }
    if (ch === ")") throw new Error(`unexpected ) at ${i}`);
    if (ch === '"') {
      i++;
      let s = "";
      for (;;) {
        if (i >= n) throw new Error("unclosed string");
        const c = text[i++];
        if (c === "\\") {
          const e = text[i++];
          s += e === "n" ? "\n" : e === "t" ? "\t" : e;
        } else if (c === '"') return { q: s };
        else s += c;
      }
    }
    let s = "";
    while (i < n && !/[\s()"]/.test(text[i])) s += text[i++];
    return s;
  };
  const root = read();
  ws();
  if (i !== n) throw new Error(`trailing text at ${i}`);
  return root;
}

/** Helpers for reading parsed trees. */
export const head = (n: SNode) => (Array.isArray(n) && typeof n[0] === "string" ? n[0] : null);
export const children = (n: SNode, name: string): SNode[][] => (Array.isArray(n) ? (n.filter((x) => Array.isArray(x) && x[0] === name) as SNode[][]) : []);
export const child = (n: SNode, name: string): SNode[] | null => children(n, name)[0] ?? null;
export const text = (n: SNode | undefined): string => (n === undefined ? "" : typeof n === "string" ? n : Array.isArray(n) ? "" : n.q);
export const num = (n: SNode | undefined): number => Number(text(n));
