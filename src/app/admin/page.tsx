import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminView } from "@/components/admin/AdminView";
import { LoadingBlocks } from "@/components/admin/shared";

export const metadata: Metadata = { title: "Admin · Concept to Realization" };

// The tab comes from ?tab= through useSearchParams, so the view sits inside a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={<div className="px-8 py-6"><LoadingBlocks rows={2} label="Opening Admin" /></div>}>
      <AdminView />
    </Suspense>
  );
}
