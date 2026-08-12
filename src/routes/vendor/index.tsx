import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, StatCard } from "@/components/siem/ui-bits";
import { platformHealthFn } from "@/lib/siem/admin.functions";

export const Route = createFileRoute("/vendor/")({
  head: () => ({
    meta: [
      { title: "SaaS Dashboard — DirAmn SIEM Vendor Console" },
      {
        name: "description",
        content:
          "Vendor overview of tenants, licensed EPS, active licenses and platform activity across the DirAmn SIEM estate.",
      },
      { property: "og:title", content: "SaaS Dashboard — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Vendor overview of tenants, licensing and platform activity.",
      },
    ],
  }),
  component: VendorDashboard,
});

function VendorDashboard() {
  const fetchHealth = useServerFn(platformHealthFn);
  const { data } = useQuery({
    queryKey: ["platform-health"],
    queryFn: () => fetchHealth(),
  });

  return (
    <>
      <PageHeader
        title="SaaS Dashboard"
        description="Estate-wide view of the DirAmn platform. Vendor access only."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Organizations" value={data?.organizations ?? "—"} />
        <StatCard label="Platform users" value={data?.users ?? "—"} />
        <StatCard label="Log sources" value={data?.sources ?? "—"} />
        <StatCard
          label="Licensed EPS"
          value={data?.licensed_eps ?? "—"}
          hint="Sum of active licenses"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm uppercase tracking-widest text-muted-foreground">
            Active licenses by plan
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.plans ?? []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="plan"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--color-chart-1)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-4">
          <StatCard label="Active licenses" value={data?.licenses_active ?? "—"} />
          <StatCard
            label="Expiring in 30 days"
            value={data?.licenses_expiring ?? "—"}
          />
          <StatCard
            label="Recent auth events"
            value={data?.recent_logins ?? "—"}
            hint="Last 200 audit records"
          />
        </div>
      </div>
    </>
  );
}
