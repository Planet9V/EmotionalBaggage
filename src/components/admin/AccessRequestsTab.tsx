"use client";

// Access requests: what visitors asked for on the public welcome page, newest first, with a status the owner
// sets (new, contacted, declined) and a CSV copy. Nothing here sends anything; the owner replies by email himself.
import Link from "next/link";
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Panel } from "@/components/ui/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { ApiError } from "@/lib/http";
import { messageOf } from "@/lib/queries";
import { fmtDateTime } from "@/lib/format";
import { downloadAccessRequests, useAccessRequests, useSetAccessStatus } from "@/lib/accessRequests/client";
import { ACCESS_LEVEL_LABEL, ACCESS_STATUSES, ACCESS_STATUS_LABEL, type AccessStatus } from "@/lib/accessRequests/shared";

export function AccessRequestsTab() {
  const list = useAccessRequests();
  const setStatus = useSetAccessStatus();
  const [rowError, setRowError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const refused = list.error instanceof ApiError && list.error.status === 403;

  const change = async (id: number, status: AccessStatus) => {
    setRowError("");
    try {
      await setStatus.mutateAsync({ id, status });
      toast.success(`Request ${id} marked ${ACCESS_STATUS_LABEL[status].toLowerCase()}.`);
    } catch (e) {
      setRowError(messageOf(e));
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      toast.success(`Downloaded ${await downloadAccessRequests()}.`);
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setDownloading(false);
    }
  };

  const rows = list.data ?? [];
  return (
    <Panel
      title="Access requests"
      description={
        <>
          Requests sent from the public <Link href="/welcome" className="text-link underline underline-offset-2">welcome page</Link> for a workspace of one&apos;s own, newest first. No email is sent by the app: reply from your own mail, then set the status here.
        </>
      }
      actions={
        rows.length ? (
          <Button size="sm" variant="outline" onClick={() => void download()} disabled={downloading}>
            <Download className="h-3.5 w-3.5" aria-hidden /> {downloading ? "Downloading…" : "Download CSV"}
          </Button>
        ) : null
      }
    >
      {list.isPending ? (
        <LoadingBlocks rows={2} label="Reading access requests" />
      ) : refused ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning" role="status">
          <span className="max-w-2xl">{messageOf(list.error)}</span>
          <Button asChild variant="outline" size="sm">
            <Link href="/account">Open Account</Link>
          </Button>
        </div>
      ) : list.isError ? (
        <LoadError message={messageOf(list.error)} onRetry={() => void list.refetch()} what="Access requests" />
      ) : rows.length === 0 ? (
        <EmptyState>No requests yet. When someone sends the form on the welcome page, it is listed here.</EmptyState>
      ) : (
        <>
          {rowError ? (
            <div className="mb-3">
              <ErrorLine>{rowError}</ErrorLine>
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-36">Received</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead className="w-28">Level</TableHead>
                  <TableHead className="min-w-64">Wants to build</TableHead>
                  <TableHead className="w-44">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="align-top" data-testid={`access-${r.id}`}>
                    <TableCell className="align-top font-mono text-xs text-muted">{fmtDateTime(r.createdAt)}</TableCell>
                    <TableCell className="align-top text-sm">
                      <span className="block font-medium text-primary wrap-anywhere">{r.name}</span>
                      <a href={`mailto:${r.email}`} className="block text-xs text-link underline-offset-2 hover:underline wrap-anywhere">
                        {r.email}
                      </a>
                      {r.company ? <span className="block text-xs text-secondary wrap-anywhere">{r.company}</span> : null}
                    </TableCell>
                    <TableCell className="align-top text-sm text-secondary" data-testid={`access-level-${r.id}`}>
                      {r.level ? ACCESS_LEVEL_LABEL[r.level] : <span className="text-muted">Not chosen</span>}
                    </TableCell>
                    <TableCell className="align-top whitespace-pre-wrap text-sm text-secondary wrap-anywhere">{r.building}</TableCell>
                    <TableCell className="align-top">
                      <label htmlFor={`access-status-${r.id}`} className="sr-only">
                        Status of request {r.id} from {r.name}
                      </label>
                      <NativeSelect id={`access-status-${r.id}`} value={r.status} onChange={(e) => void change(r.id, e.target.value as AccessStatus)}>
                        {ACCESS_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ACCESS_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </NativeSelect>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted" role="status">
            {rows.length} request{rows.length === 1 ? "" : "s"}.
          </p>
        </>
      )}
    </Panel>
  );
}
