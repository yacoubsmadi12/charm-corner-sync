// Server-only: SIEM search, dashboard, incidents, reporting and compliance.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { audit, getActor, scopeOrg, type Actor } from "./core.server";
import { ensureBuiltinRules, queueEmail, runCorrelation } from "./correlation.server";
import {
  normalizeEvent,
  parseFile,
  purgeExpiredEvents,
  refreshSourceStats,
  retentionDaysFor,
  storeEvents,
  type FileFormat,
  type LogEventInput,
} from "./events.server";
import { generateEvents } from "./generator.server";

async function tenant(userId: string, orgId?: string | null): Promise<{ actor: Actor; org: string }> {
  const actor = await getActor(userId);
  return { actor, org: scopeOrg(actor, orgId ?? null) };
}

function requirePermission(actor: Actor, ok: boolean, message: string) {
  if (!ok && !actor.isSuperAdmin) throw new Error(message);
}

/* -------------------------------- search ------------------------------- */

export type SearchFilters = {
  query?: string | undefined;
  from?: string | null | undefined;
  to?: string | null | undefined;
  event_type?: string | null | undefined;
  severity?: string | null | undefined;
  source_id?: string | null | undefined;
  source_ip?: string | null | undefined;
  user?: string | null | undefined;
  host?: string | null | undefined;
  vendor?: string | null | undefined;
  device_type?: string | null | undefined;
  category?: string | null | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
};

type Term = { field: string | null; value: string; negate: boolean };

/** Parses `field:value`, quoted phrases, AND / OR / NOT into terms. */
export function parseQuery(query: string): { and: Term[]; or: Term[] } {
  const and: Term[] = [];
  const or: Term[] = [];
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  let mode: "and" | "or" = "and";
  let negateNext = false;
  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) continue;
    const upper = token.toUpperCase();
    if (upper === "AND") { mode = "and"; continue; }
    if (upper === "OR") { mode = "or"; continue; }
    if (upper === "NOT" || token === "-") { negateNext = true; continue; }
    let negate = negateNext;
    negateNext = false;
    let body = token;
    if (body.startsWith("-")) { negate = true; body = body.slice(1); }
    const idx = body.indexOf(":");
    let field: string | null = null;
    let value = body;
    if (idx > 0) {
      field = body.slice(0, idx).toLowerCase();
      value = body.slice(idx + 1);
    }
    value = value.replace(/^"|"$/g, "");
    if (!value) continue;
    (mode === "or" ? or : and).push({ field, value, negate });
    mode = "and";
  }
  return { and, or };
}

const SEARCHABLE = new Set([
  "event_type", "severity", "source_ip", "user", "host", "vendor",
  "device_type", "category", "source_type",
]);

