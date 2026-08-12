import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/siem/ui-bits";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/vendor/audit")({
  head: () => ({
    meta: [
      { title: "Global Audit Logs — DirAmn SIEM Vendor Console" },
      {
        name: "description",
        content:
          "Immutable, estate-wide audit trail of authentication, licensing and administrative actions across every DirAmn tenant.",
      },
      { property: "og:title", content: "Global Audit Logs — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Estate-wide immutable audit trail for DirAmn SIEM.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const [q, setQ] = useState("");
  const { data: logs } = useQuery({
    queryKey: ["global-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (logs ?? []).filter((l) =>
    `${l.action} ${l.actor_name ?? ""} ${l.target ?? ""} ${
      l.details ? JSON.stringify(l.details) : ""
    }`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Global Audit Logs"
        description="Every privileged action is recorded and cannot be edited or deleted."
        actions={
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter events…"
            className="w-64"
          />
        }
      />
      {!filtered.length ? (
        <EmptyState title="No audit events" hint="Activity will appear here." />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Actor</th>
                <th className="p-4">Action</th>
                <th className="p-4">Target</th>
                <th className="p-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4 font-mono text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="p-4 font-mono text-xs">
                    {l.actor_name ?? "system"}
                  </td>
                  <td className="p-4 font-mono text-xs text-primary">{l.action}</td>
                  <td className="p-4 font-mono text-xs">
                    {l.target ?? "—"}
                  </td>
                  <td className="max-w-md truncate p-4 font-mono text-[11px] text-muted-foreground">
                    {l.details ? JSON.stringify(l.details) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
