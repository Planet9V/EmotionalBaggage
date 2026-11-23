import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminView } from "@/components/admin/AdminView";
import { PageHeader } from "@/components/PageHeader";
import { LoadingBlocks } from "@/components/ui/states";
import { ADMIN_AREA_NOTICE } from "@/lib/admin/guard";
import { adminPageOpen } from "@/lib/admin/pageGate";

export const metadata: Metadata = { title: "Admin · Shipwright" };

// Decided per request: with the new sign-in on, the admin area is the platform administrator's (src/lib/admin/pageGate.ts).
// The tab comes from ?tab= through useSearchParams, so the view sits inside a Suspense boundary.
export default async function Page() {
  await connection();
  if (!(await adminPageOpen(await headers()))) {
    return (
      <>
        <PageHeader eyebrow="Workbench" title="Admin" nextStep={false} />
        <div className="px-4 py-6 sm:px-8">
          <p role="note" className="max-w-2xl rounded-xl bg-info-soft px-4 py-3 text-sm text-info" data-testid="admin-area-closed">
            {ADMIN_AREA_NOTICE}
          </p>
        </div>
      </>
    );
  }
  return (
    <Suspense fallback={<div className="px-8 py-6"><LoadingBlocks rows={2} label="Opening Admin" /></div>}>
      <AdminView />
    </Suspense>
  );
}
