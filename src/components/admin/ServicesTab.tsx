"use client";

// Admin, Other services: the planner and slicer addresses (the same forms as AI models and Printers), the database
// test, and every environment variable the app reads with whether it is set. Only the database connection is
// required; Docker Compose supplies it. Everything else is entered in Admin, and an environment variable only
// fills in where Admin has nothing saved.
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Panel } from "@/components/ui/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadError, LoadingBlocks } from "@/components/ui/states";
import { messageOf } from "@/lib/queries";
import { useAdminSettings, useConnectionTest, useEnvironment, type EnvLine } from "@/lib/admin/client";
import { PlannerSection } from "./ModelsTab";
import { SlicerAddress } from "./SlicerSection";
import { TestOutcome } from "./shared";

const KIND: Record<EnvLine["kind"], string> = { required: "Required", override: "Optional override", deployment: "Deployment" };

function Database() {
  const test = useConnectionTest();
  return (
    <Panel title="Database" description="PostgreSQL holds every concept, file, setting and key of this install.">
      <div className="space-y-3">
        <Button type="button" variant="outline" size="sm" disabled={test.isPending} onClick={() => test.mutate({ kind: "database" })}>
          Test the database
        </Button>
        <TestOutcome result={test.data} error={test.isError ? messageOf(test.error) : ""} pending={test.isPending} />
      </div>
    </Panel>
  );
}

function Environment() {
  const env = useEnvironment();
  if (env.isPending) return <LoadingBlocks rows={2} label="Reading the environment" />;
  if (env.isError) return <LoadError what="The environment" message={messageOf(env.error)} onRetry={() => void env.refetch()} />;
  return (
    <Panel
      title="Environment"
      description="What the server was started with. Only the database connection is required, and Docker Compose supplies it. A key or address saved in Admin always wins over the variable of the same purpose; secret values are never shown."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variable</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>What it does</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {env.data.map((v) => (
            <TableRow key={v.name}>
              <TableCell className="font-mono text-xs">{v.name}</TableCell>
              <TableCell>
                <StatusBadge tone={v.set ? "success" : v.kind === "required" ? "danger" : "neutral"}>{v.set ? "Set" : "Not set"}</StatusBadge>
                {v.value ? <span className="ml-2 font-mono text-xs text-secondary">{v.value}</span> : null}
              </TableCell>
              <TableCell className="text-xs text-secondary">{KIND[v.kind]}</TableCell>
              <TableCell className="text-xs text-secondary">{v.does}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

export function ServicesTab() {
  const settings = useAdminSettings();
  return (
    <div className="space-y-4">
      {settings.isPending ? (
        <LoadingBlocks rows={1} label="Reading the planner address" />
      ) : settings.isError ? (
        <LoadError what="The planner address" message={messageOf(settings.error)} onRetry={() => void settings.refetch()} />
      ) : (
        <PlannerSection settings={settings.data} />
      )}
      <SlicerAddress />
      <Database />
      <Environment />
    </div>
  );
}
