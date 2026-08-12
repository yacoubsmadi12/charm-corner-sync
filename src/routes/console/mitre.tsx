import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmptyState, PageHeader, StatCard } from "@/components/siem/ui-bits";
import { mitreCoverageFn } from "@/lib/siem/analytics.functions";

export const Route = createFileRoute("/console/mitre")({
  head: () => ({
    meta: [
      { title: "MITRE ATT&CK Coverage — DirAmn SIEM" },
      {
        name: "description",
        content:
          "See which MITRE ATT&CK tactics and techniques your detections cover, and which techniques triggered alerts in your environment.",
      },
      { property: "og:title", content: "MITRE ATT&CK Coverage — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Detection coverage mapped to MITRE ATT&CK tactics and techniques.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MitrePage,
});

function MitrePage() {
  const coverageFn = useServerFn(mitreCoverageFn);
  const { data, error } = useQuery({
    queryKey: ["mitre-coverage"],
    queryFn: () => coverageFn(),
    retry: false,
  });

  if (error) {
    return (
      <>
        <PageHeader title="MITRE ATT&CK" description="Detection coverage matrix." />
        <EmptyState title="Not available on your licence" hint={error.message} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="MITRE ATT&CK"
        description="Techniques observed in your environment, mapped from correlation alerts and AI investigations."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Techniques tracked" value={data?.total ?? "—"} />
        <StatCard label="Techniques observed" value={data?.covered ?? "—"} />
        <StatCard
          label="Coverage"
          value={
            data ? `${Math.round((data.covered / Math.max(1, data.total)) * 100)}%` : "—"
          }
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data?.tactics ?? []).map((t) => (
          <div key={t.tactic} className="panel space-y-2 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{t.tactic}</h2>
              <span className="font-mono text-[11px] text-muted-foreground">
                {t.tactic_id}
              </span>
            </div>
            <ul className="space-y-1">
              {t.techniques.map((tech) => (
                <li
                  key={tech.id}
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs ${
                    tech.alert_count
                      ? "bg-destructive/10 text-foreground"
                      : "bg-secondary/50 text-muted-foreground"
                  }`}
                  title={tech.description}
                >
                  <span className="truncate">
                    <span className="font-mono">{tech.id}</span> {tech.name}
                  </span>
                  <span className="font-mono">{tech.alert_count || ""}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
