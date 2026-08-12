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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="grid-noise relative hidden flex-col justify-between p-12 lg:flex">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="flex items-center gap-3">
          <ShieldMark />
          <span className="text-lg font-semibold tracking-[0.3em]">DIRAMN</span>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="text-4xl font-semibold leading-tight">
            Enterprise <span className="text-gradient">security operations</span>,
            multi-tenant by design.
          </h2>
          <p className="text-sm text-muted-foreground">
            Phase 1 foundation: hardened authentication, role-based access
            control, directory integration, log source onboarding and signed
            licensing.
          </p>
          <ul className="grid gap-2 text-xs text-muted-foreground">
            {[
              "Strict tenant isolation on every record",
              "Vendor and customer administration separated",
              "Signed license files decide the plan",
              "Full audit trail of privileged actions",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          DirAmn SIEM · Phase 1 Foundation
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="panel w-full max-w-sm space-y-5 p-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="text-xs text-muted-foreground">
              Use your DirAmn username or email address.
            </p>
          </div>

          <Field label="Username or email">
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              placeholder="admin"
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Authenticating…" : "Sign in"}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            First run seeds the vendor account{" "}
            <span className="font-mono text-primary">admin / admin</span>
          </p>
        </form>
      </div>
    </div>
  );
}
