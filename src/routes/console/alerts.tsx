import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader, StatCard, StatusPill } from "@/components/siem/ui-bits";
import {
  alertEventsFn, createIncidentFn, listAlertsFn, updateAlertFn,
} from "@/lib/siem/siem.functions";
import { sevTone } from "./search";

export const Route = createFileRoute("/console/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Triage correlation alerts, inspect the events behind each detection, change status and escalate to incidents.",
      },
      { property: "og:title", content: "Alerts — DirAmn SIEM" },
      { property: "og:description", content: "Triage detections and escalate to incident response." },
    ],
  }),
  component: AlertsPage,
});

const STATUSES = ["all", "new", "acknowledged", "in_progress", "resolved", "false_positive"] as const;

function AlertsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAlertsFn);
  const updateFn = useServerFn(updateAlertFn);
  const eventsFn = useServerFn(alertEventsFn);
  const incidentFn = useServerFn(createIncidentFn);
  const [status, setStatus] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: alerts } = useQuery({
    queryKey: ["alerts", status],
    queryFn: () => listFn({ data: { status } }),
    refetchInterval: 20_000,
  });

  const { data: events } = useQuery({
    queryKey: ["alert-events", openId],
    enabled: !!openId,
    queryFn: () => eventsFn({ data: { alertId: openId! } }),
  });

  const setStatusFor = useMutation({
    mutationFn: (v: { id: string; status: string }) => updateFn({ data: v }),
    onSuccess: () => { toast.success("Alert updated"); void qc.invalidateQueries({ queryKey: ["alerts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const escalate = useMutation({
    mutationFn: (a: { id: string; title: string; severity: string; description: string }) =>
      incidentFn({
        data: {
          title: a.title,
          description: a.description,
          severity: a.severity as "critical" | "high" | "medium" | "low" | "info",
          alertId: a.id,
        },
      }),
    onSuccess: (i) => {
      toast.success(`Incident ${i.reference} created`);
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      void qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = (sev: string) => (alerts ?? []).filter((a) => a.severity === sev).length;

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Detections raised by the correlation engine, newest first."
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total shown" value={alerts?.length ?? 0} />
        <StatCard label="Critical" value={counts("critical")} />
        <StatCard label="High" value={counts("high")} />
        <StatCard label="Medium" value={counts("medium")} />
      </div>

      <div className="mt-6 grid gap-3">
        {(alerts ?? []).length === 0 && (
          <EmptyState title="No alerts" hint="Generate test data or ingest logs to exercise the rules." />
        )}
        {(alerts ?? []).map((a) => (
          <div key={a.id} className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-[240px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={a.severity} tone={sevTone(a.severity)} />
                  <span className="font-medium">{a.title}</span>
                  <StatusPill status={a.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {a.event_count} events · {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={a.status} onValueChange={(v) => setStatusFor.mutate({ id: a.id, status: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.filter((s) => s !== "all").map((s) => (
                      <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                  {openId === a.id ? "Hide events" : "View events"}
                </Button>
                {!a.incident_id && (
                  <Button
                    size="sm"
                    onClick={() => escalate.mutate({
                      id: a.id, title: a.title, severity: a.severity, description: a.description ?? "",
                    })}
                  >
                    Escalate
                  </Button>
                )}
              </div>
            </div>
            {openId === a.id && (
              <div className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-muted/20 p-3">
                {(events ?? []).map((e) => (
                  <div key={e.id} className="border-b border-border/40 py-1 font-mono text-[11px]">
                    <span className="text-primary">{new Date(e.timestamp).toLocaleString()}</span>{" "}
                    <span className="uppercase">{e.severity}</span> {e.raw_message}
                  </div>
                ))}
                {(events ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No linked events retained.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
