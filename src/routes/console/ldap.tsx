import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, PageHeader } from "@/components/siem/ui-bits";
import { saveLdapFn, testLdapFn } from "@/lib/siem/admin.functions";
import { useSiemContext } from "@/lib/siem/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/console/ldap")({
  head: () => ({
    meta: [
      { title: "LDAP & Active Directory — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Connect your directory service to DirAmn SIEM: bind settings, user search filters, group-to-role mapping and connection testing.",
      },
      { property: "og:title", content: "LDAP & Active Directory — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Directory integration and group-to-role mapping for DirAmn SIEM.",
      },
    ],
  }),
  component: LdapPage,
});

type LdapForm = {
  enabled: boolean;
  server_host: string;
  server_port: number;
  use_ssl: boolean;
  use_tls: boolean;
  bind_dn: string;
  base_dn: string;
  user_search_base: string;
  user_search_filter: string;
  username_attribute: string;
  email_attribute: string;
  display_name_attribute: string;
  group_search_base: string;
  group_search_filter: string;
  group_map_org_admin: string;
  group_map_analyst: string;
  group_map_viewer: string;
};

const DEFAULTS: LdapForm = {
  enabled: false,
  server_host: "",
  server_port: 389,
  use_ssl: false,
  use_tls: false,
  bind_dn: "",
  base_dn: "",
  user_search_base: "",
  user_search_filter: "(sAMAccountName={username})",
  username_attribute: "sAMAccountName",
  email_attribute: "mail",
  display_name_attribute: "displayName",
  group_search_base: "",
  group_search_filter: "(member={dn})",
  group_map_org_admin: "",
  group_map_analyst: "",
  group_map_viewer: "",
};

function LdapPage() {
  const qc = useQueryClient();
  const { data: ctx } = useSiemContext();
  const saveLdap = useServerFn(saveLdapFn);
  const testLdap = useServerFn(testLdapFn);
  const orgId = ctx?.actor.orgId ?? null;

  const [form, setForm] = useState<LdapForm>(DEFAULTS);
  const [bindPassword, setBindPassword] = useState("");
  const [testUser, setTestUser] = useState("");

  const { data: config } = useQuery({
    queryKey: ["ldap", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ldap_configs")
        .select("*")
        .eq("org_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      setForm((prev) => ({ ...prev, ...(config as Partial<LdapForm>) }));
    }
  }, [config]);

  const set = <K extends keyof LdapForm>(k: K, v: LdapForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      saveLdap({ data: { ...form, bindPassword: bindPassword || null } }),
    onSuccess: () => {
      toast.success("LDAP configuration saved");
      setBindPassword("");
      void qc.invalidateQueries({ queryKey: ["ldap", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runTest = async (mode: "connection" | "authentication") => {
    try {
      const res = await testLdap({
        data: { mode, username: testUser || undefined },
      });
      const msg = res.messages.join(" · ");
      if (res.ok) toast.success(msg);
      else toast.error(msg);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title="LDAP / Active Directory"
        description="Authenticate users against your directory and map groups to DirAmn roles."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Enabled
            </span>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => set("enabled", v)}
            />
          </div>
        }
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
            Connection
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Server host">
              <Input
                value={form.server_host}
                onChange={(e) => set("server_host", e.target.value)}
                placeholder="dc01.corp.local"
              />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={form.server_port}
                onChange={(e) => set("server_port", Number(e.target.value))}
              />
            </Field>
            <Field label="Bind DN">
              <Input
                value={form.bind_dn}
                onChange={(e) => set("bind_dn", e.target.value)}
                placeholder="CN=svc-diramn,OU=Service,DC=corp,DC=local"
              />
            </Field>
            <Field label="Bind password">
              <Input
                type="password"
                value={bindPassword}
                onChange={(e) => setBindPassword(e.target.value)}
                placeholder={config ? "unchanged" : ""}
              />
            </Field>
            <Field label="Base DN">
              <Input
                value={form.base_dn}
                onChange={(e) => set("base_dn", e.target.value)}
                placeholder="DC=corp,DC=local"
              />
            </Field>
            <div className="flex items-end gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.use_ssl}
                  onCheckedChange={(v) => set("use_ssl", v)}
                />
                LDAPS
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.use_tls}
                  onCheckedChange={(v) => set("use_tls", v)}
                />
                StartTLS
              </label>
            </div>
          </div>
        </section>

        <section className="panel space-y-4 p-6">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            User mapping
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="User search base">
              <Input
                value={form.user_search_base}
                onChange={(e) => set("user_search_base", e.target.value)}
              />
            </Field>
            <Field label="User search filter">
              <Input
                value={form.user_search_filter}
                onChange={(e) => set("user_search_filter", e.target.value)}
              />
            </Field>
            <Field label="Username attribute">
              <Input
                value={form.username_attribute}
                onChange={(e) => set("username_attribute", e.target.value)}
              />
            </Field>
            <Field label="Email attribute">
              <Input
                value={form.email_attribute}
                onChange={(e) => set("email_attribute", e.target.value)}
              />
            </Field>
            <Field label="Display name attribute">
              <Input
                value={form.display_name_attribute}
                onChange={(e) => set("display_name_attribute", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="panel space-y-4 p-6">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            Group to role mapping
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Group search base">
              <Input
                value={form.group_search_base}
                onChange={(e) => set("group_search_base", e.target.value)}
              />
            </Field>
            <Field label="Group search filter">
              <Input
                value={form.group_search_filter}
                onChange={(e) => set("group_search_filter", e.target.value)}
              />
            </Field>
            <Field label="Org admin group">
              <Input
                value={form.group_map_org_admin}
                onChange={(e) => set("group_map_org_admin", e.target.value)}
                placeholder="SIEM-Admins"
              />
            </Field>
            <Field label="Analyst group">
              <Input
                value={form.group_map_analyst}
                onChange={(e) => set("group_map_analyst", e.target.value)}
                placeholder="SIEM-Analysts"
              />
            </Field>
            <Field label="Viewer group">
              <Input
                value={form.group_map_viewer}
                onChange={(e) => set("group_map_viewer", e.target.value)}
                placeholder="SIEM-Viewers"
              />
            </Field>
          </div>
        </section>

        <section className="panel space-y-4 p-6">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            Test directory
          </h2>
          <Field label="Test username (optional)">
            <Input
              value={testUser}
              onChange={(e) => setTestUser(e.target.value)}
              placeholder="jdoe"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => runTest("connection")}
            >
              Test connection
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => runTest("authentication")}
            >
              Test user lookup
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Save the configuration before testing — tests use the stored bind
            credentials, which are never returned to the browser.
          </p>
        </section>

        <div className="lg:col-span-2 flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save LDAP configuration"}
          </Button>
        </div>
      </form>
    </>
  );
}
