"use client";

import type { ViewProps } from "./types";

export function SourcingView({ section }: ViewProps) {
  return <p className="text-sm text-secondary">{section.label} is being built.</p>;
}
