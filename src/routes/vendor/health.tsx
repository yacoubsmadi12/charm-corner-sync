import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, StatCard, StatusPill } from "@/components/siem/ui-bits";
import { platformHealthFn, listOrganizationsFn } from "@/lib/siem/admin.functions";

export const Route = createFileRoute("/vendor/health")({
  head: () => ({
    meta: [
      { title: "Platform Health — DirAmn SIEM Vendor Console" },
      {
        name: "description",
        content:
          "Service status, tenant licensing posture and capacity indicators for the DirAmn SIEM platform.",
      },
      { property: "og:title", content: "Platform Health — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Service status and capacity indicators for DirAmn SIEM.",
      },
    ],
  }),
  component: HealthPage,
});

const SERVICES = [
  { name: "API Gateway", detail: "TanStack server functions" },
  { name: "PostgreSQL", detail: "Primary tenant datastore" },
  { name: "Authentication", detail: "JWT session issuer" },
  { name: "License Service", detail: "HMAC-SHA256 signer" },
  { name: "Audit Pipeline", detail: "Immutable event log" },
];

function HealthPage() {
  const fetchHealth = useServerFn(platformHealthFn);
  const listOrgs = useServerFn(listOrganizationsFn);

  const { data: health, isSuccess } = useQuery({
    queryKey: ["platform-health"],
    queryFn: () => fetchHealth(),
  });
  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => listOrgs(),
  });

  return (
    <>
      <PageHeader
        title="Platform Health"
        description="Live status of core platform services and tenant capacity."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tenants online" value={health?.organizations ?? "—"} />
        <StatCard label="Total users" value={health?.users ?? "—"} />
        <StatCard label="Enabled sources" value={health?.sources ?? "—"} />
        <StatCard label="Licensed EPS" value={health?.licensed_eps ?? "—"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="mb-4 text-sm uppercase tracking-widest text-muted-foreground">
            Core services
          </h2>
          <ul className="space-y-3">
            {SERVICES.map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between rounded-md border border-border/70 bg-background/40 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.detail}</div>
                </div>
                <StatusPill status={isSuccess ? "active" : "pending"} />
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-5">
          <h2 className="mb-4 text-sm uppercase tracking-widest text-muted-foreground">
            Tenant capacity
          </h2>
          <ul className="space-y-3">
            {(orgs ?? []).map((o) => (
              <li key={o.id} className="rounded-md border border-border/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{o.name}</span>
                  <StatusPill status={o.license ? o.license.status : "none"} />
                </div>
                <div className="mt-2 flex gap-6 font-mono text-xs text-muted-foreground">
                  <span>{o.eps_limit} EPS</span>
                  <span>{o.user_count} users</span>
                  <span>{o.source_count} sources</span>
                  <span>{o.retention_days}d retention</span>
                </div>
              </li>
            ))}
            {!orgs?.length && (
              <li className="text-sm text-muted-foreground">No tenants yet.</li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
