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
  deleteSourceFn,
  rotateSourceKeyFn,
  saveSourceFn,
} from "@/lib/siem/admin.functions";
import { useSiemContext } from "@/lib/siem/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/console/sources")({
  head: () => ({
    meta: [
      { title: "Log Sources — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Register firewalls, endpoints, servers and cloud log sources, and rotate per-source ingestion API keys.",
      },
      { property: "og:title", content: "Log Sources — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Register log sources and rotate ingestion API keys.",
      },
    ],
  }),
  component: SourcesPage,
});

const TYPES = [
  "firewall",
  "endpoint",
  "server",
  "network",
  "cloud",
  "application",
  "identity",
];

function SourcesPage() {
  const qc = useQueryClient();
  const { data: ctx } = useSiemContext();
  const saveSource = useServerFn(saveSourceFn);
  const deleteSource = useServerFn(deleteSourceFn);
  const rotateKey = useServerFn(rotateSourceKeyFn);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(
    null,
  );
  const orgId = ctx?.actor.orgId ?? null;

  const { data: sources } = useQuery({
    queryKey: ["sources", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sources")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["sources", orgId] });

  const create = useMutation({
    mutationFn: (form: FormData) =>
      saveSource({
        data: {
          name: String(form.get("name")),
          sourceType: String(form.get("sourceType")),
          sourceIp: String(form.get("sourceIp") ?? ""),
          vendor: String(form.get("vendor") ?? ""),
          deviceType: String(form.get("deviceType") ?? ""),
          status: "enabled",
        },
      }),
    onSuccess: () => {
      toast.success("Source registered");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Log Sources"
        description="Every source belongs to your organization and carries its own ingestion key."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add source</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register log source</DialogTitle>
              </DialogHeader>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate(new FormData(e.currentTarget));
                }}
              >
                <Field label="Name">
                  <Input name="name" required placeholder="Perimeter FW-01" />
                </Field>
                <Field label="Type">
                  <Select name="sourceType" defaultValue="firewall">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Source IP">
                  <Input name="sourceIp" placeholder="10.0.0.1" />
                </Field>
                <Field label="Vendor">
                  <Input name="vendor" placeholder="Palo Alto" />
                </Field>
                <Field label="Device model">
                  <Input name="deviceType" placeholder="PA-3220" />
                </Field>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" disabled={create.isPending}>
                    Register source
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={!!revealed} onOpenChange={() => setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New ingestion key — {revealed?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Copy this key now. Only a hash is stored, so it cannot be shown again.
          </p>
          <div className="rounded-md border border-border bg-background p-4 font-mono text-xs break-all text-primary">
            {revealed?.key}
          </div>
        </DialogContent>
      </Dialog>

      {!sources?.length ? (
        <EmptyState
          title="No log sources"
          hint="Register a device to start collecting events."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((s) => (
            <div key={s.id} className="panel space-y-3 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {s.source_type} · {s.source_ip || "no ip"}
                  </div>
                </div>
                <StatusPill status={s.status} />
              </div>
              <div className="text-xs text-muted-foreground">
                {[s.vendor, s.device_type].filter(Boolean).join(" · ") ||
                  "No vendor metadata"}
              </div>
              <div className="rounded-md border border-border bg-background/60 p-3 font-mono text-[11px] break-all text-primary">
                {s.api_key_prefix ? `${s.api_key_prefix}••••••••••••••••` : "No key issued"}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const res = await rotateKey({ data: { sourceId: s.id } });
                    setRevealed({ name: s.name, key: res.apiKey });
                    toast.success("API key rotated");
                    invalidate();
                  }}
                >
                  Rotate key
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await saveSource({
                      data: {
                        id: s.id,
                        name: s.name,
                        sourceType: s.source_type,
                        sourceIp: s.source_ip,
                        vendor: s.vendor,
                        deviceType: s.device_type,
                        status: s.status === "enabled" ? "disabled" : "enabled",
                      },
                    });
                    invalidate();
                  }}
                >
                  {s.status === "enabled" ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (!window.confirm(`Delete ${s.name}?`)) return;
                    await deleteSource({ data: { sourceId: s.id } });
                    toast.success("Source deleted");
                    invalidate();
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
