"use client";

import { NET_COLOR } from "@/lib/domain";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { statusTone } from "@/lib/statusTones";
import type { PartConn, PartLite } from "./derive";

export function ConnectionsTable({ blocks, parts }: { blocks: PartConn[]; parts: Map<string, PartLite> }) {
  return (
    <div className="space-y-4">
      {blocks.map((b) => {
        const p = parts.get(b.ref);
        return (
          <div key={b.ref} className="overflow-hidden rounded-xl border border-hairline bg-surface print:break-inside-avoid">
            <div className="flex flex-wrap items-baseline gap-2 border-b border-hairline px-4 py-2.5">
              <span className="font-mono text-sm text-primary">{b.ref}</span>
              <span className="text-sm text-secondary">{p ? p.title : "not in the bill of materials"}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Pin</TableHead>
                  <TableHead>Connects to</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {b.rows.map((r, i) => (
                  <TableRow key={`${r.step}-${i}`}>
                    <TableCell className="font-mono text-primary">
                      {r.pin || "none set"}
                      {r.joint > 1 && (
                        <span className="ml-2 rounded-full border border-dutchOrange/40 bg-dutchOrange/10 px-2 py-0.5 font-sans text-[11px] text-link" title="More than one wire meets at this pin">
                          shared joint, {r.joint} wires
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{r.to}</TableCell>
                    <TableCell className="font-mono">{r.net || "none"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="bs-dot inline-block h-2 w-2 rounded-full" style={{ backgroundColor: NET_COLOR[r.netClass] }} aria-hidden />
                        {r.netClass}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
