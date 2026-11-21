"use client";

// The slicer service's address, saved in Admin with the SLICER_URL environment variable as the
// fallback, and a Test button: the same pattern as the planner address in the Models tab.
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { messageOf } from "@/lib/queries";
import { httpUrl } from "@/lib/admin/schemas";
import { useAdminSettings, useConnectionTest, useSaveSettings, type AdminSettings } from "@/lib/admin/client";
import { ConfirmButton, describe, FormField, LoadError, LoadingBlocks, Panel, SaveError, SavedNote, TestOutcome, useFlag } from "./shared";

export function SlicerAddress() {
  const settings = useAdminSettings();
  if (settings.isPending) return <LoadingBlocks rows={1} label="Reading the slicer address" />;
  if (settings.isError) return <LoadError message={messageOf(settings.error)} onRetry={() => void settings.refetch()} />;
  return <SlicerSection settings={settings.data} />;
}

function SlicerSection({ settings }: { settings: AdminSettings }) {
  const [url, setUrl] = useState(settings.slicerUrl ?? "");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [justSaved, markSaved] = useFlag();
  const save = useSaveSettings();
  const test = useConnectionTest();
  const eff = settings.slicerEffective ?? { url: null, source: null };

  const parsed = () => {
    const r = httpUrl.safeParse(url);
    if (!r.success) {
      setError(`Address ${r.error.issues[0].message}.`);
      return null;
    }
    setError("");
    return r.data;
  };
  const run = async (slicerUrl: string | null) => {
    setSaveError("");
    try {
      await save.mutateAsync({ slicerUrl });
      if (slicerUrl === null) setUrl("");
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setSaveError(m);
      toast.error(m);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = parsed();
    if (v) void run(v);
  };

  return (
    <Panel title="Slicer address" description="The OrcaSlicer service that slices print jobs into files a printer can run.">
      <form onSubmit={submit} noValidate className="space-y-4" aria-busy={save.isPending || undefined} aria-label="Slicer address">
        <p className="text-sm text-secondary">
          {eff.url
            ? `In use: ${eff.url}, ${eff.source === "admin" ? "saved here" : "from the SLICER_URL environment variable (a fallback)"}.`
            : "No address is saved here and SLICER_URL is not set, so print jobs can be queued but not sliced."}
        </p>
        <FormField id="slicer-url" label="Address" error={error} hint="For example http://slicer:8000 inside Docker Compose.">
          <Input id="slicer-url" value={url} spellCheck={false} onChange={(e) => setUrl(e.target.value)} {...describe("slicer-url", { hint: true, error })} />
        </FormField>
        <SaveError message={saveError} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={test.isPending}
            onClick={() => {
              if (!url.trim()) return test.mutate({ kind: "slicer" });
              const v = parsed();
              if (v) test.mutate({ kind: "slicer", url: v });
            }}
          >
            Test
          </Button>
          {settings.slicerUrl ? (
            <ConfirmButton label="Clear" title="Clear the saved slicer address?" body="The SLICER_URL environment variable applies again, if it is set." confirmLabel="Clear" onConfirm={() => void run(null)} />
          ) : null}
          <SavedNote show={justSaved} />
        </div>
        <TestOutcome result={test.data} error={test.isError ? messageOf(test.error) : ""} pending={test.isPending} />
      </form>
    </Panel>
  );
}
