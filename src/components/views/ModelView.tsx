"use client";

import type { ViewProps } from "./types";

export function ModelView({ section }: ViewProps) {
  return <p className="text-sm text-secondary">{section.label} is being built.</p>;
}
