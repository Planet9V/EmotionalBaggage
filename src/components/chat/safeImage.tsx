"use client";

import type { ComponentProps } from "react";

/**
 * True for an image address on this app's own origin ("/api/files/3", or a full address on the same origin).
 * Protocol-relative ("//host/x") and every other origin are not, and neither are data: or blob: addresses.
 */
export function isSameOriginImage(src: unknown, origin: string): boolean {
  if (typeof src !== "string" || !src.trim()) return false;
  const s = src.trim();
  if (s.startsWith("//")) return false;
  try {
    const u = new URL(s, origin);
    return (u.protocol === "http:" || u.protocol === "https:") && u.origin === origin;
  } catch {
    return false;
  }
}

/**
 * The image element for model answers (robustness review S6). A model can write ![t](http://host/track.png),
 * and drawing it would make the browser fetch that address, telling the host the answer was read. Only an
 * image on this app's origin is drawn; any other is shown as its alt text, linked to its address, so the
 * reader can open it on purpose and nothing is fetched by itself.
 */
export function SafeImage({ src, alt, node: _node, ...rest }: ComponentProps<"img"> & { node?: unknown }) {
  void _node;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const text = (typeof alt === "string" && alt.trim()) || "image";
  if (origin && isSameOriginImage(src, origin)) {
    // eslint-disable-next-line @next/next/no-img-element -- markdown images of any size, served by this app
    return <img src={src as string} alt={alt ?? ""} {...rest} />;
  }
  const href = typeof src === "string" && /^https?:\/\//i.test(src.trim()) ? src.trim() : undefined;
  const label = `[image: ${text}]`;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className="text-link underline-offset-4 hover:underline" title="An image from another site, not loaded. Open it on purpose.">
      {label}
    </a>
  ) : (
    <span>{label}</span>
  );
}
