// Server-only: log normalization, parsing and ingestion for DirAmn Phase 2.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { audit, getActor, scopeOrg, sha256Hex, type Actor } from "./core.server";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type LogEventInput = {
  timestamp?: string | number | Date | null | undefined;
  source_id?: string | null | undefined;
  source_type?: string | null | undefined;
  source_ip?: string | null | undefined;
  event_type?: string | null | undefined;
  severity?: string | null | undefined;
  raw_message?: string | null | undefined;
  message?: string | null | undefined;
  parsed_fields?: Record<string, unknown> | null | undefined;
  user?: string | null | undefined;
  host?: string | null | undefined;
  category?: string | null | undefined;
  vendor?: string | null | undefined;
  device_type?: string | null | undefined;
  is_demo?: boolean | undefined;
  [key: string]: unknown;
};

export type NormalizedEvent = {
  org_id: string;
  timestamp: string;
  source_id: string | null;
  source_type: string;
  source_ip: string | null;
  event_type: string;
  severity: Severity;
  raw_message: string;
  parsed_fields: Record<string, unknown>;
  user: string | null;
  host: string | null;
  category: string | null;
  vendor: string | null;
  device_type: string | null;
  is_demo: boolean;
};

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

export function normalizeSeverity(value: unknown): Severity {
  if (typeof value === "number") return syslogSeverity(value);
  const v = String(value ?? "").trim().toLowerCase();
  if (SEVERITIES.includes(v as Severity)) return v as Severity;
  if (["emerg", "emergency", "alert", "fatal", "crit"].includes(v)) return "critical";
  if (["err", "error", "severe"].includes(v)) return "high";
  if (["warn", "warning", "notice"].includes(v)) return "medium";
  if (["debug", "trace", "verbose"].includes(v)) return "low";
  if (/^\d+$/.test(v)) return syslogSeverity(Number(v));
  return "info";
}

export function syslogSeverity(code: number): Severity {
  if (code <= 2) return "critical";
  if (code === 3) return "high";
  if (code === 4) return "medium";
  if (code === 5 || code === 6) return "info";
  return "low";
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number")
    return new Date(value > 1e12 ? value : value * 1000).toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

/** Best-effort classification used when a feed does not declare an event type. */
export function classify(message: string): { event_type: string; category: string; severity: Severity } {
  const m = message.toLowerCase();
  const rules: Array<[RegExp, string, string, Severity]> = [
    [/failed password|authentication failure|failed login|logon failure|4625/, "failed_login", "authentication", "medium"],
    [/accepted password|session opened|successful login|logon success|4624/, "successful_login", "authentication", "info"],
    [/brute.?force/, "brute_force", "authentication", "high"],
    [/port ?scan|nmap|syn scan/, "port_scan", "network", "high"],
    [/deny|denied|blocked|drop /, "firewall_block", "network", "medium"],
    [/malware|virus|trojan|ransomware|quarantine/, "malware", "threat", "critical"],
    [/sudo|privilege|elevat|4672|runas/, "privilege_escalation", "authentication", "high"],
    [/account (locked|lockout)|4740/, "account_lockout", "authentication", "high"],
    [/sql injection|xss|traversal|\.\.\/|union select|\/etc\/passwd/, "web_attack", "web", "critical"],
    [/link (down|up)|interface|snmp/, "device_status", "infrastructure", "info"],
  ];
  for (const [re, type, category, severity] of rules) {
    if (re.test(m)) return { event_type: type, category, severity };
  }
  return { event_type: "generic", category: "general", severity: "info" };
}

export function normalizeEvent(
  orgId: string,
  input: LogEventInput,
  defaults: { source_id?: string | null; source_type?: string; vendor?: string | null; device_type?: string | null } = {},
): NormalizedEvent {
  const raw = String(input.raw_message ?? input.message ?? "").slice(0, 8000);
  const guessed = classify(raw);
  const known = new Set([
    "timestamp", "source_id", "source_type", "source_ip", "event_type", "severity",
    "raw_message", "message", "parsed_fields", "user", "host", "category", "vendor",
    "device_type", "is_demo",
  ]);
  const extra: Record<string, unknown> = { ...(input.parsed_fields ?? {}) };
  for (const [k, v] of Object.entries(input)) {
    if (!known.has(k) && v !== undefined) extra[k] = v;
  }
  return {
    org_id: orgId,
    timestamp: toIso(input.timestamp),
    source_id: (input.source_id ?? defaults.source_id) || null,
    source_type: String(input.source_type ?? defaults.source_type ?? "rest"),
    source_ip: (input.source_ip as string) ?? raw.match(IP_RE)?.[0] ?? null,
    event_type: String(input.event_type ?? guessed.event_type),
    severity: input.severity ? normalizeSeverity(input.severity) : guessed.severity,
    raw_message: raw,
    parsed_fields: extra,
    user: (input.user as string) ?? null,
    host: (input.host as string) ?? null,
    category: (input.category as string) ?? guessed.category,
    vendor: (input.vendor as string) ?? defaults.vendor ?? null,
    device_type: (input.device_type as string) ?? defaults.device_type ?? null,
    is_demo: input.is_demo === true,
  };
}

/* --------------------------- syslog parsing --------------------------- */

const RFC5424 = /^<(\d{1,3})>(\d)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(?:\[(.*?)\])?\s*(.*)$/s;
const RFC3164 = /^<(\d{1,3})>([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:\[]+)(?:\[(\d+)\])?:\s*(.*)$/s;

/** Parses one RFC3164 or RFC5424 syslog line into a LogEventInput. */
export function parseSyslog(line: string): LogEventInput {
  const text = line.trim();
  const m5 = RFC5424.exec(text);
  if (m5) {
    const pri = Number(m5[1]);
    return {
      timestamp: m5[3] === "-" ? new Date().toISOString() : m5[3],
      host: m5[4] === "-" ? null : m5[4],
      raw_message: text,
      message: m5[9],
      severity: syslogSeverity(pri % 8),
      parsed_fields: {
        rfc: "5424",
        facility: Math.floor(pri / 8),
        app_name: m5[5],
        proc_id: m5[6],
        msg_id: m5[7],
        structured_data: m5[8] ?? null,
      },
    };
  }
  const m3 = RFC3164.exec(text);
  if (m3) {
    const pri = Number(m3[1]);
    const stamp = new Date(`${m3[2] ?? ""} ${new Date().getUTCFullYear()}`);
    return {
      timestamp: Number.isNaN(stamp.getTime()) ? new Date().toISOString() : stamp.toISOString(),
      host: m3[3],
      raw_message: text,
      message: m3[6],
      severity: syslogSeverity(pri % 8),
      parsed_fields: { rfc: "3164", facility: Math.floor(pri / 8), tag: (m3[4] ?? "").trim(), pid: m3[5] ?? null },
    };
  }
  return { raw_message: text, message: text, parsed_fields: { rfc: "unstructured" } };
}

/* ---------------------------- file parsing ---------------------------- */

const APACHE = /^(\S+) \S+ (\S+) \[([^\]]+)\] "(\S+) (\S+) ([^"]*)" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?/;

