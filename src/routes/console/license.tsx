import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, StatCard, StatusPill } from "@/components/siem/ui-bits";
import { uploadLicenseFn } from "@/lib/siem/admin.functions";
import { useSiemContext } from "@/lib/siem/session";

export const Route = createFileRoute("/console/license")({
  head: () => ({
    meta: [
      { title: "License — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Upload your signed DirAmn license file and review plan entitlements, EPS limits, retention and enabled features.",
      },
      { property: "og:title", content: "License — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Upload and review your DirAmn SIEM license entitlements.",
      },
    ],
  }),
  component: LicensePage,
});

function LicensePage() {
  const { data: ctx, refetch } = useSiemContext();
  const upload = useServerFn(uploadLicenseFn);
  const [content, setContent] = useState("");

  const mutation = useMutation({
    mutationFn: () => upload({ data: { fileContent: content } }),
    onSuccess: () => {
      toast.success("License verified and activated");
      setContent("");
      void refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const license = ctx?.license;
  const ent = ctx?.entitlements;

  return (
    <>
      <PageHeader
        title="License"
        description="Entitlements come from a signed vendor license file. Plans cannot be self-selected."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Plan" value={ent?.plan ?? "Unlicensed"} />
        <StatCard label="EPS limit" value={license?.eps_limit ?? "—"} />
        <StatCard label="Max users" value={license?.max_users ?? "—"} />
        <StatCard
          label="Expires"
          value={
            license ? new Date(license.expires_at).toLocaleDateString() : "—"
          }
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
              Current license
            </h2>
            <StatusPill status={license?.status ?? "none"} />
          </div>
          {license ? (
            <dl className="space-y-2 text-sm">
              <Row label="License key" value={license.license_key} />
              <Row label="Retention" value={`${license.retention_days} days`} />
              <Row label="Max sources" value={String(license.max_sources)} />
              <Row
                label="Issued"
                value={new Date(license.issued_at).toLocaleDateString()}
              />
              <Row label="Signature" value={ent?.signatureAlg ?? "unknown"} />
              <Row
                label="Validity"
                value={
                  ent?.valid
                    ? ent.inGrace
                      ? `in grace period (${ent.daysRemaining} days)`
                      : `valid (${ent.daysRemaining} days left)`
                    : `not usable (${ent?.reason ?? "unknown"})`
                }
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active license. Upload the .lic file supplied by your vendor.
            </p>
          )}
        </div>

        <div className="panel space-y-4 p-6">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            Licensed features
          </h2>
          <div className="flex flex-wrap gap-2">
            {(ent?.features ?? []).map((f) => (
              <span
                key={f}
                className="rounded-full border border-border px-3 py-1 text-xs"
              >
                {f}
              </span>
            ))}
            {!ent?.features.length && (
              <p className="text-sm text-muted-foreground">
                No features enabled — upload a signed license file.
              </p>
            )}
          </div>
        </div>

        <div className="panel space-y-4 p-6 lg:col-span-2">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            Upload license file
          </h2>
          <input
            type="file"
            accept=".lic,.txt,.json"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-2 file:text-sm file:text-secondary-foreground"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setContent(await file.text());
            }}
          />
          <Textarea
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="…or paste the signed license contents here"
            className="font-mono text-xs"
          />
          <Button
            onClick={() => mutation.mutate()}
            disabled={!content || mutation.isPending}
          >
            {mutation.isPending ? "Verifying…" : "Verify and activate"}
          </Button>
          <p className="text-xs text-muted-foreground">
            The signature is verified on the server. Tampered or expired files are
            rejected.
          </p>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs">{value}</dd>
    </div>
  );
}
