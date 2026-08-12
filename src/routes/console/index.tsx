import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, StatusPill } from "@/components/siem/ui-bits";
import { useSiemContext } from "@/lib/siem/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/console/")({
  head: () => ({
    meta: [
      { title: "Security Dashboard — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Tenant overview of users, connected log sources, license entitlements and recent security activity in DirAmn SIEM.",
      },
      { property: "og:title", content: "Security Dashboard — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Tenant overview of users, sources and license entitlements.",
      },
    ],
  }),
  component: ConsoleDashboard,
});

function ConsoleDashboard() {
  const { data: ctx } = useSiemContext();

  const { data: stats } = useQuery({
    queryKey: ["console-stats", ctx?.actor.orgId],
    enabled: !!ctx?.actor.orgId,
    queryFn: async () => {
      const [users, sources, audit] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("org_id", ctx!.actor.orgId!),
        supabase
          .from("sources")
          .select("id", { count: "exact", head: true })
          .eq("org_id", ctx!.actor.orgId!),
        supabase
          .from("audit_logs")
          .select("*")
          .eq("org_id", ctx!.actor.orgId!)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      return {
        users: users.count ?? 0,
        sources: sources.count ?? 0,
        recent: audit.data ?? [],
      };
    },
  });

  const license = ctx?.license;

  return (
    <>
      <PageHeader
        title="Security Dashboard"
        description={`Tenant workspace for ${ctx?.org?.name ?? "your organization"}.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={stats?.users ?? "—"} />
        <StatCard label="Log sources" value={stats?.sources ?? "—"} />
        <StatCard
          label="EPS entitlement"
          value={license?.eps_limit ?? ctx?.org?.eps_limit ?? "—"}
        />
        <StatCard
          label="Retention"
          value={`${license?.retention_days ?? ctx?.org?.retention_days ?? "—"}d`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm uppercase tracking-widest text-muted-foreground">
            Recent activity
          </h2>
          <ul className="space-y-2">
            {(stats?.recent ?? []).map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-4 py-3 text-sm"
              >
                <span className="font-mono text-xs text-primary">{l.action}</span>
                <span className="text-xs text-muted-foreground">
                  {l.actor_name ?? "system"} ·{" "}
                  {new Date(l.created_at).toLocaleString()}
                </span>
              </li>
            ))}
            {!stats?.recent.length && (
              <li className="text-sm text-muted-foreground">
                No activity recorded yet.
              </li>
            )}
          </ul>
        </div>

        <div className="panel p-5">
          <h2 className="mb-4 text-sm uppercase tracking-widest text-muted-foreground">
            License
          </h2>
          {license ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusPill status={license.status} />
              </div>
              <Row label="Plan" value={license.plan} />
              <Row label="Max users" value={String(license.max_users)} />
              <Row label="Max sources" value={String(license.max_sources)} />
              <Row
                label="Expires"
                value={new Date(license.expires_at).toLocaleDateString()}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active license.{" "}
              <Link to="/console/license" className="text-primary underline">
                Upload a license file
              </Link>{" "}
              provided by your vendor.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
