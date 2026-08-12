import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, Field, PageHeader, StatCard, StatusPill } from "@/components/siem/ui-bits";
import {
  generateSampleDataFn,
  importFileFn,
  listIngestionJobsFn,
  previewFileFn,
  sourceHealthFn,
} from "@/lib/siem/siem.functions";

export const Route = createFileRoute("/console/ingest")({
  head: () => ({
    meta: [
      { title: "Log Ingestion — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Upload CSV, JSON and syslog files, generate realistic test data, monitor source health and read the REST, Syslog, Webhook and SNMP ingestion API reference.",
      },
      { property: "og:title", content: "Log Ingestion — DirAmn SIEM" },
      {
        property: "og:description",
        content: "File import, test data generation, source health and ingestion API reference.",
      },
    ],
  }),
  component: IngestPage,
});

const FORMATS = ["auto", "csv", "json", "jsonl", "syslog", "apache", "nginx", "windows", "txt"] as const;

function IngestPage() {
  const qc = useQueryClient();
  const preview = useServerFn(previewFileFn);
  const importFn = useServerFn(importFileFn);
  const generate = useServerFn(generateSampleDataFn);
  const jobsFn = useServerFn(listIngestionJobsFn);
  const healthFn = useServerFn(sourceHealthFn);

  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("auto");
  const [sourceId, setSourceId] = useState<string>("none");
  const [sample, setSample] = useState<{ total: number; sample: unknown[] } | null>(null);
  const [count, setCount] = useState(200);

  const { data: sources } = useQuery({ queryKey: ["source-health"], queryFn: () => healthFn({}), refetchInterval: 30_000 });
  const { data: jobs } = useQuery({ queryKey: ["ingest-jobs"], queryFn: () => jobsFn({}) });

  const doPreview = useMutation({
    mutationFn: () => preview({ data: { fileName, format, content } }),
    onSuccess: (r) => setSample(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const doImport = useMutation({
    mutationFn: () =>
      importFn({ data: { fileName: fileName || "manual-upload", format, content, sourceId: sourceId === "none" ? null : sourceId } }),
    onSuccess: (r) => {
      toast.success(`Imported ${r.accepted} of ${r.total} events${r.alerts ? ` · ${r.alerts} alerts raised` : ""}`);
      setSample(null);
      void qc.invalidateQueries({ queryKey: ["ingest-jobs"] });
      void qc.invalidateQueries({ queryKey: ["source-health"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doGenerate = useMutation({
    mutationFn: (attack: boolean) => generate({ data: { count, attack } }),
    onSuccess: (r) => {
      toast.success(`Generated ${r.accepted} test events${r.alerts ? ` · ${r.alerts} alerts raised` : ""}`);
      void qc.invalidateQueries({ queryKey: ["source-health"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <>
      <PageHeader
        title="Log Ingestion"
        description="Bring logs in over REST, Syslog, Webhook or SNMP, upload files, or generate realistic test data."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sources" value={sources?.length ?? "—"} />
        <StatCard
          label="Healthy"
          value={(sources ?? []).filter((s) => s.stats?.health === "healthy").length}
        />
        <StatCard
          label="Total events"
          value={(sources ?? []).reduce((sum, s) => sum + (s.stats?.event_count ?? 0), 0)}
        />
        <StatCard
          label="Combined EPS"
          value={(sources ?? []).reduce((sum, s) => sum + Number(s.stats?.eps ?? 0), 0).toFixed(2)}
        />
      </div>

      <Tabs defaultValue="upload" className="mt-6">
        <TabsList>
          <TabsTrigger value="upload">File import</TabsTrigger>
          <TabsTrigger value="generate">Test data</TabsTrigger>
          <TabsTrigger value="api">API reference</TabsTrigger>
          <TabsTrigger value="health">Source health</TabsTrigger>
          <TabsTrigger value="jobs">Import history</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="panel mt-4 space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Log file" hint="CSV, JSON, JSONL, syslog, Apache/Nginx or plain text">
              <Input
                type="file"
                accept=".csv,.json,.jsonl,.log,.txt,.evtx.json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 20 * 1024 * 1024) { toast.error("File larger than 20MB"); return; }
                  setFileName(file.name);
                  setContent(await file.text());
                  setSample(null);
                }}
              />
            </Field>
            <Field label="Format">
              <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Attach to source">
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {(sources ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Or paste log content">
            <Textarea
              rows={6}
              value={content}
              onChange={(e) => { setContent(e.target.value); setSample(null); }}
              className="font-mono text-xs"
              placeholder="Paste raw logs, CSV rows or JSON here"
            />
          </Field>

          <div className="flex gap-2">
            <Button variant="outline" disabled={!content || doPreview.isPending} onClick={() => doPreview.mutate()}>
              Preview mapping
            </Button>
            <Button disabled={!content || doImport.isPending} onClick={() => doImport.mutate()}>
              Import events
            </Button>
          </div>

          {sample && (
            <div className="rounded-md border border-border p-4">
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                Preview — {sample.total} parsed rows, first {sample.sample.length} normalized
              </p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
                {JSON.stringify(sample.sample, null, 2)}
              </pre>
            </div>
          )}
        </TabsContent>

        <TabsContent value="generate" className="panel mt-4 space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            Generates realistic authentication, firewall, malware, web and SNMP events. Every generated
            record is tagged <span className="font-mono">[TEST DATA]</span> and flagged as demo data.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Event count">
              <Input type="number" min={1} max={2000} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={doGenerate.isPending} onClick={() => doGenerate.mutate(false)}>
              Generate events
            </Button>
            <Button variant="outline" disabled={doGenerate.isPending} onClick={() => doGenerate.mutate(true)}>
              Generate + attack scenario
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="api" className="panel mt-4 space-y-4 p-5 text-sm">
          <p className="text-muted-foreground">
            Authenticate every request with the per-source API key from the Log Sources page, sent as
            <span className="font-mono"> X-API-Key</span>.
          </p>
          {[
            { title: "REST JSON", path: "/api/public/logs/ingest", body: '{"events":[{"timestamp":"2026-01-01T10:00:00Z","severity":"high","event_type":"failed_login","message":"Failed password for admin","source_ip":"10.0.0.9","user":"admin","host":"dc01"}]}' },
            { title: "Syslog (RFC3164 / RFC5424)", path: "/api/public/logs/syslog", body: '<34>Oct 11 22:14:15 dc01 sshd[1234]: Failed password for admin from 10.0.0.9 port 2222 ssh2' },
            { title: "Generic webhook", path: "/api/public/logs/webhook", body: '{"records":[{"message":"deny src=1.2.3.4","severity":"medium"}]}' },
            { title: "SNMP trap forwarder", path: "/api/public/logs/snmp", body: '{"trap":"linkDown","agent_address":"10.0.0.1","varbinds":{"ifIndex":3}}' },
          ].map((ep) => (
            <div key={ep.path} className="rounded-md border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{ep.title}</span>
                <span className="font-mono text-xs text-primary">POST {ep.path}</span>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-3 font-mono text-[11px]">
{`curl -X POST ${origin}${ep.path} \\
  -H "X-API-Key: <source-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '${ep.body}'`}
              </pre>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="health" className="panel mt-4 overflow-x-auto">
          {(sources ?? []).length === 0 ? (
            <EmptyState title="No sources registered" hint="Add sources from the Log Sources page." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Source</th><th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Events</th><th className="px-4 py-3">EPS</th>
                  <th className="px-4 py-3">Last event</th><th className="px-4 py-3">Health</th>
                </tr>
              </thead>
              <tbody>
                {(sources ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{s.source_type}</td>
                    <td className="px-4 py-2 font-mono text-xs">{s.stats?.event_count ?? 0}</td>
                    <td className="px-4 py-2 font-mono text-xs">{s.stats?.eps ?? 0}</td>
                    <td className="px-4 py-2 text-xs">
                      {s.stats?.last_event_at ? new Date(s.stats.last_event_at).toLocaleString() : "never"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill
                        status={s.stats?.health ?? "idle"}
                        tone={s.stats?.health === "healthy" ? "ok" : s.stats?.health === "over_limit" ? "bad" : "muted"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="panel mt-4 overflow-x-auto">
          {(jobs ?? []).length === 0 ? (
            <EmptyState title="No imports yet" hint="Upload a log file to see its processing history." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">File</th><th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Rows</th><th className="px-4 py-3">Imported</th>
                  <th className="px-4 py-3">Failed</th><th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {(jobs ?? []).map((j) => (
                  <tr key={j.id} className="border-b border-border/50">
                    <td className="px-4 py-2">{j.file_name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{j.format}</td>
                    <td className="px-4 py-2 font-mono text-xs">{j.total_rows}</td>
                    <td className="px-4 py-2 font-mono text-xs">{j.imported_rows}</td>
                    <td className="px-4 py-2 font-mono text-xs">{j.failed_rows}</td>
                    <td className="px-4 py-2">
                      <StatusPill status={j.status} tone={j.status === "completed" ? "ok" : j.status === "failed" ? "bad" : "muted"} />
                    </td>
                    <td className="px-4 py-2 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
