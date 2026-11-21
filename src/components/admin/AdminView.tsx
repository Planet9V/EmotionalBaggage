"use client";

// The Admin area: one page with five tabs. The tab is kept in the address (?tab=) so a link can open one.
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_TABS, isAdminTab, type AdminTab } from "@/lib/admin/client";
import { SetupTab } from "./SetupTab";
import { CredentialsTab } from "./CredentialsTab";
import { ModelsTab } from "./ModelsTab";
import { PrintersTab } from "./PrintersTab";
import { AuditTab } from "./AuditTab";

const LABEL: Record<AdminTab, string> = { setup: "Setup", credentials: "Credentials", models: "Models", printers: "Printers", audit: "Audit log" };

export function AdminView() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab");
  const tab: AdminTab = isAdminTab(raw) ? raw : "setup";
  const go = (t: AdminTab) => router.replace(t === "setup" ? "/admin" : `/admin?tab=${t}`, { scroll: false });

  return (
    <>
      <PageHeader eyebrow="Workbench" title="Admin" nextStep={false} blurb="Models, keys, printers and the audit log for this install. Everything is saved in its own database." />
      <div className="px-8 py-6">
        <Tabs value={tab} onValueChange={(v) => isAdminTab(v) && go(v)} className="gap-5">
          <TabsList className="h-auto w-full max-w-full flex-wrap justify-start gap-1 bg-subtle sm:w-fit">
            {ADMIN_TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="flex-none px-3 py-1.5 data-[state=active]:bg-surface data-[state=active]:text-primary">
                {LABEL[t]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="setup" className="max-w-5xl">
            <SetupTab onOpenTab={go} />
          </TabsContent>
          <TabsContent value="credentials">
            <CredentialsTab />
          </TabsContent>
          <TabsContent value="models" className="max-w-4xl">
            <ModelsTab />
          </TabsContent>
          <TabsContent value="printers" className="max-w-5xl">
            <PrintersTab />
          </TabsContent>
          <TabsContent value="audit">
            <AuditTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
