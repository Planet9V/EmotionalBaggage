"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BRAND } from "./name";
import "./shipwright.css";


/**
 * The Shipwright mark: a shipwright's mallet standing on its head is a boat. The head is the hull, the handle
 * the mast, and the accent pennant and the water under it are what the knock sets off.
 *
 * Two colours: the mallet in the text colour (currentColor) and the pennant, water and spark in the accent
 * (--sw-accent, else the brand orange). It is decoration next to the written name, so it is hidden from
 * assistive technology. `play` runs the knock once (shipwright.css); `idle` adds a small rock every twelve
 * seconds. With neither, or under reduced motion, it is the finished still.
 */
export function ShipwrightMark({ size = 24, play = false, idle = false, className = "" }: { size?: number; play?: boolean; idle?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`sw-mark${play ? " sw-play" : ""}${idle ? " sw-idle" : ""}${className ? ` ${className}` : ""}`}
    >
      <g className="sw-accent" fill="none" stroke="currentColor" strokeLinecap="round">
        {/* the water the boat is launched onto */}
        <path className="sw-wave" pathLength={1} strokeWidth={2.2} d="M2.6 29q3.35-2.7 6.7 0t6.7 0 6.7 0 6.7 0" />
        {/* the spark off the knock */}
        <g className="sw-spark" strokeWidth={1.8}>
          <path d="M4.2 17.4 1.8 15M27.8 17.4l2.4-2.4M3.2 22.4H.6M28.8 22.4h2.6" />
        </g>
      </g>
      <g className="sw-boat">
        <g className="sw-knock">
          {/* the handle is the mast; the head, with its two iron bands, is the hull */}
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M14.2 5.2a1.8 1.8 0 0 1 3.6 0v11.4h9.2a1.2 1.2 0 0 1 1.1 1.6l-2 6.2a2.4 2.4 0 0 1-2.3 1.7H8.2a2.4 2.4 0 0 1-2.3-1.7l-2-6.2a1.2 1.2 0 0 1 1.1-1.6h9.2zM9 19.2v4.4h1.7v-4.4zM21.3 19.2v4.4H23v-4.4z"
          />
          <path className="sw-sail sw-accent" fill="currentColor" d="M20.6 4.6c4.6 1.9 7.6 5.2 8.2 9.2a.9.9 0 0 1-.9 1h-7.5a.9.9 0 0 1-.9-.9V5.3a.75.75 0 0 1 1.1-.7z" />
        </g>
      </g>
    </svg>
  );
}

/** The mark beside the written name, where it is not a link (a footer line, the line above a heading). */
export function Wordmark({ size = 22, play = false, idle = false, className = "", textClassName = "" }: { size?: number; play?: boolean; idle?: boolean; className?: string; textClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap ${className}`}>
      <ShipwrightMark size={size} play={play} idle={idle} />
      <span className={`font-semibold tracking-tight ${textClassName}`}>{BRAND}</span>
    </span>
  );
}

/**
 * The brand as a link: its accessible name is the written name. The knock plays once when the page loads and
 * again each time the pointer or the keyboard focus arrives (the mark is re-keyed, so the CSS runs from the
 * start; nothing loops in script).
 */
export function BrandLink({ href, size = 24, className = "", textClassName = "text-[15px]", children, ...rest }: { href: string; size?: number; className?: string; textClassName?: string; children?: ReactNode; "data-track"?: string }) {
  const [run, setRun] = useState(0);
  const again = () => setRun((n) => n + 1);
  return (
    <Link
      href={href}
      onPointerEnter={again}
      onFocus={again}
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-sm text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${className}`}
      {...rest}
    >
      <ShipwrightMark key={run} size={size} play idle />
      <span className={`font-semibold tracking-tight ${textClassName}`}>{BRAND}</span>
      {children}
    </Link>
  );
}
