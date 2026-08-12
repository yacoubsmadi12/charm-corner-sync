import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Field, PageHeader, StatusPill } from "@/components/siem/ui-bits";
import {
  deleteSavedSearchFn,
  exportSearchFn,
  listSavedSearchesFn,
  saveSearchFn,
  searchEventsFn,
} from "@/lib/siem/siem.functions";

export const Route = createFileRoute("/console/search")({
  head: () => ({
    meta: [
      { title: "Log Search — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Search normalized security logs with field filters, boolean operators, time ranges, saved searches and CSV export.",
      },
      { property: "og:title", content: "Log Search — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Query normalized security events with filters and saved searches.",
      },
    ],
  }),
  component: SearchPage,
});

const RANGES: { label: string; minutes: number | null }[] = [
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "24h", minutes: 1440 },
  { label: "7d", minutes: 10080 },
  { label: "30d", minutes: 43200 },
  { label: "All", minutes: null },
];

type Filters = {
  query: string;
  severity: string;
  event_type: string;
  source_ip: string;
  user: string;
  host: string;
};

const EMPTY: Filters = { query: "", severity: "", event_type: "", source_ip: "", user: "", host: "" };

function download(name: string, content: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function SearchPage() {
  const qc = useQueryClient();
  const runSearch = useServerFn(searchEventsFn);
  const runExport = useServerFn(exportSearchFn);
  const saveFn = useServerFn(saveSearchFn);
  const removeFn = useServerFn(deleteSavedSearchFn);
  const savedFn = useServerFn(listSavedSearchesFn);

  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [range, setRange] = useState<number | null>(1440);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const payload = () => ({
    query: filters.query,
    severity: filters.severity || null,
    event_type: filters.event_type || null,
    source_ip: filters.source_ip || null,
    user: filters.user || null,
    host: filters.host || null,
    from: range ? new Date(Date.now() - range * 60_000).toISOString() : null,
    page,
    pageSize: 50,
  });

  const { data, isFetching } = useQuery({
    queryKey: ["siem-search", filters, range, page],
    queryFn: () => runSearch({ data: payload() }),
  });

  const { data: saved } = useQuery({ queryKey: ["saved-searches"], queryFn: () => savedFn({}) });

  const save = useMutation({
    mutationFn: (name: string) =>
      saveFn({
        data: {
          name,
          query: filters.query,
          filters: { ...filters },
          timeRange: range ? `${range}m` : "all",
        },
      }),
    onSuccess: () => {
      toast.success("Search saved");
      void qc.invalidateQueries({ queryKey: ["saved-searches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = useMutation({
    mutationFn: () => runExport({ data: payload() }),
    onSuccess: (r) => {
      download(`diramn-search-${Date.now()}.csv`, r.csv);
      toast.success(`Exported ${r.rows} events`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <>
      <PageHeader
        title="Log Search"
        description="Query normalized events. Supports field:value syntax, quoted phrases, AND / OR / NOT."
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending}>
              Export CSV
            </Button>
            <Button
              onClick={() => {
                const name = window.prompt("Save this search as:");
                if (name) save.mutate(name);
              }}
            >
              Save search
            </Button>
          </>
        }
      />

      <div className="panel space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <Input
            value={filters.query}
            placeholder='e.g. event_type:failed_login AND "invalid user" NOT host:test01'
            onChange={(e) => { setPage(1); setFilters({ ...filters, query: e.target.value }); }}
            className="min-w-[280px] flex-1 font-mono text-xs"
          />
          {RANGES.map((r) => (
            <Button
              key={r.label}
              size="sm"
              variant={range === r.minutes ? "default" : "outline"}
              onClick={() => { setPage(1); setRange(r.minutes); }}
            >
              {r.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(["severity", "event_type", "source_ip", "user", "host"] as const).map((key) => (
            <Field key={key} label={key.replace("_", " ")}>
              <Input
                value={filters[key]}
                onChange={(e) => { setPage(1); setFilters({ ...filters, [key]: e.target.value }); }}
                placeholder="any"
              />
            </Field>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{isFetching ? "Searching…" : `${total} matching events`}</span>
          <Button size="sm" variant="ghost" onClick={() => { setFilters(EMPTY); setPage(1); }}>
            Reset filters
          </Button>
        </div>
      </div>

      {saved && saved.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {saved.map((s) => (
            <span key={s.id} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">
              <button
                className="text-primary"
                onClick={() => {
                  const f = (s.filters ?? {}) as Partial<Filters>;
                  setFilters({ ...EMPTY, ...f, query: s.query ?? "" });
                  setPage(1);
                }}
              >
                {s.name}
              </button>
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  await removeFn({ data: { id: s.id } });
                  void qc.invalidateQueries({ queryKey: ["saved-searches"] });
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="panel mt-4 overflow-x-auto">
        {(data?.rows ?? []).length === 0 ? (
          <EmptyState title="No events match this query" hint="Widen the time range or clear filters." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Source IP</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Host</th>
                <th className="px-4 py-3">Message</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((row) => (
                <>
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-border/50 hover:bg-muted/40"
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  >
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2"><StatusPill status={row.severity} tone={sevTone(row.severity)} /></td>
                    <td className="px-4 py-2 font-mono text-xs">{row.event_type}</td>
                    <td className="px-4 py-2 font-mono text-xs">{row.source_ip ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{row.user ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{row.host ?? "—"}</td>
                    <td className="max-w-md truncate px-4 py-2 text-xs text-muted-foreground">{row.raw_message}</td>
                  </tr>
                  {expanded === row.id && (
                    <tr key={`${row.id}-detail`} className="border-b border-border/50 bg-muted/20">
                      <td colSpan={7} className="px-4 py-3">
                        <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
                          {JSON.stringify(row, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
    </>
  );
}

export function sevTone(sev: string): "ok" | "warn" | "bad" | "muted" {
  if (sev === "critical" || sev === "high") return "bad";
  if (sev === "medium") return "warn";
  if (sev === "low") return "muted";
  return "ok";
}
