"use client";

// The platform admin area: one page, a sub-navigation down the left (a grid of the same buttons above the content on
// a narrow screen), one section at a time. The section is kept in the address (?tab=) so a link can open one; the
// keys links across the app already use (setup, credentials, models, printers, audit, access) keep working.
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_TAB_LABEL, ADMIN_TABS, isAdminTab, type AdminTab } from "@/lib/admin/client";
import { SetupTab } from "./SetupTab";
import { CredentialsTab } from "./CredentialsTab";
import { ModelsTab } from "./ModelsTab";
import { PrintersTab } from "./PrintersTab";
import { AuditTab } from "./AuditTab";
import { AccessRequestsTab } from "./AccessRequestsTab";
import { PaymentsTab } from "./PaymentsTab";
import { PricingTab } from "./PricingTab";
import { EmailTab } from "./EmailTab";
import { ChannelsTab } from "./ChannelsTab";
import { VoiceTab } from "./VoiceTab";
import { ServicesTab } from "./ServicesTab";

export function AdminView() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab");
  const tab: AdminTab = isAdminTab(raw) ? raw : "setup";
  const go = (t: AdminTab) => router.replace(t === "setup" ? "/admin" : `/admin?tab=${t}`, { scroll: false });

  return (
    <>
      <PageHeader
        eyebrow="Workbench"
        title="Admin"
        nextStep={false}
        blurb="Settings for the whole application: payments, prices, email, sales channels, AI models, voice, printers and services. Every one is optional; whatever is not set up says so where it is used. Everything is stored in this install's database."
      />
      <div className="px-4 py-6 sm:px-8">
        <Tabs value={tab} onValueChange={(v) => isAdminTab(v) && go(v)} orientation="vertical" className="flex-col gap-5 lg:flex-row lg:items-start">
          <TabsList aria-label="Admin sections" className="grid h-auto w-full grid-cols-2 gap-1 bg-subtle sm:grid-cols-3 lg:sticky lg:top-4 lg:flex lg:w-52 lg:shrink-0 lg:items-stretch">
            {ADMIN_TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="justify-start px-3 py-1.5 data-[state=active]:bg-surface data-[state=active]:text-primary">
                {ADMIN_TAB_LABEL[t]}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="min-w-0 flex-1">
            <TabsContent value="setup" className="max-w-5xl">
              <SetupTab onOpenTab={go} />
            </TabsContent>
            <TabsContent value="payments" className="max-w-4xl">
              <PaymentsTab />
            </TabsContent>
            <TabsContent value="pricing" className="max-w-6xl">
              <PricingTab />
            </TabsContent>
            <TabsContent value="email" className="max-w-4xl">
              <EmailTab />
            </TabsContent>
            <TabsContent value="channels" className="max-w-5xl">
              <ChannelsTab />
            </TabsContent>
            <TabsContent value="models" className="max-w-4xl">
              <ModelsTab />
            </TabsContent>
            <TabsContent value="voice" className="max-w-4xl">
              <VoiceTab />
            </TabsContent>
            <TabsContent value="printers" className="max-w-5xl">
              <PrintersTab />
            </TabsContent>
            <TabsContent value="services" className="max-w-5xl">
              <ServicesTab />
            </TabsContent>
            <TabsContent value="credentials">
              <CredentialsTab />
            </TabsContent>
            <TabsContent value="audit">
              <AuditTab />
            </TabsContent>
            <TabsContent value="access" className="max-w-6xl">
              <AccessRequestsTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </>
  );
}
