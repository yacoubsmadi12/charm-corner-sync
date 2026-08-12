import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  PageHeader,
  StatCard,
  StatusPill,
} from "@/components/siem/ui-bits";
import { listRiskFn, recomputeRiskFn } from "@/lib/siem/analytics.functions";

export const Route = createFileRoute("/console/risk")({
  head: () => ({
    meta: [
      { title: "Risk Scoring — DirAmn SIEM" },
      {
        name: "description",
        content:
          "Prioritise response with entity risk scores for users, assets and IP addresses, calculated from alert severity, unresolved detections and event volume.",
      },
      { property: "og:title", content: "Risk Scoring — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Entity risk scores for users, assets and IPs across your environment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RiskPage,
});

type Factor = { factor: string; points: number };

function RiskPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRiskFn);
  const recomputeFn = useServerFn(recomputeRiskFn);

  const { data } = useQuery({ queryKey: ["risk"], queryFn: () => listFn() });

  const recompute = useMutation({
    mutationFn: () => recomputeFn(),
    onSuccess: (res) => {
      toast.success(`Scored ${res.entities} entities`);
      void qc.invalidateQueries({ queryKey: ["risk"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (data && !data.enabled) {
    return (
      <>
        <PageHeader title="Risk Scoring" description="Entity risk prioritisation." />
        <EmptyState
          title="Risk scoring is not included in your licence"
          hint={`Current plan: ${data.plan}. Upload a Professional or Enterprise AI licence to enable risk scoring.`}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Risk Scoring"
        description="Weighted risk per user, asset and IP from the last 30 days of alerts and events."
        action={
          <Button onClick={() => recompute.mutate()} disabled={recompute.isPending}>
            {recompute.isPending ? "Calculating…" : "Recalculate"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Critical risk" value={data?.summary.critical ?? 0} />
        <StatCard label="High risk" value={data?.summary.high ?? 0} />
        <StatCard label="Medium risk" value={data?.summary.medium ?? 0} />
        <StatCard
          label="Last calculated"
          value={
            data?.summary.computed_at
              ? new Date(data.summary.computed_at).toLocaleString()
              : "never"
          }
        />
      </div>

      <div className="panel mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Alerts</th>
              <th className="px-4 py-3">Events</th>
              <th className="px-4 py-3">Drivers</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{r.entity_value}</td>
                <td className="px-4 py-2">{r.entity_type}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-secondary">
                      <div
                        className="h-1.5 rounded-full bg-destructive"
                        style={{ width: `${Math.min(100, Number(r.score))}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs">{r.score}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <StatusPill status={r.level} />
                </td>
                <td className="px-4 py-2">{r.alert_count}</td>
                <td className="px-4 py-2">{r.event_count}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {((r.factors as Factor[] | null) ?? [])
                    .slice(0, 3)
                    .map((f) => `${f.factor} (+${f.points})`)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.items.length && (
          <div className="p-6">
            <EmptyState
              title="No risk scores yet"
              hint="Run a recalculation once alerts and events exist."
            />
          </div>
        )}
      </div>
    </>
  );
}
