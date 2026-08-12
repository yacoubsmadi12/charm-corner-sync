import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, Field, PageHeader, StatusPill } from "@/components/siem/ui-bits";
import {
  createOrganizationFn,
  listOrganizationsFn,
} from "@/lib/siem/admin.functions";

export const Route = createFileRoute("/vendor/organizations")({
  head: () => ({
    meta: [
      { title: "Organizations — DirAmn SIEM Vendor Console" },
      {
        name: "description",
        content:
          "Create customer organizations, provision their first administrator and review tenant usage across DirAmn SIEM.",
      },
      { property: "og:title", content: "Organizations — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Create and monitor customer tenants on the DirAmn platform.",
      },
    ],
  }),
  component: OrganizationsPage,
});

function OrganizationsPage() {
  const qc = useQueryClient();
  const listOrgs = useServerFn(listOrganizationsFn);
  const createOrg = useServerFn(createOrganizationFn);
  const [open, setOpen] = useState(false);

  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => listOrgs(),
  });

  const mutation = useMutation({
    mutationFn: (form: FormData) =>
      createOrg({
        data: {
          name: String(form.get("name")),
          slug: String(form.get("slug")),
          contactEmail: String(form.get("contactEmail")),
          plan: String(form.get("plan")) as "STARTER",
          adminUsername: String(form.get("adminUsername")),
          adminEmail: String(form.get("adminEmail")),
          adminPassword: String(form.get("adminPassword")),
        },
      }),
    onSuccess: () => {
      toast.success("Organization created");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Each organization is an isolated tenant with its own users, sources, policies and license."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New organization</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create organization</DialogTitle>
              </DialogHeader>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate(new FormData(e.currentTarget));
                }}
              >
                <Field label="Name">
                  <Input name="name" required placeholder="Acme Corporation" />
                </Field>
                <Field label="Slug">
                  <Input name="slug" required placeholder="acme" />
                </Field>
                <Field label="Contact email">
                  <Input
                    name="contactEmail"
                    type="email"
                    required
                    placeholder="soc@acme.com"
                  />
                </Field>
                <Field label="Plan">
                  <Select name="plan" defaultValue="STARTER">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STARTER">Starter</SelectItem>
                      <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                      <SelectItem value="ENTERPRISE_AI">Enterprise AI</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2 border-t border-border pt-3 text-xs uppercase tracking-widest text-muted-foreground">
                  Initial organization administrator
                </div>
                <Field label="Admin username">
                  <Input name="adminUsername" required placeholder="acme.admin" />
                </Field>
                <Field label="Admin email">
                  <Input
                    name="adminEmail"
                    type="email"
                    required
                    placeholder="admin@acme.com"
                  />
                </Field>
                <Field label="Temporary password">
                  <Input name="adminPassword" required minLength={4} />
                </Field>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Creating…" : "Create organization"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {!orgs?.length ? (
        <EmptyState
          title="No organizations yet"
          hint="Create the first tenant to start onboarding customers."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">Organization</th>
                <th className="p-4">Plan</th>
                <th className="p-4">EPS</th>
                <th className="p-4">Retention</th>
                <th className="p-4">Users</th>
                <th className="p-4">Sources</th>
                <th className="p-4">License</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4">
                    <div className="font-medium">{o.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {o.slug} · {o.contact_email}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-primary">{o.plan}</td>
                  <td className="p-4 font-mono">{o.eps_limit}</td>
                  <td className="p-4 font-mono">{o.retention_days}d</td>
                  <td className="p-4 font-mono">{o.user_count}</td>
                  <td className="p-4 font-mono">{o.source_count}</td>
                  <td className="p-4">
                    <StatusPill status={o.license ? o.license.status : "none"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
