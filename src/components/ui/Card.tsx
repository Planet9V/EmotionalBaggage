"use client";

/**
 * Card: a double-bezel plate.
 *
 * `elevated` renders two concentric layers: an outer shell (--bezel-shell tray, hairline
 * border, soft layered ambient shadow from --shadow-plate) holding an inner core
 * (bg-surface, inset top highlight from --bezel-highlight); the shell uses the --bezel-shell tray token. The core radius is the
 * shell radius minus the shell padding, so the curves stay concentric.
 *
 * Where classes go (this matters for grids):
 *  - `className` lands on the SHELL: grid placement (col-span, h-full), group, width.
 *  - `innerClassName` lands on the CORE: padding, flex/grid layout of the content.
 *    The shell adds 6px on every side, so use the old padding minus 6px
 *    (p-6 -> p-[18px], p-8 -> p-[26px]) to keep the content box unchanged.
 *
 * Hover (hoverEffect, default on): the shell border moves toward dutchOrange and the
 * core lifts 2px on the --ease-spring curve. Transform and opacity only, no framer
 * whileHover, and no lift under prefers-reduced-motion.
 *
 * Link variant: pass `href` (or use CardLink) and the shell is the anchor, so the
 * whole plate is one link. Internal hrefs use next/link; `external` opens a new tab.
 *
 * `outlined` and `subtle` stay single-layer plates (no shell) for dense, quiet
 * surfaces; `innerClassName` is merged into `className` for them.
 */
import React from "react";
import Link from "next/link";

type Variant = "elevated" | "outlined" | "subtle";

interface CardBaseProps {
  variant?: Variant;
  hoverEffect?: boolean;
  /** Elevated only: an orange shell border in place of the hairline, for the one card a row leads with. */
  accent?: boolean;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}

export interface CardProps extends CardBaseProps, Omit<React.HTMLAttributes<HTMLElement>, "children" | "className"> {
  href?: undefined;
  /** Element to render the shell as; div by default. */
  as?: "div" | "article" | "li" | "section";
}

export interface CardLinkProps
  extends CardBaseProps,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className" | "href"> {
  href: string;
  external?: boolean;
}

const SHELL_RADIUS = "rounded-[1.75rem]";
// 1.75rem minus the 0.375rem (p-1.5) shell padding and the 1px border: concentric curves.
const CORE_RADIUS = "rounded-[calc(1.75rem-0.375rem-1px)]";

const LIFT =
  "transition-transform duration-300 ease-spring motion-reduce:transition-none";

function join(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function plateClasses(variant: Variant, hoverEffect: boolean, className: string, innerClassName: string, accent = false) {
  if (variant === "elevated") {
    return {
      shell: join(
        accent
          ? "group/plate flex flex-col border border-dutchOrange/60 bg-bezel p-1.5 text-primary shadow-plate"
          : "group/plate flex flex-col border border-hairline bg-bezel p-1.5 text-primary shadow-plate",
        SHELL_RADIUS,
        "transition-colors duration-300 ease-out-soft motion-reduce:transition-none",
        hoverEffect && "hover:border-dutchOrange/40 focus-visible:border-dutchOrange/40",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        className
      ),
      core: join(
        "flex-1 bg-surface shadow-bezel-inset",
        CORE_RADIUS,
        LIFT,
        hoverEffect &&
          "group-hover/plate:translate-y-[-2px] group-focus-visible/plate:translate-y-[-2px] motion-reduce:group-hover/plate:translate-y-0 motion-reduce:group-focus-visible/plate:translate-y-0",
        innerClassName
      ),
    };
  }
  const flat = variant === "outlined" ? "bg-canvas" : "bg-subtle";
  return {
    shell: join(
      "rounded-2xl border border-hairline text-primary",
      flat,
      "transition-[transform,border-color] duration-300 ease-spring motion-reduce:transition-none",
      hoverEffect && "hover:translate-y-[-2px] hover:border-dutchOrange/40 motion-reduce:hover:translate-y-0",
      className,
      innerClassName
    ),
    core: null,
  };
}

export function Card({
  variant = "elevated",
  hoverEffect = true,
  accent = false,
  className = "",
  innerClassName = "",
  children,
  as: Tag = "div",
  ...rest
}: CardProps) {
  const { shell, core } = plateClasses(variant, hoverEffect, className, innerClassName, accent);
  return (
    <Tag {...rest} className={shell}>
      {core === null ? children : <div className={core}>{children}</div>}
    </Tag>
  );
}

export function CardLink({
  variant = "elevated",
  hoverEffect = true,
  accent = false,
  className = "",
  innerClassName = "",
  children,
  href,
  external = false,
  ...anchorProps
}: CardLinkProps) {
  const { shell, core } = plateClasses(variant, hoverEffect, className, innerClassName, accent);
  const body = core === null ? children : <div className={core}>{children}</div>;
  if (external) {
    return (
      <a {...anchorProps} href={href} target="_blank" rel="noopener noreferrer" className={shell}>
        {body}
      </a>
    );
  }
  return (
    <Link {...anchorProps} href={href} className={shell}>
      {body}
    </Link>
  );
}
