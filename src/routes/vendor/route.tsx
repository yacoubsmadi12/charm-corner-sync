import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell, type NavItem } from "@/components/siem/AppShell";
import { useSiemContext } from "@/lib/siem/session";

export const Route = createFileRoute("/vendor")({
  component: VendorLayout,
});

const nav: NavItem[] = [
  { to: "/vendor", label: "SaaS Dashboard", icon: "◈" },
  { to: "/vendor/organizations", label: "Organizations", icon: "▤" },
  { to: "/vendor/licenses", label: "License Management", icon: "⎔" },
  { to: "/vendor/generator", label: "License Generator", icon: "✦" },
  { to: "/vendor/health", label: "Platform Health", icon: "❤" },
  { to: "/vendor/audit", label: "Global Audit Logs", icon: "☰" },
];

function VendorLayout() {
  const navigate = useNavigate();
  const { data, isAuthLoading, userId, isError } = useSiemContext();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!userId || isError) void navigate({ to: "/" });
    else if (data && !data.actor.isSuperAdmin) void navigate({ to: "/console" });
  }, [data, isAuthLoading, userId, isError, navigate]);

  if (!data?.actor.isSuperAdmin) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading vendor console…
      </div>
    );
  }

  return (
    <AppShell ctx={data} nav={nav} scopeLabel="Vendor Console">
      <Outlet />
    </AppShell>
  );
}
