import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader, StatCard } from "@/components/siem/ui-bits";
import {
  deleteHuntFn,
  listHuntsFn,
  runHuntFn,
  saveHuntFn,
} from "@/lib/siem/analytics.functions";
import { suggestHuntsFn } from "@/lib/siem/ai.functions";

export const Route = createFileRoute("/console/hunting")({
  head: () => ({
    meta: [
      { title: "Threat Hunting — DirAmn SIEM" },
      {
        name: "description",
        content:
          "Hypothesis-driven threat hunting across your log telemetry with AI-suggested hunts, pivot aggregations and reusable saved hunts.",
      },
      { property: "og:title", content: "Threat Hunting — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Hunt across your telemetry with AI-suggested queries and saved hunt packs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HuntingPage,
});

const FIELDS = [
  "event_type",
  "source_type",
  "host",
  "user",
  "source_ip",
  "category",
  "raw_message",
] as const;

type Filter = { field: string; op: "eq" | "contains"; value: string };

function HuntingPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listHuntsFn);
  const runFn = useServerFn(runHuntFn);
  const saveFn = useServerFn(saveHuntFn);
  const removeFn = useServerFn(deleteHuntFn);
  const suggestFn = useServerFn(suggestHuntsFn);

  const [filters, setFilters] = useState<Filter[]>([
    { field: "raw_message", op: "contains", value: "" },
  ]);
  const [hours, setHours] = useState(24);
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");

  const { data: saved } = useQuery({
    queryKey: ["saved-hunts"],
    queryFn: () => listFn(),
  });

  const run = useMutation({
    mutationFn: () =>
      runFn({
        data: {
          filters: filters.filter((f) => f.value.trim()),
          hours,
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          name,
          hypothesis,
          query: { filters: filters.filter((f) => f.value.trim()), hours },
        },
      }),
    onSuccess: () => {
      toast.success("Hunt saved");
      setName("");
      void qc.invalidateQueries({ queryKey: ["saved-hunts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["saved-hunts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const suggest = useMutation({
    mutationFn: () => suggestFn({ data: { hypothesis } }),
    onSuccess: (res) => {
      if (!res.hunts.length) toast.info("No hunts suggested");
      else toast.success(`${res.hunts.length} hunts suggested`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (saved && !saved.enabled) {
    return (
      <>
        <PageHeader title="Threat Hunting" description="Hypothesis-driven search across your telemetry." />
        <EmptyState
          title="Threat hunting is not included in your licence"
          hint={`Current plan: ${saved.plan}. Upload a Professional or Enterprise AI licence to enable hunting.`}
        />
      </>
    );
  }

  const result = run.data;

  return (
    <>
      <PageHeader
        title="Threat Hunting"
        description="Build a hypothesis, pivot on the results, and save the hunt for reuse."
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel space-y-4 p-5">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            Hunt builder
          </h2>

          {filters.map((f, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <Select
                value={f.field}
                onValueChange={(v) =>
                  setFilters((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, field: v } : p)),
                  )
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={f.op}
                onValueChange={(v) =>
                  setFilters((prev) =>
                    prev.map((p, i) =>
                      i === idx ? { ...p, op: v as Filter["op"] } : p,
                    ),
                  )
                }
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">contains</SelectItem>
                  <SelectItem value="eq">equals</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="flex-1 min-w-[160px]"
                value={f.value}
                placeholder="value"
                onChange={(e) =>
                  setFilters((prev) =>
                    prev.map((p, i) =>
                      i === idx ? { ...p, value: e.target.value } : p,
                    ),
                  )
                }
              />
              <button
                className="text-sm text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setFilters((prev) => prev.filter((_, i) => i !== idx))
                }
                aria-label="Remove filter"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setFilters((prev) => [
                  ...prev,
                  { field: "host", op: "eq", value: "" },
                ])
              }
            >
              Add filter
            </Button>
            <Select
              value={String(hours)}
              onValueChange={(v) => setHours(Number(v))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 6, 24, 72, 168, 720].map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    Last {h}h
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => run.mutate()} disabled={run.isPending}>
              {run.isPending ? "Hunting…" : "Run hunt"}
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Input
              placeholder="Save as… (hunt name)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              Save hunt
            </Button>
          </div>
        </div>

        <div className="panel space-y-3 p-5">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
            AI hunt assistant
          </h2>
          <Textarea
            rows={4}
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder="Describe what you suspect, e.g. an attacker using PowerShell to download tools after a successful RDP login."
          />
          <Button
            variant="secondary"
            disabled={!saved?.aiEnabled || hypothesis.trim().length < 5 || suggest.isPending}
            onClick={() => suggest.mutate()}
          >
            {suggest.isPending ? "Thinking…" : "Suggest hunts"}
          </Button>
          {!saved?.aiEnabled && (
            <p className="text-xs text-muted-foreground">
              AI suggestions require an Enterprise AI licence.
            </p>
          )}
          <div className="space-y-2">
            {(suggest.data?.hunts ?? []).map((h, idx) => (
              <div key={idx} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{h.name}</p>
                <p className="text-xs text-muted-foreground">{h.why}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {(h.filters ?? [])
                    .map((f) => `${f.field} ${f.op} "${f.value}"`)
                    .join(" AND ")}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    setFilters(
                      (h.filters ?? []).map((f) => ({
                        field: f.field,
                        op: f.op === "eq" ? "eq" : "contains",
                        value: f.value,
                      })),
                    );
                    setHours(h.hours || 24);
                    setName(h.name);
                  }}
                >
                  Load into builder
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {result && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Matches" value={result.total} />
            <StatCard label="Top host" value={result.aggregations.hosts[0]?.value ?? "—"} />
            <StatCard label="Top user" value={result.aggregations.users[0]?.value ?? "—"} />
            <StatCard label="Top source IP" value={result.aggregations.ips[0]?.value ?? "—"} />
          </div>

          <div className="panel mt-4 overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{r.severity}</td>
                    <td className="px-4 py-2">{r.event_type}</td>
                    <td className="px-4 py-2">{r.host ?? "—"}</td>
                    <td className="px-4 py-2">{r.user ?? "—"}</td>
                    <td className="max-w-[420px] truncate px-4 py-2 font-mono text-xs">
                      {r.raw_message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!result.rows.length && (
              <div className="p-6">
                <EmptyState title="No events matched this hunt" />
              </div>
            )}
          </div>
        </>
      )}

      <div className="panel mt-6 space-y-2 p-5">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
          Saved hunts
        </h2>
        {(saved?.items ?? []).map((h) => (
          <div
            key={h.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
          >
            <div>
              <p className="text-sm">{h.name}</p>
              <p className="text-xs text-muted-foreground">{h.hypothesis}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const q = h.query as {
                    filters?: Filter[];
                    hours?: number;
                  } | null;
                  setFilters(q?.filters ?? []);
                  setHours(q?.hours ?? 24);
                }}
              >
                Load
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(h.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
        {!saved?.items.length && <EmptyState title="No saved hunts yet" />}
      </div>
    </>
  );
}
