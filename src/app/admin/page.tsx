import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminView } from "@/components/admin/AdminView";
import { ErrorPanel, LoadingBlocks } from "@/components/ui/states";
import { platformAdminPage } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "Admin · Concept to Realization" };

// Only the application's administrator sees the area (src/lib/admin/guard.ts); every /api/admin route checks again.
// The section comes from ?tab= through useSearchParams, so the view sits inside a Suspense boundary.
export default async function Page() {
  const who = await platformAdminPage();
  if (who === "signed-out") redirect("/sign-in?next=%2Fadmin");
  if (who === "refused") {
    return (
      <div className="px-8 py-6">
        <ErrorPanel title="Admin is for the administrator" message="Only the application's administrator can open the admin area." todo="Sign in with the administrator's account to change settings." link={null} />
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="px-8 py-6"><LoadingBlocks rows={2} label="Opening Admin" /></div>}>
      <AdminView />
    </Suspense>
  );
}
