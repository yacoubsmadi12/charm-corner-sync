import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, StatusPill } from "@/components/siem/ui-bits";
import {
  downloadLicenseFn,
  listOrganizationsFn,
  setLicenseStatusFn,
} from "@/lib/siem/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/vendor/licenses")({
  head: () => ({
    meta: [
      { title: "License Management — DirAmn SIEM Vendor Console" },
      {
        name: "description",
        content:
          "Suspend, activate, renew or revoke customer licenses and re-issue signed DirAmn license files.",
      },
      { property: "og:title", content: "License Management — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Vendor lifecycle control for signed DirAmn SIEM licenses.",
      },
    ],
  }),
  component: LicensesPage,
});

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function LicensesPage() {
  const qc = useQueryClient();
  const listOrgs = useServerFn(listOrganizationsFn);
  const setStatus = useServerFn(setLicenseStatusFn);
  const getFile = useServerFn(downloadLicenseFn);

  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => listOrgs(),
  });

  const { data: licenses } = useQuery({
    queryKey: ["licenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: (vars: {
      licenseId: string;
      status: "active" | "suspended" | "revoked" | "expired";
      expiresAt?: string;
    }) => setStatus({ data: vars }),
    onSuccess: () => {
      toast.success("License updated");
      void qc.invalidateQueries({ queryKey: ["licenses"] });
      void qc.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orgName = (id: string) => orgs?.find((o) => o.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        title="License Management"
        description="Signed licenses control plan, EPS and retention for every tenant."
      />
      {!licenses?.length ? (
        <EmptyState
          title="No licenses issued"
          hint="Use the License Generator to issue a signed license."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">License key</th>
                <th className="p-4">Organization</th>
                <th className="p-4">Plan</th>
                <th className="p-4">EPS</th>
                <th className="p-4">Expires</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4 font-mono text-xs text-primary">
                    {l.license_key}
                  </td>
                  <td className="p-4">{orgName(l.org_id)}</td>
                  <td className="p-4 font-mono">{l.plan}</td>
                  <td className="p-4 font-mono">{l.eps_limit}</td>
                  <td className="p-4 font-mono text-xs">
                    {new Date(l.expires_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <StatusPill status={l.status} />
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const res = await getFile({
                            data: { licenseId: l.id },
                          });
                          download(`${l.license_key}.lic`, res.file);
                        }}
                      >
                        .lic
                      </Button>
                      {l.status !== "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            statusMutation.mutate({
                              licenseId: l.id,
                              status: "active",
                            })
                          }
                        >
                          Activate
                        </Button>
                      )}
                      {l.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            statusMutation.mutate({
                              licenseId: l.id,
                              status: "suspended",
                            })
                          }
                        >
                          Suspend
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          statusMutation.mutate({
                            licenseId: l.id,
                            status: "active",
                            expiresAt: new Date(
                              Date.now() + 365 * 86400000,
                            ).toISOString(),
                          })
                        }
                      >
                        Renew 1y
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          statusMutation.mutate({
                            licenseId: l.id,
                            status: "revoked",
                          })
                        }
                      >
                        Revoke
                      </Button>
                    </div>
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
