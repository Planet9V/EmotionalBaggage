// A screenshot of the running app, in the light and the dark theme; the one that matches the page's theme is
// shown. The files are made by scripts/landing-shots.mjs at 1184 x 740 and encoded as WebP there, so they are
// served as they are, with their size set (no layout shift) and loaded lazily unless they are above the fold.
const SHOT_SIZE = { width: 1184, height: 740 } as const;

export function Shot({ name, alt, eager = false, theme }: { name: string; alt: string; eager?: boolean; /** one theme only, for the hero */ theme?: "light" | "dark" }) {
  const common = { width: SHOT_SIZE.width, height: SHOT_SIZE.height, decoding: "async" as const, loading: eager ? ("eager" as const) : ("lazy" as const) };
  if (theme) {
    // eslint-disable-next-line @next/next/no-img-element -- pre-encoded WebP at its display size; next/image would re-encode it
    return <img src={`/landing/${name}-${theme}.webp`} alt={alt} {...common} fetchPriority={eager ? "high" : undefined} className="block h-auto w-full" />;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-encoded WebP at its display size */}
      <img src={`/landing/${name}-light.webp`} alt={alt} {...common} className="block h-auto w-full dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- the dark-theme copy; display:none images are not fetched */}
      <img src={`/landing/${name}-dark.webp`} alt={alt} {...common} className="hidden h-auto w-full dark:block" />
    </>
  );
}