export function parseApacheLine(line: string): LogEventInput | null {
  const m = APACHE.exec(line);
  if (!m) return null;
  const status = Number(m[7]);
  return {
    timestamp: new Date((m[3] ?? "").replace(":", " ")).toISOString(),
    source_ip: m[1],
    user: m[2] === "-" ? null : m[2],
    raw_message: line,
    event_type: status >= 400 ? "web_error" : "web_request",
    category: "web",
    severity: status >= 500 ? "high" : status >= 400 ? "medium" : "info",
    parsed_fields: {
      method: m[4], path: m[5], protocol: m[6], status,
      bytes: m[8], referer: m[9] ?? null, user_agent: m[10] ?? null,
    },
  };
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
      } else if (ch === "," && !quoted) { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };
  const headers = split(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

export type FileFormat =
  | "csv" | "json" | "jsonl" | "txt" | "apache" | "nginx" | "syslog" | "windows" | "auto";

export function detectFormat(fileName: string, content: string): FileFormat {
  const name = fileName.toLowerCase();
  const head = content.trimStart().slice(0, 400);
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".jsonl") || name.endsWith(".ndjson")) return "jsonl";
  if (name.endsWith(".json")) return "json";
  if (head.startsWith("[") || head.startsWith("{")) {
    return content.trim().split(/\r?\n/).length > 1 && !head.startsWith("[") ? "jsonl" : "json";
  }
  if (/^<\d{1,3}>/.test(head)) return "syslog";
  if (APACHE.test(head.split(/\r?\n/)[0] ?? "")) return "apache";
  if (/EventID|Event ID|Microsoft-Windows/i.test(head)) return "windows";
  return "txt";
}

/** Turns raw file content into normalized event inputs. */
export function parseFile(content: string, format: FileFormat, fileName = ""): LogEventInput[] {
  const fmt = format === "auto" ? detectFormat(fileName, content) : format;
  const lines = () => content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  switch (fmt) {
    case "json": {
      const data = JSON.parse(content) as unknown;
      const arr = Array.isArray(data) ? data : [data];
      return arr as LogEventInput[];
    }
    case "jsonl":
      return lines().map((l) => JSON.parse(l) as LogEventInput);
    case "csv":
      return parseCsv(content).map((row) => mapRow(row));
    case "apache":
    case "nginx":
      return lines().map((l) => parseApacheLine(l) ?? { raw_message: l, source_type: "web_server" });
    case "syslog":
      return lines().map((l) => ({ ...parseSyslog(l), source_type: "syslog" }));
    case "windows":
      return lines().map((l) => ({
        raw_message: l,
        source_type: "windows",
        vendor: "Microsoft",
        device_type: "server",
        parsed_fields: { event_id: /(\d{4})/.exec(l)?.[1] ?? null },
      }));
    default:
      return lines().map((l) => ({ raw_message: l }));
  }
}

