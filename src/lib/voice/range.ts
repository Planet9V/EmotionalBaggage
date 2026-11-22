// One byte range of an HTTP Range header, as audio elements send it ("bytes=0-", "bytes=1000-1999", "bytes=-500").

/**
 * The range asked for, within a body of `size` bytes: null when there is no usable Range header (answer the whole
 * body), "unsatisfiable" when it starts past the end (answer 416). A header naming several ranges is treated as none.
 */
export function byteRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    const last = Number(m[2]);
    if (!last) return "unsatisfiable";
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || end < start) return "unsatisfiable";
  return { start, end };
}
