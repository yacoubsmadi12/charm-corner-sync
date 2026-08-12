import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, PageHeader } from "@/components/siem/ui-bits";
import { savePolicyFn } from "@/lib/siem/admin.functions";
import { useSiemContext } from "@/lib/siem/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/console/policies")({
  head: () => ({
    meta: [
      { title: "Security Policies — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Configure password complexity, expiry, lockout thresholds and session timeout policies for your DirAmn SIEM tenant.",
      },
      { property: "og:title", content: "Security Policies — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Password, lockout and session policies for your tenant.",
      },
    ],
  }),
  component: PoliciesPage,
});

type Policy = {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_special: boolean;
  password_expiry_days: number;
  password_history: number;
  failed_login_limit: number;
  lockout_minutes: number;
  session_timeout_minutes: number;
  inactive_user_days: number;
  local_auth_enabled: boolean;
};

const DEFAULTS: Policy = {
  min_length: 8,
  require_uppercase: true,
  require_lowercase: true,
  require_number: true,
  require_special: false,
  password_expiry_days: 90,
  password_history: 3,
  failed_login_limit: 5,
  lockout_minutes: 15,
  session_timeout_minutes: 60,
  inactive_user_days: 90,
  local_auth_enabled: true,
};

const TOGGLES: [keyof Policy, string][] = [
  ["require_uppercase", "Require uppercase letter"],
  ["require_lowercase", "Require lowercase letter"],
  ["require_number", "Require number"],
  ["require_special", "Require special character"],
  ["local_auth_enabled", "Allow local password login"],
];

const NUMBERS: [keyof Policy, string][] = [
  ["min_length", "Minimum length"],
  ["password_expiry_days", "Password expiry (days, 0 = never)"],
  ["password_history", "Password history"],
  ["failed_login_limit", "Failed login limit"],
  ["lockout_minutes", "Lockout duration (minutes)"],
  ["session_timeout_minutes", "Session timeout (minutes)"],
  ["inactive_user_days", "Disable inactive users after (days)"],
];

function PoliciesPage() {
  const qc = useQueryClient();
  const { data: ctx } = useSiemContext();
  const savePolicy = useServerFn(savePolicyFn);
  const orgId = ctx?.actor.orgId ?? null;
  const [form, setForm] = useState<Policy>(DEFAULTS);

  const { data: policy } = useQuery({
    queryKey: ["policy", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("password_policies")
        .select("*")
        .eq("org_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (policy) setForm((f) => ({ ...f, ...(policy as Partial<Policy>) }));
  }, [policy]);

  const save = useMutation({
    mutationFn: () => savePolicy({ data: form }),
    onSuccess: () => {
      toast.success("Security policy saved");
      void qc.invalidateQueries({ queryKey: ["policy", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Security Policies"
        description="Applied to every local account in your organization."
      />
      <form
        className="grid gap-6 lg:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <section className="panel space-y-4 p-6">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            Thresholds
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {NUMBERS.map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  type="number"
                  value={String(form[key])}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                  }
                />
              </Field>
            ))}
          </div>
        </section>

        <section className="panel space-y-4 p-6">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            Complexity
          </h2>
          <div className="space-y-3">
            {TOGGLES.map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-md border border-border/70 px-4 py-3 text-sm"
              >
                {label}
                <Switch
                  checked={Boolean(form[key])}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                />
              </label>
            ))}
          </div>
        </section>

        <div className="lg:col-span-2 flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save policy"}
          </Button>
        </div>
      </form>
    </>
  );
}
