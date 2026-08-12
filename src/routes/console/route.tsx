import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell, type NavItem } from "@/components/siem/AppShell";
import { useSiemContext } from "@/lib/siem/session";

export const Route = createFileRoute("/console")({
  component: ConsoleLayout,
});

const nav: NavItem[] = [
  { to: "/console", label: "Dashboard", icon: "◈" },
  { to: "/console/search", label: "Log Search", icon: "⌕" },
  { to: "/console/ingest", label: "Log Ingestion", icon: "⇩" },
  { to: "/console/rules", label: "Correlation Rules", icon: "⚙" },
  { to: "/console/alerts", label: "Alerts", icon: "⚠" },
  { to: "/console/incidents", label: "Incidents", icon: "⛨" },
  { to: "/console/users", label: "User Management", icon: "☖" },
  { to: "/console/sources", label: "Log Sources", icon: "⇉" },
  { to: "/console/ldap", label: "LDAP / AD", icon: "⌬" },
  { to: "/console/policies", label: "Security Policies", icon: "⚿" },
  { to: "/console/license", label: "License", icon: "⎔" },
];

function ConsoleLayout() {
  const navigate = useNavigate();
  const { data, isAuthLoading, userId, isError } = useSiemContext();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!userId || isError) void navigate({ to: "/" });
    else if (data && data.actor.isSuperAdmin) void navigate({ to: "/vendor" });
  }, [data, isAuthLoading, userId, isError, navigate]);

  if (!data || data.actor.isSuperAdmin) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading console…
      </div>
    );
  }

  return (
    <AppShell ctx={data} nav={nav} scopeLabel={data.org?.name ?? "Console"}>
      <Outlet />
    </AppShell>
  );
}
