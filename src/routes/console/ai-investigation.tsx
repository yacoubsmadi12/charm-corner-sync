import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  PageHeader,
  StatCard,
  StatusPill,
} from "@/components/siem/ui-bits";
import { listInvestigationsFn, runInvestigationFn } from "@/lib/siem/ai.functions";
import { listAlertsFn } from "@/lib/siem/siem.functions";

export const Route = createFileRoute("/console/ai-investigation")({
  head: () => ({
    meta: [
      { title: "AI Investigation — DirAmn SIEM" },
      {
        name: "description",
        content:
          "Let DirAmn's AI analyst triage an alert: attack narrative, false-positive likelihood, MITRE ATT&CK mapping and prioritised response actions.",
      },
      { property: "og:title", content: "AI Investigation — DirAmn SIEM" },
      {
        property: "og:description",
        content: "AI-assisted alert triage with MITRE mapping and response recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiInvestigationPage,
});

type Recommendation = { action?: string; priority?: string };
type MitreRef = { technique_id?: string; name?: string; rationale?: string };

function AiInvestigationPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listInvestigationsFn);
  const alertsFn = useServerFn(listAlertsFn);
  const runFn = useServerFn(runInvestigationFn);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["ai-investigations"],
    queryFn: () => listFn(),
  });
  const { data: alerts } = useQuery({
    queryKey: ["alerts", "ai"],
    queryFn: () => alertsFn({ data: { status: "all" } }),
  });

  const run = useMutation({
    mutationFn: (alertId: string) => runFn({ data: { alertId } }),
    onSuccess: (res) => {
      toast.success("Investigation complete");
      setOpenId(res.investigation.id);
      void qc.invalidateQueries({ queryKey: ["ai-investigations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (data && !data.enabled) {
    return (
      <>
        <PageHeader
          title="AI Investigation"
          description="Automated alert triage by an AI SOC analyst."
        />
        <EmptyState
          title="AI investigation is not included in your licence"
          hint={`Current plan: ${data.plan}. Upload an Enterprise AI licence to enable this module.`}
        />
      </>
    );
  }

  const open = (data?.items ?? []).find((i) => i.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="AI Investigation"
        description="Pick an alert and DirAmn's AI analyst will build the attack narrative, MITRE mapping and response plan."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Investigations" value={data?.items.length ?? 0} />
        <StatCard label="Alerts available" value={alerts?.length ?? 0} />
        <StatCard label="Plan" value={data?.plan ?? "—"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-3 p-5">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            Run a new investigation
          </h2>
          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {(alerts ?? []).slice(0, 40).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.severity} · {a.rule_name}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={run.isPending}
                  onClick={() => run.mutate(a.id)}
                >
                  {run.isPending && run.variables === a.id ? "Analysing…" : "Analyse"}
                </Button>
              </div>
            ))}
            {!alerts?.length && (
              <EmptyState title="No alerts to investigate yet" />
            )}
          </div>
        </div>

        <div className="panel space-y-3 p-5">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            History
          </h2>
          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {(data?.items ?? []).map((i) => (
              <button
                key={i.id}
                onClick={() => setOpenId(i.id)}
                className={`block w-full rounded-md border border-border px-3 py-2 text-left ${
                  openId === i.id ? "bg-secondary" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">
                    {i.alert?.title ?? "Alert removed"}
                  </span>
                  <StatusPill status={i.severity_assessment ?? "unknown"} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {i.summary}
                </p>
              </button>
            ))}
            {!data?.items.length && <EmptyState title="No investigations yet" />}
          </div>
        </div>
      </div>

      {open && (
        <div className="panel mt-6 space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {open.alert?.title ?? "Investigation"}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusPill status={open.severity_assessment ?? "unknown"} />
              <span>
                confidence {Math.round(Number(open.confidence ?? 0) * 100)}%
              </span>
              <span>{open.model}</span>
            </div>
          </div>

          <Section title="Summary">{open.summary}</Section>
          {open.attack_narrative && (
            <Section title="Attack narrative">{open.attack_narrative}</Section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                Recommended actions
              </h3>
              <ul className="space-y-2 text-sm">
                {(open.recommendations as Recommendation[] | null ?? []).map(
                  (r, idx) => (
                    <li
                      key={idx}
                      className="rounded-md border border-border px-3 py-2"
                    >
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">
                        {r.priority ?? "action"}
                      </span>
                      <p>{r.action}</p>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                MITRE ATT&amp;CK
              </h3>
              <ul className="space-y-2 text-sm">
                {(open.mitre as MitreRef[] | null ?? []).map((m, idx) => (
                  <li
                    key={idx}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <p className="font-mono text-xs">
                      {m.technique_id} — {m.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.rationale}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}
