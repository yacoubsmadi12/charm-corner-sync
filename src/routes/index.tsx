import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldMark } from "@/components/siem/AppShell";
import { Field } from "@/components/siem/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { loginFn } from "@/lib/siem/auth.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DirAmn SIEM — Secure Console Sign In" },
      {
        name: "description",
        content:
          "Sign in to the DirAmn enterprise SIEM console to manage organizations, users, log sources and licensing.",
      },
      { property: "og:title", content: "DirAmn SIEM — Secure Console Sign In" },
      {
        property: "og:description",
        content:
          "Multi-tenant enterprise SIEM platform: authentication, RBAC, LDAP and license management.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const login = useServerFn(loginFn);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/redirect" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login({ data: { identifier, password } });
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (sessionError) throw sessionError;
      await navigate({ to: "/redirect" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^Error:\s*/, "")
          : "Sign in failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* ambient background */}
      <div
        className="pointer-events-none absolute inset-0 -z-30"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="cyber-grid pointer-events-none absolute inset-0 -z-20" />
      <div className="glow-orb pointer-events-none absolute -left-32 top-1/4 -z-20 size-96 rounded-full bg-primary/25" />
      <div className="glow-orb pointer-events-none absolute -right-24 bottom-0 -z-20 size-80 rounded-full bg-accent/20" />
      <div className="scanline pointer-events-none absolute inset-x-0 top-0 -z-10 h-px" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_minmax(0,420px)]">
        {/* brand / narrative */}
        <div className="hidden flex-col gap-10 lg:flex">
          <div className="flex items-center gap-3">
            <ShieldMark />
            <div className="leading-tight">
              <div className="text-lg font-semibold tracking-[0.32em]">
                DIRAMN
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                security operations platform
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
              <span className="ticker size-1.5 rounded-full bg-primary" />
              secure channel established
            </div>
            <h2 className="max-w-xl text-4xl font-semibold leading-[1.15] xl:text-5xl">
              Detect. Investigate.{" "}
              <span className="text-gradient">Contain the threat.</span>
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Multi-tenant SIEM with AI-assisted investigation, MITRE ATT&amp;CK
              coverage, threat hunting and signed license enforcement.
            </p>
          </div>

          <div className="grid max-w-xl grid-cols-2 gap-3">
            {[
              { k: "AI Investigation", v: "Automated alert triage" },
              { k: "Threat Hunting", v: "Pivot across telemetry" },
              { k: "MITRE ATT&CK", v: "Technique coverage map" },
              { k: "Risk Scoring", v: "Entity-level exposure" },
            ].map((f) => (
              <div
                key={f.k}
                className="rounded-lg border border-border/70 bg-card/50 p-4 backdrop-blur transition-colors hover:border-primary/40"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                  {f.k}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{f.v}</div>
              </div>
            ))}
          </div>

          <p className="font-mono text-[11px] text-muted-foreground/70">
            DirAmn SIEM · encrypted session · all access is audited
          </p>
        </div>

        {/* auth card */}
        <div className="flex items-center justify-center">
          <form
            onSubmit={onSubmit}
            className="panel-glow w-full max-w-sm space-y-5 p-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 lg:hidden">
                <ShieldMark />
                <span className="text-sm font-semibold tracking-[0.28em]">
                  DIRAMN
                </span>
              </div>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                <span className="ticker">●</span> online
              </span>
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">
                Operator sign in
              </h1>
              <p className="font-mono text-[11px] text-muted-foreground">
                identity verification required
              </p>
            </div>

            <Field label="Username or email">
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                placeholder="admin"
                className="font-mono"
                required
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="font-mono"
                required
              />
            </Field>

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full font-mono uppercase tracking-[0.18em]"
              disabled={busy}
            >
              {busy ? "authenticating…" : "authenticate"}
            </Button>

            <div className="border-t border-border/70 pt-4 text-center font-mono text-[10px] leading-relaxed text-muted-foreground">
              first run seeds vendor account{" "}
              <span className="text-primary">admin / admin</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
