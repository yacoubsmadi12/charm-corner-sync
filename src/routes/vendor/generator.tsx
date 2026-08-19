import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, PageHeader } from "@/components/siem/ui-bits";
import {
  generateLicenseFn,
  listOrganizationsFn,
} from "@/lib/siem/admin.functions";

export const Route = createFileRoute("/vendor/generator")({
  head: () => ({
    meta: [
      { title: "License Generator — DirAmn SIEM Vendor Console" },
      {
        name: "description",
        content:
          "Issue cryptographically signed DirAmn license files with plan, EPS, retention, seat limits and feature flags.",
      },
      { property: "og:title", content: "License Generator — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Issue signed license files for DirAmn SIEM tenants.",
      },
    ],
  }),
  component: GeneratorPage,
});

type Preset = {
  eps: number;
  retention: number;
  users: number;
  sources: number;
};

const PLAN_PRESETS: Record<
  "STARTER" | "PROFESSIONAL" | "ENTERPRISE_AI",
  Preset
> = {
  STARTER: { eps: 500, retention: 30, users: 10, sources: 25 },
  PROFESSIONAL: { eps: 5000, retention: 180, users: 100, sources: 250 },
  ENTERPRISE_AI: { eps: 20000, retention: 365, users: 500, sources: 1000 },
};

const ALL_FEATURES = [
  "correlation",
  "threat_intel",
  "compliance",
  "ueba",
  "soar",
  "threat_hunting",
  "mitre_mapping",
  "risk_scoring",
  "ai_analytics",
  "ai_investigation",
  "ai_chat",
];

/** Features pre-selected for each plan (mirrors the server-side plan defaults). */
const PLAN_FEATURES: Record<keyof typeof PLAN_PRESETS, string[]> = {
  STARTER: ["correlation"],
  PROFESSIONAL: [
    "correlation",
    "threat_intel",
    "compliance",
    "threat_hunting",
    "mitre_mapping",
    "risk_scoring",
  ],
  ENTERPRISE_AI: ALL_FEATURES,
};



function GeneratorPage() {
  const listOrgs = useServerFn(listOrganizationsFn);
  const generate = useServerFn(generateLicenseFn);
  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => listOrgs(),
  });

  const [orgId, setOrgId] = useState("");
  const [plan, setPlan] = useState<keyof typeof PLAN_PRESETS>("STARTER");
  const [preset, setPreset] = useState<Preset>(PLAN_PRESETS.STARTER);
  const [expiresAt, setExpiresAt] = useState(
    new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  );
  const [features, setFeatures] = useState<string[]>(["correlation"]);
  const [issued, setIssued] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      generate({
        data: {
          orgId,
          plan,
          epsLimit: preset.eps,
          retentionDays: preset.retention,
          maxUsers: preset.users,
          maxSources: preset.sources,
          expiresAt,
          features,
        },
      }),
    onSuccess: (res) => {
      setIssued(res.file);
      toast.success(`License ${res.license.license_key} issued`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="License Generator"
        description="Licenses are signed on the vendor server. The private signing key is never exposed to any client."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="panel grid gap-4 p-6 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!orgId) {
              toast.error("Select an organization");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="sm:col-span-2">
            <Field label="Organization">
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {(orgs ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Plan">
            <Select
              value={plan}
              onValueChange={(v) => {
                const p = v as keyof typeof PLAN_PRESETS;
                setPlan(p);
                setPreset(PLAN_PRESETS[p]);
                setFeatures(PLAN_FEATURES[p]);
              }}

            >
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
          <Field label="Expiry date">
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </Field>
          <Field label="EPS limit">
            <Input
              type="number"
              value={preset.eps}
              onChange={(e) =>
                setPreset({ ...preset, eps: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Retention (days)">
            <Input
              type="number"
              value={preset.retention}
              onChange={(e) =>
                setPreset({ ...preset, retention: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Max users">
            <Input
              type="number"
              value={preset.users}
              onChange={(e) =>
                setPreset({ ...preset, users: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Max sources">
            <Input
              type="number"
              value={preset.sources}
              onChange={(e) =>
                setPreset({ ...preset, sources: Number(e.target.value) })
              }
            />
          </Field>

          <div className="sm:col-span-2">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Feature flags
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_FEATURES.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={features.includes(f)}
                    onCheckedChange={(c) =>
                      setFeatures((prev) =>
                        c ? [...prev, f] : prev.filter((x) => x !== f),
                      )
                    }
                  />
                  <span className="font-mono text-xs">{f}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Signing…" : "Generate signed license"}
            </Button>
          </div>
        </form>

        <div className="panel p-6">
          <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
            Signed license file
          </h2>
          {issued ? (
            <>
              <pre className="max-h-80 overflow-auto rounded-md border border-border bg-background p-4 font-mono text-[11px] leading-relaxed text-primary">
                {issued}
              </pre>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([issued], { type: "text/plain" }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "diramn-license.lic";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download .lic
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate a license to preview and download the signed{" "}
              <span className="font-mono">.lic</span> file. Customers upload this
              file in their console — they never pick a plan themselves.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
