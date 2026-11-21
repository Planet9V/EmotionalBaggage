import { cn } from "cn"

type Props = React.ComponentProps<"div">

/**
 * A grey block, decorative only: always hidden from assistive technology, and any label or role passed to
 * it is dropped (a div may not carry an aria-label: axe aria-prohibited-attr). A loading region is
 * announced once, by LoadingShape or LoadingBlocks in ./states, which wrap these.
 */
function Skeleton({ className, ...props }: Props) {
  const rest: Props = { ...props }
  delete rest["aria-label"]
  delete rest["aria-labelledby"]
  delete rest.role
  return <div data-slot="skeleton" {...rest} aria-hidden className={cn("animate-pulse rounded-md bg-accent", className)} />
}

export { Skeleton }