/** Maps loosely named CSV/NMS columns onto the LogEvent schema. */
export function mapRow(row: Record<string, unknown>): LogEventInput {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(row).find((c) => c.toLowerCase().replace(/[^a-z]/g, "") === k);
      if (found && row[found] !== "" && row[found] != null) return row[found];
    }
    return undefined;
  };
  return {
    timestamp: pick("timestamp", "time", "date", "datetime", "eventtime") as string,
    source_ip: pick("sourceip", "srcip", "ip", "clientip", "src") as string,
    event_type: pick("eventtype", "event", "type", "action") as string,
    severity: pick("severity", "level", "priority") as string,
    raw_message: (pick("rawmessage", "message", "msg", "description", "detail") as string) ??
      JSON.stringify(row),
    user: pick("user", "username", "account", "accountname") as string,
    host: pick("host", "hostname", "device", "computer", "node") as string,
    category: pick("category", "class") as string,
    vendor: pick("vendor", "manufacturer") as string,
    device_type: pick("devicetype", "producttype") as string,
    parsed_fields: row as Record<string, unknown>,
  };
}

/* ------------------------------ ingestion ----------------------------- */

export type IngestResult = {
  accepted: number;
  rejected: number;
  errors: string[];
  alerts: number;
};

export async function retentionDaysFor(orgId: string): Promise<number> {
  const { data: license } = await supabaseAdmin
    .from("licenses")
    .select("retention_days, status")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("retention_days")
    .eq("id", orgId)
    .maybeSingle();
  const licensed = license?.retention_days ?? org?.retention_days ?? 30;
  const configured = org?.retention_days ?? licensed;
  // Never allow retention above the licensed limit.
  return Math.min(configured, licensed);
}

async function licenseEpsLimit(orgId: string): Promise<number> {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("eps_limit")
    .eq("id", orgId)
    .maybeSingle();
  return org?.eps_limit ?? 500;
}

/** Persists normalized events, refreshes source stats and runs correlation. */
export async function storeEvents(
  orgId: string,
  events: NormalizedEvent[],
  opts: { sourceId?: string | null; runCorrelation?: boolean } = {},
): Promise<IngestResult> {
  if (events.length === 0) return { accepted: 0, rejected: 0, errors: [], alerts: 0 };

  const errors: string[] = [];
  let accepted = 0;
  for (let i = 0; i < events.length; i += 500) {
    const chunk = events.slice(i, i + 500);
    const { error } = await supabaseAdmin.from("log_events").insert(chunk as never);
    if (error) errors.push(error.message);
    else accepted += chunk.length;
  }

  const sourceId = opts.sourceId ?? events[0]?.source_id ?? null;
  if (sourceId) await refreshSourceStats(orgId, sourceId);

  let alerts = 0;
  if (opts.runCorrelation !== false) {
    const { runCorrelation } = await import("./correlation.server");
    alerts = (await runCorrelation(orgId)).created;
  }

  return { accepted, rejected: events.length - accepted, errors, alerts };
}

export async function refreshSourceStats(orgId: string, sourceId: string) {
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count: total } = await supabaseAdmin
    .from("log_events")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("source_id", sourceId);
  const { count: recent } = await supabaseAdmin
    .from("log_events")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("source_id", sourceId)
    .gte("received_at", since);
  const { data: last } = await supabaseAdmin
    .from("log_events")
    .select("timestamp")
    .eq("org_id", orgId)
    .eq("source_id", sourceId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  const eps = Number((((recent ?? 0) / 300)).toFixed(3));
  const limit = await licenseEpsLimit(orgId);
  const health = (recent ?? 0) === 0 ? "idle" : eps > limit ? "over_limit" : "healthy";

  await supabaseAdmin.from("source_stats").upsert(
    {
      source_id: sourceId,
      org_id: orgId,
      event_count: total ?? 0,
      eps,
      last_event_at: last?.timestamp ?? null,
      health,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "source_id" },
  );
}

/** Authenticates a source API key and returns its owning tenant. */
export async function resolveSourceByApiKey(apiKey: string) {
  const hash = await sha256Hex(apiKey);
  const { data } = await supabaseAdmin
    .from("sources")
    .select("id, org_id, name, status, source_type, vendor, device_type")
    .eq("api_key_hash", hash)
    .maybeSingle();
  if (!data) throw new Error("Invalid source API key");
  if (data.status !== "enabled") throw new Error("Source is disabled");
  return data;
}

/* --------------------------- console helpers -------------------------- */

export async function tenantOf(userId: string): Promise<{ actor: Actor; orgId: string }> {
  const actor = await getActor(userId);
  return { actor, orgId: scopeOrg(actor, null) };
}

export async function purgeExpiredEvents(orgId: string) {
  const days = await retentionDaysFor(orgId);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { count } = await supabaseAdmin
    .from("log_events")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .lt("timestamp", cutoff);
  await supabaseAdmin.from("log_events").delete().eq("org_id", orgId).lt("timestamp", cutoff);
  await audit({
    orgId,
    action: "retention.purge",
    details: { retention_days: days, removed: count ?? 0 },
  });
  return { retentionDays: days, removed: count ?? 0 };
}