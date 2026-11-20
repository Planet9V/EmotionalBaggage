// shadcn/ui class-merge helper. clsx composes conditional class lists; twMerge
// resolves Tailwind conflicts (last wins) so component variant classes can be
// overridden by the caller's className. Standard shadcn/ui utility.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
