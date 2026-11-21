import type { Metadata } from "next";
import { headers } from "next/headers";

/**
 * The address this page was asked for, as the base for the Open Graph image's absolute URL. The app has no
 * configured public address, so it is read from the request: the Host header (X-Forwarded-Host and -Proto when
 * a reverse proxy sets them). A value that is not a plain host name falls back to localhost.
 */
async function siteBase(): Promise<URL> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  const safeHost = /^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host) ? host : "localhost:3000";
  const local = /^(localhost|127\.|\[::1\])/.test(safeHost);
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0]!.trim();
  return new URL(`${proto === "http" || proto === "https" ? proto : local ? "http" : "https"}://${safeHost}`);
}

/** Title, description, canonical address and Open Graph and Twitter cards for one public page. */
export async function publicPageMetadata(o: { title: string; description: string; path: string }): Promise<Metadata> {
  const image = { url: "/landing/og.jpg", width: 1200, height: 630, alt: "The schematic page of Concept to Realization in the dark theme, with the product name below it." };
  return {
    metadataBase: await siteBase(),
    title: o.title,
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: { type: "website", title: o.title, description: o.description, url: o.path, siteName: "Concept to Realization", images: [image] },
    twitter: { card: "summary_large_image", title: o.title, description: o.description, images: [image.url] },
  };
}