export async function searchEvents(userId: string, filters: SearchFilters) {
  const { org } = await tenant(userId);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? 50));

  let q = supabaseAdmin
    .from("log_events")
    .select("*", { count: "exact" })
    .eq("org_id", org);

  if (filters.from) q = q.gte("timestamp", filters.from);
  if (filters.to) q = q.lte("timestamp", filters.to);
  for (const key of ["event_type", "severity", "source_id", "source_ip", "user", "host", "vendor", "device_type", "category"] as const) {
    const value = filters[key];
    if (value) q = q.eq(key, value);
  }

  const { and, or } = parseQuery(filters.query ?? "");
  for (const term of and) {
    if (term.field && SEARCHABLE.has(term.field)) {
      q = term.negate ? q.neq(term.field, term.value) : q.eq(term.field, term.value);
    } else if (term.field === "message" || term.field === null) {
      q = term.negate
        ? q.not("raw_message", "ilike", `%${term.value}%`)
        : q.ilike("raw_message", `%${term.value}%`);
    } else {
      q = q.contains("parsed_fields", { [term.field]: term.value } as never);
    }
  }
  if (or.length > 0) {
    const clause = or
      .map((t) =>
        t.field && SEARCHABLE.has(t.field)
          ? `${t.field}.eq.${t.value}`
          : `raw_message.ilike.%${t.value}%`,
      )
      .join(",");
    q = q.or(clause);
  }

  const { data, count, error } = await q
    .order("timestamp", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function exportSearch(userId: string, filters: SearchFilters) {
  const { actor, org } = await tenant(userId);
  const result = await searchEvents(userId, { ...filters, page: 1, pageSize: 200 });
  await audit({
    orgId: org,
    actorId: actor.id,
    actorName: actor.username,
    action: "search.export",
    details: { filters: filters as unknown as Record<string, unknown>, rows: result.rows.length },
  });
  const cols = ["timestamp", "severity", "event_type", "source_ip", "user", "host", "vendor", "device_type", "category", "raw_message"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    cols.join(","),
    ...result.rows.map((r) => cols.map((c) => escape((r as Record<string, unknown>)[c])).join(",")),
  ].join("\n");
  return { csv, rows: result.rows.length };
}

export async function listSavedSearches(userId: string) {
  const { org } = await tenant(userId);
  const { data } = await supabaseAdmin
    .from("saved_searches")
    .select("*")
    .eq("org_id", org)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function saveSearch(
  userId: string,
  input: { name: string; query: string; filters: Record<string, unknown>; timeRange: string },
) {
  const { actor, org } = await tenant(userId);
  const { error } = await supabaseAdmin.from("saved_searches").insert({
    org_id: org,
    owner_id: actor.id,
    name: input.name,
    query: input.query,
    filters: input.filters as never,
    time_range: input.timeRange,
  } as never);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteSavedSearch(userId: string, id: string) {
  const { org } = await tenant(userId);
  await supabaseAdmin.from("saved_searches").delete().eq("id", id).eq("org_id", org);
  return { ok: true };
}

/* ------------------------------ dashboard ------------------------------ */

function bucketKey(iso: string, bucketMinutes: number) {
  const t = new Date(iso).getTime();
  return new Date(Math.floor(t / (bucketMinutes * 60_000)) * bucketMinutes * 60_000).toISOString();
}

function topOf(rows: Record<string, unknown>[], field: string, limit = 8) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r[field];
    if (v == null || v === "") continue;
    counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function dashboard(userId: string, hours = 24) {
  const { org } = await tenant(userId);
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const [{ count: totalEvents }, { data: recent }, { count: activeAlerts }, { count: openIncidents }, { data: sources }] =
    await Promise.all([
      supabaseAdmin.from("log_events").select("id", { count: "exact", head: true }).eq("org_id", org),
      supabaseAdmin
        .from("log_events")
        .select("timestamp, severity, event_type, user, host, source_ip, vendor, device_type, source_id")
        .eq("org_id", org)
        .gte("timestamp", since)
        .order("timestamp", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org)
        .in("status", ["new", "acknowledged", "in_progress"]),
      supabaseAdmin
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org)
        .in("status", ["new", "investigating", "contained"]),
      supabaseAdmin.from("sources").select("id, name").eq("org_id", org),
    ]);

  const rows = (recent ?? []) as unknown as Record<string, unknown>[];
  const sourceNames = new Map((sources ?? []).map((s) => [s.id, s.name]));
  const bucketMinutes = hours <= 6 ? 5 : hours <= 24 ? 30 : 180;
  const series = new Map<string, number>();
  for (const r of rows) {
    const key = bucketKey(String(r["timestamp"]), bucketMinutes);
    series.set(key, (series.get(key) ?? 0) + 1);
  }
  const eventsOverTime = [...series.entries()]
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => a.time.localeCompare(b.time));

  const lastMinute = rows.filter(
    (r) => new Date(String(r["timestamp"])).getTime() > Date.now() - 60_000,
  ).length;

  return {
    totalEvents: totalEvents ?? 0,
    windowEvents: rows.length,
    eps: Number((lastMinute / 60).toFixed(2)),
    activeAlerts: activeAlerts ?? 0,
    openIncidents: openIncidents ?? 0,
    eventsOverTime,
    topSources: topOf(rows, "source_id").map((s) => ({
      name: sourceNames.get(s.name) ?? "Direct / unassigned",
      value: s.value,
    })),
    topEventTypes: topOf(rows, "event_type"),
    topUsers: topOf(rows, "user"),
    topHosts: topOf(rows, "host"),
    topIps: topOf(rows, "source_ip"),
    severity: topOf(rows, "severity", 5),
    vendors: topOf(rows, "vendor"),
    deviceTypes: topOf(rows, "device_type"),
    retentionDays: await retentionDaysFor(org),
  };
}

/* ------------------------------ ingestion ------------------------------ */

export async function ingestFromConsole(
  userId: string,
  input: { events: LogEventInput[]; sourceId?: string | null },
) {
  const { actor, org } = await tenant(userId);
  await ensureBuiltinRules(org);
  const normalized = input.events.map((e) =>
    normalizeEvent(org, e, { source_id: input.sourceId ?? null, source_type: "manual" }),
  );
  const result = await storeEvents(org, normalized, { sourceId: input.sourceId ?? null });
  await audit({
    orgId: org,
    actorId: actor.id,
    actorName: actor.username,
    action: "events.ingest",
    details: { accepted: result.accepted, alerts: result.alerts, channel: "console" },
  });
  return result;
}

export async function importFile(
  userId: string,
  input: { fileName: string; format: FileFormat; content: string; sourceId?: string | null },
) {
  const { actor, org } = await tenant(userId);
  await ensureBuiltinRules(org);

  const { data: job } = await supabaseAdmin
    .from("ingestion_jobs")
    .insert({
      org_id: org,
      source_id: input.sourceId ?? null,
      file_name: input.fileName,
      format: input.format,
      status: "running",
      created_by: actor.id,
    } as never)
    .select("id")
    .single();

  try {
    const parsed = parseFile(input.content, input.format, input.fileName);
    const normalized = parsed.map((e) =>
      normalizeEvent(org, e, { source_id: input.sourceId ?? null, source_type: "file" }),
    );
    const result = await storeEvents(org, normalized, { sourceId: input.sourceId ?? null });
    if (job)
      await supabaseAdmin
        .from("ingestion_jobs")
        .update({
          status: result.errors.length > 0 ? "failed" : "completed",
          total_rows: parsed.length,
          imported_rows: result.accepted,
          failed_rows: result.rejected,
          message: result.errors.join("; ").slice(0, 500),
          finished_at: new Date().toISOString(),
        } as never)
        .eq("id", job.id);
    await audit({
      orgId: org,
      actorId: actor.id,
      actorName: actor.username,
      action: "events.file_import",
      target: input.fileName,
      details: { rows: parsed.length, imported: result.accepted },
    });
    return { ...result, total: parsed.length, jobId: job?.id ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "import failed";
    if (job)
      await supabaseAdmin
        .from("ingestion_jobs")
        .update({ status: "failed", message, finished_at: new Date().toISOString() } as never)
        .eq("id", job.id);
    throw new Error(message);
  }
}

export async function previewFile(input: { fileName: string; format: FileFormat; content: string }) {
  const parsed = parseFile(input.content, input.format, input.fileName);
  const sample = parsed
    .slice(0, 10)
    .map((e) => normalizeEvent("00000000-0000-0000-0000-000000000000", e));
  return {
    total: parsed.length,
    sample: JSON.parse(JSON.stringify(sample)) as Record<string, string | number | boolean | null>[],
  };
}

export async function generateSampleData(userId: string, count: number, attack: boolean) {
  const { actor, org } = await tenant(userId);
  await ensureBuiltinRules(org);
  const events = generateEvents(count, { attack });
  const normalized = events.map((e) => normalizeEvent(org, e, { source_type: "generator" }));
  const result = await storeEvents(org, normalized);
  await audit({
    orgId: org,
    actorId: actor.id,
    actorName: actor.username,
    action: "events.generate_sample",
    details: { count: normalized.length, alerts: result.alerts },
  });
  return result;
}

export async function listIngestionJobs(userId: string) {
  const { org } = await tenant(userId);
  const { data } = await supabaseAdmin
    .from("ingestion_jobs")
    .select("*")
    .eq("org_id", org)
    .order("created_at", { ascending: false })
    .limit(25);
  return data ?? [];
}

export async function sourceHealth(userId: string) {
  const { org } = await tenant(userId);
  const { data: sources } = await supabaseAdmin
    .from("sources")
    .select("id, name, source_type, status, vendor, device_type, api_key_prefix")
    .eq("org_id", org)
    .order("name");
  for (const s of sources ?? []) await refreshSourceStats(org, s.id);
  const { data: stats } = await supabaseAdmin.from("source_stats").select("*").eq("org_id", org);
  const byId = new Map((stats ?? []).map((s) => [s.source_id, s]));
  return (sources ?? []).map((s) => ({ ...s, stats: byId.get(s.id) ?? null }));
}

/* ------------------------------- rules --------------------------------- */

export async function listRules(userId: string) {
  const { org } = await tenant(userId);
  await ensureBuiltinRules(org);
  const { data } = await supabaseAdmin
    .from("correlation_rules")
    .select("*")
    .eq("org_id", org)
    .order("is_builtin", { ascending: false })
    .order("name");
  return data ?? [];
}

export async function saveRule(
  userId: string,
  input: {
    id?: string | null | undefined;
    name: string;
    description: string;
    ruleType: "threshold" | "sequence" | "pattern" | "anomaly" | "correlation";
    severity: "critical" | "high" | "medium" | "low" | "info";
    threshold: number;
    windowMinutes: number;
    groupBy: string;
    enabled: boolean;
    conditions: Record<string, unknown>;
  },
) {
  const { actor, org } = await tenant(userId);
  requirePermission(actor, actor.isOrgAdmin, "Forbidden: administrator access required");
  const payload = {
    org_id: org,
    name: input.name,
    description: input.description,
    rule_type: input.ruleType,
    severity: input.severity,
    threshold: input.threshold,
    window_minutes: input.windowMinutes,
    group_by: input.groupBy,
    enabled: input.enabled,
    conditions: input.conditions as never,
  };
  if (input.id) {
    const { error } = await supabaseAdmin
      .from("correlation_rules")
      .update(payload as never)
      .eq("id", input.id)
      .eq("org_id", org);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from("correlation_rules").insert(payload as never);
    if (error) throw new Error(error.message);
  }
  await audit({
    orgId: org,
    actorId: actor.id,
    actorName: actor.username,
    action: input.id ? "rule.updated" : "rule.created",
    target: input.name,
  });
  return { ok: true };
}

export async function setRuleEnabled(userId: string, id: string, enabled: boolean) {
  const { actor, org } = await tenant(userId);
  requirePermission(actor, actor.isOrgAdmin, "Forbidden: administrator access required");
  await supabaseAdmin
    .from("correlation_rules")
    .update({ enabled } as never)
    .eq("id", id)
    .eq("org_id", org);
  await audit({ orgId: org, actorId: actor.id, actorName: actor.username, action: "rule.toggled", target: id, details: { enabled } });
  return { ok: true };
}

export async function deleteRule(userId: string, id: string) {
  const { actor, org } = await tenant(userId);
  requirePermission(actor, actor.isOrgAdmin, "Forbidden: administrator access required");
  await supabaseAdmin.from("correlation_rules").delete().eq("id", id).eq("org_id", org).eq("is_builtin", false);
  await audit({ orgId: org, actorId: actor.id, actorName: actor.username, action: "rule.deleted", target: id });
  return { ok: true };
}

export async function evaluateRulesNow(userId: string) {
  const { org } = await tenant(userId);
  await ensureBuiltinRules(org);
  return runCorrelation(org);
}

/* ------------------------------- alerts -------------------------------- */

export async function listAlerts(userId: string, status?: string | null) {
  const { org } = await tenant(userId);
  let q = supabaseAdmin.from("alerts").select("*").eq("org_id", org);
  if (status && status !== "all") q = q.eq("status", status as never);
  const { data } = await q.order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}

export async function updateAlert(
  userId: string,
  input: { id: string; status?: string | null | undefined; assignedTo?: string | null | undefined },
) {
  const { actor, org } = await tenant(userId);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status) patch["status"] = input.status;
  if (input.assignedTo !== undefined) patch["assigned_to"] = input.assignedTo;
  const { error } = await supabaseAdmin.from("alerts").update(patch as never).eq("id", input.id).eq("org_id", org);
  if (error) throw new Error(error.message);
  await audit({
    orgId: org, actorId: actor.id, actorName: actor.username,
    action: "alert.updated", target: input.id, details: patch,
  });
  return { ok: true };
}

export async function alertEvents(userId: string, alertId: string) {
  const { org } = await tenant(userId);
  const { data: alert } = await supabaseAdmin
    .from("alerts")
    .select("event_ids")
    .eq("id", alertId)
    .eq("org_id", org)
    .maybeSingle();
  const ids = (alert?.event_ids ?? []) as string[];
  if (ids.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("log_events")
    .select("*")
    .eq("org_id", org)
    .in("id", ids.slice(0, 100))
    .order("timestamp", { ascending: false });
  return data ?? [];
}

/* ------------------------------ incidents ------------------------------ */

export async function listIncidents(userId: string) {
  const { org } = await tenant(userId);
  const { data } = await supabaseAdmin
    .from("incidents")
    .select("*")
    .eq("org_id", org)
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function createIncident(
  userId: string,
  input: {
    title: string;
    description: string;
    severity: string;
    alertId?: string | null | undefined;
  },
) {
  const { actor, org } = await tenant(userId);
  const reference = `INC-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
  const { data: incident, error } = await supabaseAdmin
    .from("incidents")
    .insert({
      org_id: org,
      reference,
      title: input.title,
      description: input.description,
      severity: input.severity,
      created_by: actor.id,
    } as never)
    .select("id, reference")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("incident_timeline").insert({
    incident_id: incident.id,
    org_id: org,
    actor_name: actor.username,
    action: "Incident created",
    details: { severity: input.severity } as never,
  } as never);

  if (input.alertId) {
    await supabaseAdmin
      .from("alerts")
      .update({ incident_id: incident.id, status: "in_progress" } as never)
      .eq("id", input.alertId)
      .eq("org_id", org);
    await supabaseAdmin.from("incident_timeline").insert({
      incident_id: incident.id,
      org_id: org,
      actor_name: actor.username,
      action: "Alert linked",
      details: { alert_id: input.alertId } as never,
    } as never);
  }

  await audit({
    orgId: org, actorId: actor.id, actorName: actor.username,
    action: "incident.created", target: incident.reference,
  });
  await notifyIncident(org, incident.reference, input.title, input.severity);
  return incident;
}

async function notifyIncident(orgId: string, reference: string, title: string, severity: string) {
  const { data: smtp } = await supabaseAdmin
    .from("smtp_settings")
    .select("enabled, alert_recipients")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!smtp?.enabled || !smtp.alert_recipients) return;
  await queueEmail(orgId, {
    recipients: smtp.alert_recipients,
    subject: `[DirAmn] Incident ${reference} opened (${severity})`,
    body: `Incident ${reference}: ${title}\nSeverity: ${severity}\nOpened: ${new Date().toISOString()}`,
    category: "incident",
  });
}

export async function incidentDetail(userId: string, incidentId: string) {
  const { org } = await tenant(userId);
  const [{ data: incident }, { data: notes }, { data: timeline }, { data: alerts }] = await Promise.all([
    supabaseAdmin.from("incidents").select("*").eq("id", incidentId).eq("org_id", org).maybeSingle(),
    supabaseAdmin.from("incident_notes").select("*").eq("incident_id", incidentId).order("created_at"),
    supabaseAdmin.from("incident_timeline").select("*").eq("incident_id", incidentId).order("created_at"),
    supabaseAdmin.from("alerts").select("*").eq("incident_id", incidentId),
  ]);
  if (!incident) throw new Error("Incident not found");
  const eventIds = (alerts ?? []).flatMap((a) => ((a.event_ids ?? []) as string[]).slice(0, 20));
  const { data: events } = eventIds.length
    ? await supabaseAdmin.from("log_events").select("*").eq("org_id", org).in("id", eventIds).limit(100)
    : { data: [] };
  return { incident, notes: notes ?? [], timeline: timeline ?? [], alerts: alerts ?? [], events: events ?? [] };
}

export async function updateIncident(
  userId: string,
  input: {
    id: string;
    status?: string | null | undefined;
    assignedTo?: string | null | undefined;
    severity?: string | null | undefined;
  },
) {
  const { actor, org } = await tenant(userId);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status) {
    patch["status"] = input.status;
    if (input.status === "closed" || input.status === "resolved")
      patch["closed_at"] = new Date().toISOString();
  }
  if (input.severity) patch["severity"] = input.severity;
  if (input.assignedTo !== undefined) patch["assigned_to"] = input.assignedTo;
  const { error } = await supabaseAdmin.from("incidents").update(patch as never).eq("id", input.id).eq("org_id", org);
  if (error) throw new Error(error.message);
  await supabaseAdmin.from("incident_timeline").insert({
    incident_id: input.id,
    org_id: org,
    actor_name: actor.username,
    action: input.status ? `Status changed to ${input.status}` : "Incident updated",
    details: patch as never,
  } as never);
  await audit({
    orgId: org, actorId: actor.id, actorName: actor.username,
    action: "incident.updated", target: input.id, details: patch,
  });
  return { ok: true };
}

export async function addIncidentNote(userId: string, incidentId: string, body: string) {
  const { actor, org } = await tenant(userId);
  await supabaseAdmin.from("incident_notes").insert({
    incident_id: incidentId,
    org_id: org,
    author_id: actor.id,
    author_name: actor.username,
    body,
  } as never);
  await supabaseAdmin.from("incident_timeline").insert({
    incident_id: incidentId,
    org_id: org,
    actor_name: actor.username,
    action: "Note added",
    details: {} as never,
  } as never);
  await audit({ orgId: org, actorId: actor.id, actorName: actor.username, action: "incident.note_added", target: incidentId });
  return { ok: true };
}

/* ------------------------------ retention ------------------------------ */

export async function runRetention(userId: string) {
  const { actor, org } = await tenant(userId);
  requirePermission(actor, actor.isOrgAdmin, "Forbidden: administrator access required");
  return purgeExpiredEvents(org);
}

/* --------------------------- email / SMTP ------------------------------ */

export async function getSmtpSettings(userId: string) {
  const { org } = await tenant(userId);
  const { data } = await supabaseAdmin.from("smtp_settings").select("*").eq("org_id", org).maybeSingle();
  if (data) return data;
  const { data: created } = await supabaseAdmin
    .from("smtp_settings")
    .insert({ org_id: org } as never)
    .select("*")
    .single();
  return created;
}

export async function saveSmtpSettings(userId: string, input: Record<string, unknown>) {
  const { actor, org } = await tenant(userId);
  requirePermission(actor, actor.isOrgAdmin, "Forbidden: administrator access required");
  const { error } = await supabaseAdmin
    .from("smtp_settings")
    .upsert({ ...input, org_id: org, updated_at: new Date().toISOString() } as never, { onConflict: "org_id" });
  if (error) throw new Error(error.message);
  await audit({ orgId: org, actorId: actor.id, actorName: actor.username, action: "smtp.updated" });
  return { ok: true };
}

export async function sendTestEmail(userId: string) {
  const { actor, org } = await tenant(userId);
  const settings = await getSmtpSettings(userId);
  const id = await queueEmail(org, {
    recipients: settings?.alert_recipients || actor.email,
    subject: "[DirAmn] SMTP test message",
    body: "This is a test message from DirAmn SIEM. If you received it, email delivery is working.",
    category: "test",
  });
  const { data } = await supabaseAdmin.from("email_outbox").select("status, error").eq("id", id ?? "").maybeSingle();
  return { id, status: data?.status ?? "queued", error: data?.error ?? null };
}

export async function listOutbox(userId: string) {
  const { org } = await tenant(userId);
  const { data } = await supabaseAdmin
    .from("email_outbox")
    .select("*")
    .eq("org_id", org)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/* ------------------------- reporting / compliance ---------------------- */

export type ReportType =
  | "security_events" | "alerts" | "incidents" | "source_usage" | "eps"
  | "authentication" | "pci_dss" | "iso_27001" | "soc2";

export async function buildReport(
  userId: string,
  input: { type: ReportType; days: number; format: "pdf" | "csv" },
) {
  const { actor, org } = await tenant(userId);
  const since = new Date(Date.now() - input.days * 86_400_000).toISOString();

  const [{ data: events }, { data: alerts }, { data: incidents }, { data: sources }, { data: users }] =
    await Promise.all([
      supabaseAdmin
        .from("log_events")
        .select("timestamp, severity, event_type, user, host, source_ip, source_id, category")
        .eq("org_id", org)
        .gte("timestamp", since)
        .limit(5000),
      supabaseAdmin.from("alerts").select("*").eq("org_id", org).gte("created_at", since),
      supabaseAdmin.from("incidents").select("*").eq("org_id", org).gte("created_at", since),
      supabaseAdmin.from("sources").select("id, name, source_type, status").eq("org_id", org),
      supabaseAdmin.from("profiles").select("username, last_login_at, status").eq("org_id", org),
    ]);

  const rows = (events ?? []) as unknown as Record<string, unknown>[];
  const retention = await retentionDaysFor(org);
  const sourceNames = new Map((sources ?? []).map((s) => [s.id, s.name]));

  const summary: Record<string, unknown> = {
    period_days: input.days,
    generated_at: new Date().toISOString(),
    total_events: rows.length,
    average_eps: Number((rows.length / (input.days * 86400)).toFixed(4)),
    alerts: (alerts ?? []).length,
    incidents: (incidents ?? []).length,
    retention_days: retention,
    severity_breakdown: topOf(rows, "severity", 5),
    top_event_types: topOf(rows, "event_type"),
    source_usage: topOf(rows, "source_id").map((s) => ({
      name: sourceNames.get(s.name) ?? "unassigned",
      value: s.value,
    })),
    authentication_activity: topOf(
      rows.filter((r) => String(r["category"]) === "authentication"),
      "user",
    ),
    log_coverage: {
      configured_sources: (sources ?? []).length,
      reporting_sources: new Set(rows.map((r) => r["source_id"]).filter(Boolean)).size,
    },
    user_activity: (users ?? []).map((u) => ({
      username: u.username,
      status: u.status,
      last_login_at: u.last_login_at,
    })),
  };

  if (input.type === "pci_dss" || input.type === "iso_27001" || input.type === "soc2") {
    summary["framework"] = input.type.toUpperCase().replace("_", "-");
    summary["controls"] = complianceControls(input.type, {
      retention,
      events: rows.length,
      alerts: (alerts ?? []).length,
      incidents: (incidents ?? []).length,
      sources: (sources ?? []).length,
    });
  }

  const { data: report } = await supabaseAdmin
    .from("reports")
    .insert({
      org_id: org,
      name: reportTitle(input.type),
      report_type: input.type,
      format: input.format,
      params: { days: input.days } as never,
      generated_by: actor.id,
      summary: summary as never,
    } as never)
    .select("id")
    .single();

  await audit({
    orgId: org, actorId: actor.id, actorName: actor.username,
    action: "report.generated", target: input.type, details: { format: input.format, days: input.days },
  });

  const csv = toReportCsv(input.type, summary, rows, alerts ?? [], incidents ?? []);
  return {
    id: report?.id ?? null,
    title: reportTitle(input.type),
    summary: JSON.parse(JSON.stringify(summary)) as Record<string, never>,
    csv,
  };
}

export function reportTitle(type: string) {
  const map: Record<string, string> = {
    security_events: "Security Events Report",
    alerts: "Alerts Report",
    incidents: "Incidents Report",
    source_usage: "Source Usage Report",
    eps: "EPS Report",
    authentication: "Authentication Activity Report",
    pci_dss: "PCI-DSS Compliance Report",
    iso_27001: "ISO 27001 Compliance Report",
    soc2: "SOC 2 Compliance Report",
  };
  return map[type] ?? "SIEM Report";
}

function complianceControls(
  framework: string,
  facts: { retention: number; events: number; alerts: number; incidents: number; sources: number },
) {
  const base = [
    {
      control: framework === "pci_dss" ? "10.1 Audit trails" : framework === "iso_27001" ? "A.8.15 Logging" : "CC7.2 Monitoring",
      requirement: "Security events are collected centrally from all in-scope systems.",
      status: facts.sources > 0 && facts.events > 0 ? "compliant" : "gap",
      evidence: `${facts.events} events collected from ${facts.sources} sources.`,
    },
    {
      control: framework === "pci_dss" ? "10.5.1 Retention" : framework === "iso_27001" ? "A.8.15 Log retention" : "CC7.3 Retention",
      requirement: framework === "pci_dss" ? "Retain audit history for at least 12 months." : "Retain logs per the approved policy.",
      status: facts.retention >= (framework === "pci_dss" ? 365 : 90) ? "compliant" : "gap",
      evidence: `Current retention window: ${facts.retention} days.`,
    },
    {
      control: framework === "pci_dss" ? "10.6 Review" : framework === "iso_27001" ? "A.5.25 Assessment of events" : "CC7.4 Incident response",
      requirement: "Alerts are reviewed and escalated into incidents.",
      status: facts.alerts === 0 || facts.incidents > 0 ? "compliant" : "observation",
      evidence: `${facts.alerts} alerts and ${facts.incidents} incidents in period.`,
    },
    {
      control: framework === "pci_dss" ? "8.1 User access" : framework === "iso_27001" ? "A.5.15 Access control" : "CC6.1 Logical access",
      requirement: "User accounts and privileged access are tracked and auditable.",
      status: "compliant",
      evidence: "User management, RBAC and audit logging are enforced by the platform.",
    },
  ];
  return base;
}

function toReportCsv(
  type: string,
  summary: Record<string, unknown>,
  events: Record<string, unknown>[],
  alerts: Record<string, unknown>[],
  incidents: Record<string, unknown>[],
) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  if (type === "alerts")
    return ["created_at,severity,status,rule_name,entity,event_count,title",
      ...alerts.map((a) => [a["created_at"], a["severity"], a["status"], a["rule_name"], a["entity"], a["event_count"], a["title"]].map(esc).join(","))].join("\n");
  if (type === "incidents")
    return ["created_at,reference,status,severity,title",
      ...incidents.map((i) => [i["created_at"], i["reference"], i["status"], i["severity"], i["title"]].map(esc).join(","))].join("\n");
  if (type === "security_events" || type === "authentication")
    return ["timestamp,severity,event_type,user,host,source_ip,category",
      ...events.map((e) => [e["timestamp"], e["severity"], e["event_type"], e["user"], e["host"], e["source_ip"], e["category"]].map(esc).join(","))].join("\n");
  return ["metric,value", ...Object.entries(summary).map(([k, v]) =>
    [k, typeof v === "object" ? JSON.stringify(v) : v].map(esc).join(","))].join("\n");
}

export async function listReports(userId: string) {
  const { org } = await tenant(userId);
  const { data } = await supabaseAdmin
    .from("reports")
    .select("*")
    .eq("org_id", org)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}