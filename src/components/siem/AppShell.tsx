import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, signOutEverywhere, type SiemContext } from "@/lib/siem/session";
import { cn } from "@/lib/utils";

export type NavItem = { to: string; label: string; icon: ReactNode };

export function AppShell({
  ctx,
  nav,
  scopeLabel,
  children,
}: {
  ctx: SiemContext;
  nav: NavItem[];
  scopeLabel: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <ShieldMark />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-[0.2em] text-sidebar-foreground">
              DIRAMN
            </div>
            <div className="text-[10px] uppercase tracking-widest text-primary">
              {scopeLabel}
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active =
              pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary shadow-[inset_2px_0_0_0_var(--sidebar-primary)]"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
          <div className="font-mono text-sidebar-foreground">
            {ctx.actor.username}
          </div>
          <div>{ctx.actor.roles.map((r) => ROLE_LABELS[r]).join(", ")}</div>
          {ctx.org && <div className="mt-1 text-primary">{ctx.org.name}</div>}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => void signOutEverywhere()}
          >
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-card/60 px-6 backdrop-blur">
          <div className="flex items-center gap-3 lg:hidden">
            <ShieldMark />
            <span className="text-sm font-semibold tracking-widest">DIRAMN</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            {ctx.license && (
              <span className="rounded-full border border-primary/40 px-3 py-1 font-mono text-primary">
                {ctx.license.plan} · {ctx.license.eps_limit} EPS
              </span>
            )}
            <span className="hidden font-mono sm:inline">
              {ctx.actor.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => void signOutEverywhere()}
            >
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}

export function ShieldMark() {
  return (
    <div className="grid size-8 place-items-center rounded-md border border-primary/40 bg-primary/10">
      <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none">
        <path
          d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="m8.5 12 2.2 2.2L15.8 9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
