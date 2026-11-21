"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import { conceptQueries } from "@/lib/conceptsClient";

/** The address without `?concept=`, keeping every other parameter. */
export function withoutConcept(pathname: string, params: URLSearchParams) {
  const rest = new URLSearchParams(params);
  rest.delete("concept");
  const qs = rest.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * `?concept=<id>` on any page: when the id is an active concept it becomes the current concept,
 * through the same `select` the sidebar switcher uses, and the parameter is taken off the address
 * (so the address never disagrees with the switcher afterwards). An archived or unknown id leaves
 * the current concept as it is and shows a message with a link to the Concepts page.
 *
 * Rendered by the Shell inside a Suspense boundary, because it reads the search parameters.
 */
export function ConceptFromUrl() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const wanted = params.get("concept");
  const { projects, loading, select } = useProject();
  const known = !!wanted && projects.some((p) => p.id === wanted);
  // Only asked for when the active list has loaded and does not have it: archived, or not there at all.
  // The full list answers both cases without a 404 in the browser console.
  const lookup = useQuery({ ...conceptQueries.all(), enabled: !!wanted && !loading && !known });

  useEffect(() => {
    if (!wanted || !known) return;
    select(wanted);
    router.replace(withoutConcept(pathname, new URLSearchParams(params.toString())), { scroll: false });
  }, [wanted, known, select, router, pathname, params]);

  if (!wanted || known || loading || lookup.isPending) return null;

  const dismiss = () => router.replace(withoutConcept(pathname, new URLSearchParams(params.toString())), { scroll: false });
  const found = lookup.data?.find((c) => c.id === wanted);
  const archived = found?.archivedAt ? found : null;
  return (
    <div role="alert" className="no-print mx-8 mt-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-hairline bg-warning-soft px-4 py-3 text-sm text-primary">
      <p className="min-w-0">
        {archived ? (
          <>The link opens &quot;{archived.name}&quot;, which is archived. Restore it on the Concepts page to open it.</>
        ) : (
          <>
            The link names a concept that is not here: <span className="font-mono break-all">{wanted}</span>.{" "}
            {lookup.error ? `The list of concepts could not be read: ${messageOf(lookup.error)}` : "It may have been deleted."}
          </>
        )}{" "}
        <Link href="/concepts" className="font-medium text-link underline-offset-4 hover:underline">Go to the Concepts page</Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-md px-2 py-0.5 text-xs text-secondary hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
      >
        Dismiss
      </button>
    </div>
  );
}
