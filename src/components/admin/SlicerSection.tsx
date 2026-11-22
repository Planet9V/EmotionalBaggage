"use client";

// The slicer service's address, saved in Admin with the SLICER_URL environment variable as the
// fallback, and a Test button: the same pattern as the planner address in the Models tab.
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { messageOf } from "@/lib/queries";
import { httpUrl } from "@/lib/admin/schemas";
import { useAdminSettings, useConnectionTest, useSaveSettings, type AdminSettings } from "@/lib/admin/client";
import { TestOutcome } from "./shared";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, describe } from "@/components/ui/field";
import { LoadError, LoadingBlocks, SaveError, SavedNote, useFlag } from "@/components/ui/states";
import { Panel } from "@/components/ui/panel";

export function SlicerAddress() {
  const settings = useAdminSettings();
  if (settings.isPending) return <LoadingBlocks rows={1} label="Reading the slicer address" />;
  if (settings.isError) return <LoadError what="The slicer address" message={messageOf(settings.error)} onRetry={() => void settings.refetch()} />;
  return <SlicerSection settings={settings.data} />;
}

const schema = z.object({ url: httpUrl });

function SlicerSection({ settings }: { settings: AdminSettings }) {
  const { register, handleSubmit, trigger, getValues, setValue, formState: { errors } } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { url: settings.slicerUrl ?? "" },
  });
  const error = errors.url?.message ? `Address ${errors.url.message}.` : "";
  const [saveError, setSaveError] = useState("");
  const [justSaved, markSaved] = useFlag();
  const save = useSaveSettings();
  const test = useConnectionTest();
  const eff = settings.slicerEffective ?? { url: null, source: null };

  const run = async (slicerUrl: string | null) => {
    setSaveError("");
    try {
      await save.mutateAsync({ slicerUrl });
      if (slicerUrl === null) setValue("url", "");
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setSaveError(m);
      toast.error(m);
    }
  };
  const submit = handleSubmit((v) => void run(v.url));
  const testAddress = async () => {
    if (!getValues("url").trim()) return test.mutate({ kind: "slicer" });
    if (await trigger("url")) test.mutate({ kind: "slicer", url: httpUrl.parse(getValues("url")) });
  };

  return (
    <Panel title="Slicer address" description="The OrcaSlicer service that slices print jobs into files a printer can run.">
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4" aria-busy={save.isPending || undefined} aria-label="Slicer address">
        <p className="text-sm text-secondary">
          {eff.url
            ? `In use: ${eff.url}, ${eff.source === "admin" ? "saved here" : "from the SLICER_URL environment variable (a fallback)"}.`
            : "No address is saved here and SLICER_URL is not set, so print jobs can be queued but not sliced."}
        </p>
        <Field id="slicer-url" label="Address" error={error} hint="For example http://slicer:8000 inside Docker Compose.">
          <Input id="slicer-url" spellCheck={false} {...describe("slicer-url", { hint: true, error })} {...register("url")} />
        </Field>
        <SaveError message={saveError} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={test.isPending}
            onClick={() => void testAddress()}
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
