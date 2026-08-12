import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState, Field, PageHeader, StatCard, StatusPill } from "@/components/siem/ui-bits";
import {
  addIncidentNoteFn, createIncidentFn, incidentDetailFn, listIncidentsFn, updateIncidentFn,
} from "@/lib/siem/siem.functions";
import { sevTone } from "./search";

export const Route = createFileRoute("/console/incidents")({
  head: () => ({
    meta: [
      { title: "Incidents — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Track security incidents from detection to closure with severity, ownership, investigation notes and a full timeline.",
      },
      { property: "og:title", content: "Incidents — DirAmn SIEM" },
      { property: "og:description", content: "Incident response workflow with notes and timeline." },
    ],
  }),
  component: IncidentsPage,
});

const STATUSES = ["new", "investigating", "contained", "resolved", "closed"] as const;
const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;

function IncidentsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listIncidentsFn);
  const detailFn = useServerFn(incidentDetailFn);
  const createFn = useServerFn(createIncidentFn);
  const updateFn = useServerFn(updateIncidentFn);
  const noteFn = useServerFn(addIncidentNoteFn);

  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", severity: "high" as (typeof SEVERITIES)[number] });

  const { data: incidents } = useQuery({ queryKey: ["incidents"], queryFn: () => listFn({}) });
  const { data: detail } = useQuery({
    queryKey: ["incident", selected],
    enabled: !!selected,
    queryFn: () => detailFn({ data: { id: selected! } }),
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { ...draft, alertId: null } }),
    onSuccess: (i) => {
      toast.success(`Incident ${i.reference} created`);
      setOpen(false); setDraft({ title: "", description: "", severity: "high" });
      void qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["incidents"] });
    void qc.invalidateQueries({ queryKey: ["incident", selected] });
  };

  const open_ = (incidents ?? []).filter((i) => !["closed", "resolved"].includes(i.status)).length;

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Investigation workspace for escalated detections."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>New incident</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Create incident</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Field label="Title"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
                <Field label="Description"><Textarea rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
                <Field label="Severity">
                  <Select value={draft.severity} onValueChange={(v) => setDraft({ ...draft, severity: v as (typeof SEVERITIES)[number] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Button className="w-full" disabled={create.isPending || !draft.title} onClick={() => create.mutate()}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={incidents?.length ?? 0} />
        <StatCard label="Open" value={open_} />
        <StatCard label="Critical" value={(incidents ?? []).filter((i) => i.severity === "critical").length} />
        <StatCard label="Closed" value={(incidents ?? []).filter((i) => i.status === "closed").length} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          {(incidents ?? []).length === 0 && <EmptyState title="No incidents" hint="Escalate an alert to open one." />}
          {(incidents ?? []).map((i) => (
            <button
              key={i.id}
              onClick={() => setSelected(i.id)}
              className={`panel w-full p-4 text-left transition-colors ${selected === i.id ? "border-primary/60" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-primary">{i.reference}</span>
                <StatusPill status={i.severity} tone={sevTone(i.severity)} />
                <StatusPill status={i.status} />
              </div>
              <p className="mt-1 text-sm">{i.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          {!detail ? (
            <EmptyState title="Select an incident" hint="Incident notes, linked alerts and timeline appear here." />
          ) : (
            <div className="panel space-y-5 p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-primary">{detail.incident.reference}</span>
                  <StatusPill status={detail.incident.severity} tone={sevTone(detail.incident.severity)} />
                </div>
                <h2 className="mt-1 text-lg font-semibold">{detail.incident.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{detail.incident.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Status">
                  <Select
                    value={detail.incident.status}
                    onValueChange={async (v) => { await updateFn({ data: { id: detail.incident.id, status: v } }); refresh(); }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Severity">
                  <Select
                    value={detail.incident.severity}
                    onValueChange={async (v) => { await updateFn({ data: { id: detail.incident.id, severity: v } }); refresh(); }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <section>
                <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Linked alerts</h3>
                {detail.alerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No alerts linked.</p>
                ) : detail.alerts.map((a) => (
                  <div key={a.id} className="border-b border-border/40 py-1 text-xs">
                    <StatusPill status={a.severity} tone={sevTone(a.severity)} /> {a.title}
                  </div>
                ))}
              </section>

              <section>
                <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Investigation notes</h3>
                <div className="space-y-2">
                  {detail.notes.map((n) => (
                    <div key={n.id} className="rounded-md border border-border/60 p-3 text-sm">
                      <p>{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {n.author_name} · {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Textarea rows={2} value={note} placeholder="Add a note…" onChange={(e) => setNote(e.target.value)} />
                  <Button
                    disabled={!note}
                    onClick={async () => {
                      await noteFn({ data: { id: detail.incident.id, body: note } });
                      setNote(""); refresh();
                    }}
                  >
                    Add
                  </Button>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Timeline</h3>
                <ol className="space-y-1">
                  {detail.timeline.map((t) => (
                    <li key={t.id} className="font-mono text-[11px] text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()} — {t.action} ({t.actor_name})
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Related events</h3>
                <div className="max-h-56 overflow-auto rounded-md border border-border bg-muted/20 p-3">
                  {detail.events.map((e) => (
                    <div key={e.id} className="border-b border-border/40 py-1 font-mono text-[11px]">
                      {new Date(e.timestamp).toLocaleString()} · {e.raw_message}
                    </div>
                  ))}
                  {detail.events.length === 0 && <p className="text-xs text-muted-foreground">No related events.</p>}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
