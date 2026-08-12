import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Field, PageHeader, StatusPill } from "@/components/siem/ui-bits";
import {
  deleteRuleFn, evaluateRulesNowFn, listRulesFn, saveRuleFn, setRuleEnabledFn,
} from "@/lib/siem/siem.functions";
import { sevTone } from "./search";

export const Route = createFileRoute("/console/rules")({
  head: () => ({
    meta: [
      { title: "Correlation Rules — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Manage threshold, sequence, pattern and anomaly detection rules including the ten built-in DirAmn threat rules.",
      },
      { property: "og:title", content: "Correlation Rules — DirAmn SIEM" },
      { property: "og:description", content: "Tune detection rules and thresholds for your tenant." },
    ],
  }),
  component: RulesPage,
});

const RULE_TYPES = ["threshold", "sequence", "pattern", "anomaly", "correlation"] as const;
const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
const GROUPS = ["source_ip", "user", "host", "event_type"] as const;

type Draft = {
  id?: string | null;
  name: string;
  description: string;
  ruleType: (typeof RULE_TYPES)[number];
  severity: (typeof SEVERITIES)[number];
  threshold: number;
  windowMinutes: number;
  groupBy: string;
  enabled: boolean;
  conditionsText: string;
};

const BLANK: Draft = {
  name: "", description: "", ruleType: "threshold", severity: "high",
  threshold: 5, windowMinutes: 10, groupBy: "source_ip", enabled: true,
  conditionsText: '{\n  "event_types": ["failed_login"]\n}',
};

function RulesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRulesFn);
  const saveFn = useServerFn(saveRuleFn);
  const toggleFn = useServerFn(setRuleEnabledFn);
  const removeFn = useServerFn(deleteRuleFn);
  const evaluateFn = useServerFn(evaluateRulesNowFn);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [open, setOpen] = useState(false);

  const { data: rules } = useQuery({ queryKey: ["rules"], queryFn: () => listFn({}) });

  const save = useMutation({
    mutationFn: async () => {
      let conditions: Record<string, unknown>;
      try { conditions = JSON.parse(draft.conditionsText) as Record<string, unknown>; }
      catch { throw new Error("Conditions must be valid JSON"); }
      return saveFn({
        data: {
          id: draft.id ?? null, name: draft.name, description: draft.description,
          ruleType: draft.ruleType, severity: draft.severity, threshold: draft.threshold,
          windowMinutes: draft.windowMinutes, groupBy: draft.groupBy, enabled: draft.enabled,
          conditions,
        },
      });
    },
    onSuccess: () => {
      toast.success("Rule saved");
      setOpen(false); setDraft(BLANK);
      void qc.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const evaluate = useMutation({
    mutationFn: () => evaluateFn({}),
    onSuccess: (r) => toast.success(`Evaluation complete — ${r.created} new alerts`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Correlation Rules"
        description="Detection logic evaluated on every ingestion batch. Ten built-in threat rules ship enabled by default."
        actions={
          <>
            <Button variant="outline" onClick={() => evaluate.mutate()} disabled={evaluate.isPending}>
              Run evaluation now
            </Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDraft(BLANK); }}>
              <DialogTrigger asChild><Button>New rule</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>{draft.id ? "Edit rule" : "Create rule"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Field label="Name">
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </Field>
                  <Field label="Description">
                    <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Rule type">
                      <Select value={draft.ruleType} onValueChange={(v) => setDraft({ ...draft, ruleType: v as Draft["ruleType"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{RULE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Severity">
                      <Select value={draft.severity} onValueChange={(v) => setDraft({ ...draft, severity: v as Draft["severity"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Threshold">
                      <Input type="number" min={1} value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })} />
                    </Field>
                    <Field label="Window (minutes)">
                      <Input type="number" min={1} value={draft.windowMinutes} onChange={(e) => setDraft({ ...draft, windowMinutes: Number(e.target.value) })} />
                    </Field>
                    <Field label="Group by">
                      <Select value={draft.groupBy} onValueChange={(v) => setDraft({ ...draft, groupBy: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Enabled">
                      <div className="pt-2"><Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} /></div>
                    </Field>
                  </div>
                  <Field label="Conditions (JSON)" hint="Keys: event_types, severities, categories, message_contains, distinct_field, distinct_count, sequence">
                    <Textarea rows={6} className="font-mono text-xs" value={draft.conditionsText}
                      onChange={(e) => setDraft({ ...draft, conditionsText: e.target.value })} />
                  </Field>
                  <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>Save rule</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-3">
        {(rules ?? []).map((r) => (
          <div key={r.id} className="panel flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="min-w-[240px] flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.name}</span>
                <StatusPill status={r.severity} tone={sevTone(r.severity)} />
                {r.is_builtin && <span className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">built-in</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {r.rule_type} · {r.threshold} in {r.window_minutes}m by {r.group_by}
                {r.last_triggered_at ? ` · last fired ${new Date(r.last_triggered_at).toLocaleString()}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={r.enabled}
                onCheckedChange={async (v) => {
                  await toggleFn({ data: { id: r.id, enabled: v } });
                  void qc.invalidateQueries({ queryKey: ["rules"] });
                }}
              />
              <Button
                size="sm" variant="outline"
                onClick={() => {
                  setDraft({
                    id: r.id, name: r.name, description: r.description ?? "",
                    ruleType: r.rule_type as Draft["ruleType"], severity: r.severity as Draft["severity"],
                    threshold: r.threshold, windowMinutes: r.window_minutes, groupBy: r.group_by,
                    enabled: r.enabled, conditionsText: JSON.stringify(r.conditions ?? {}, null, 2),
                  });
                  setOpen(true);
                }}
              >
                Edit
              </Button>
              {!r.is_builtin && (
                <Button
                  size="sm" variant="ghost"
                  onClick={async () => {
                    await removeFn({ data: { id: r.id } });
                    void qc.invalidateQueries({ queryKey: ["rules"] });
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
