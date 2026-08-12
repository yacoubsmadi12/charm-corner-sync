// Threat hunting, MITRE ATT&CK coverage and risk scoring (server-only).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  audit,
  entitlements,
  getActor,
  requireFeature,
  scopeOrg,
} from "./core.server";

const HUNT_FIELDS = [
  "event_type",
  "source_type",
  "host",
  "user",
  "source_ip",
  "category",
  "raw_message",
  "severity",
] as const;
export type HuntField = (typeof HUNT_FIELDS)[number];

export type HuntFilter = { field: string; op: "eq" | "contains"; value: string };

export type HuntQuery = {
  filters: HuntFilter[];
  hours: number;
  severity?: string | null;
  limit?: number;
};

/** Whitelisted field access — analyst input can never reach arbitrary columns. */
function assertField(field: string): HuntField {
  const found = HUNT_FIELDS.find((f) => f === field);
  if (!found) throw new Error(`Field "${field}" cannot be hunted on`);
  return found;
}

export async function runHunt(userId: string, query: HuntQuery) {
  const actor = await getActor(userId);
  await requireFeature(actor, "threat_hunting");
  const orgId = scopeOrg(actor, null);

  const hours = Math.min(Math.max(query.hours || 24, 1), 24 * 90);
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const limit = Math.min(query.limit ?? 200, 500);

  let q = supabaseAdmin
    .from("log_events")
    .select(
      "id, timestamp, severity, event_type, source_type, host, user, source_ip, category, raw_message",
      { count: "exact" },
    )
    .eq("org_id", orgId)
    .gte("timestamp", since);

  for (const filter of query.filters.slice(0, 6)) {
    const field = assertField(filter.field);
    const value = String(filter.value).slice(0, 200);
    if (!value) continue;
    q =
      filter.op === "contains"
        ? q.ilike(field, `%${value}%`)
        : q.eq(field, value);
  }
  if (query.severity) q = q.eq("severity", query.severity as never);

  const { data, count, error } = await q
    .order("timestamp", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const group = (key: "host" | "user" | "source_ip" | "event_type") => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const v = (r as Record<string, unknown>)[key];
      if (!v) continue;
      map.set(String(v), (map.get(String(v)) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([value, hits]) => ({ value, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 8);
  };

  return {
    total: count ?? rows.length,
    rows,
    aggregations: {
      hosts: group("host"),
      users: group("user"),
      ips: group("source_ip"),
      eventTypes: group("event_type"),
    },
  };
}

export async function listHunts(userId: string) {
  const actor = await getActor(userId);
  const orgId = scopeOrg(actor, null);
  const ent = await entitlements(orgId);
  const { data } = await supabaseAdmin
    .from("saved_hunts")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  return {
    enabled: ent.features.includes("threat_hunting"),
    aiEnabled: ent.features.includes("ai_investigation"),
    plan: ent.plan,
    items: data ?? [],
  };
}

export async function saveHunt(
  userId: string,
  input: {
    id?: string | null;
    name: string;
    description?: string;
    hypothesis?: string;
    techniqueId?: string | null;
    query: HuntQuery;
  },
) {
  const actor = await getActor(userId);
  await requireFeature(actor, "threat_hunting");
  const orgId = scopeOrg(actor, null);
  for (const f of input.query.filters) assertField(f.field);

  const row = {
    org_id: orgId,
    name: input.name,
    description: input.description ?? "",
    hypothesis: input.hypothesis ?? "",
    technique_id: input.techniqueId ?? null,
    query: input.query as never,
    created_by: actor.id,
    updated_at: new Date().toISOString(),
  };

  const res = input.id
    ? await supabaseAdmin
        .from("saved_hunts")
        .update(row)
        .eq("id", input.id)
        .eq("org_id", orgId)
        .select()
        .single()
    : await supabaseAdmin.from("saved_hunts").insert(row).select().single();
  if (res.error) throw new Error(res.error.message);

  await audit({
    orgId,
    actorId: actor.id,
    actorName: actor.username,
    action: input.id ? "hunt.updated" : "hunt.created",
    target: input.name,
  });
  return res.data;
}

export async function deleteHunt(userId: string, id: string) {
  const actor = await getActor(userId);
  await requireFeature(actor, "threat_hunting");
  const orgId = scopeOrg(actor, null);
  const { error } = await supabaseAdmin
    .from("saved_hunts")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------ MITRE ATT&CK ------------------------------ */

export async function mitreCoverage(userId: string) {
  const actor = await getActor(userId);
  await requireFeature(actor, "mitre_mapping");
  const orgId = scopeOrg(actor, null);

  const [{ data: techniques }, { data: mappings }] = await Promise.all([
    supabaseAdmin.from("mitre_techniques").select("*").order("id"),
    supabaseAdmin
      .from("alert_mitre_map")
      .select("technique_id, alert_id, source, created_at")
      .eq("org_id", orgId),
  ]);

  const alertIds = [...new Set((mappings ?? []).map((m) => m.alert_id))];
  const { data: alerts } = alertIds.length
    ? await supabaseAdmin
        .from("alerts")
        .select("id, severity, status, created_at, title")
        .in("id", alertIds)
    : { data: [] as { id: string; severity: string }[] };

  const byTechnique = new Map<string, { alerts: string[]; critical: number }>();
  for (const m of mappings ?? []) {
    const entry = byTechnique.get(m.technique_id) ?? { alerts: [], critical: 0 };
    entry.alerts.push(m.alert_id);
    const alert = (alerts ?? []).find((a) => a.id === m.alert_id);
    if (alert && (alert.severity === "critical" || alert.severity === "high"))
      entry.critical += 1;
    byTechnique.set(m.technique_id, entry);
  }

  const items = (techniques ?? []).map((t) => {
    const hit = byTechnique.get(t.id);
    return {
      ...t,
      alert_count: hit ? new Set(hit.alerts).size : 0,
      high_severity: hit?.critical ?? 0,
      covered: !!hit,
    };
  });

  const tactics = [...new Set(items.map((i) => i.tactic))].map((tactic) => ({
    tactic,
    tactic_id: items.find((i) => i.tactic === tactic)?.tactic_id ?? "",
    techniques: items.filter((i) => i.tactic === tactic),
  }));

  return {
    tactics,
    covered: items.filter((i) => i.covered).length,
    total: items.length,
    recentAlerts: (alerts ?? []).slice(0, 20),
  };
}

/* ------------------------------ risk scoring ------------------------------ */

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 40,
  high: 25,
  medium: 12,
  low: 5,
  informational: 1,
};

function levelFor(score: number) {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

/**
 * Recomputes entity risk from the last 30 days of alerts and events.
 * Score = weighted alert severity + open-alert pressure + volume, capped at 100.
 */
export async function recomputeRisk(userId: string) {
  const actor = await getActor(userId);
  await requireFeature(actor, "risk_scoring");
  const orgId = scopeOrg(actor, null);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [{ data: alerts }, { data: events }] = await Promise.all([
    supabaseAdmin
      .from("alerts")
      .select("entity, severity, status, created_at")
      .eq("org_id", orgId)
      .gte("created_at", since)
      .limit(5000),
    supabaseAdmin
      .from("log_events")
      .select("host, user, source_ip, severity, timestamp")
      .eq("org_id", orgId)
      .gte("timestamp", since)
      .limit(5000),
  ]);

  type Acc = {
    type: string;
    value: string;
    score: number;
    alerts: number;
    events: number;
    lastSeen: string | null;
    factors: { factor: string; points: number }[];
  };
  const acc = new Map<string, Acc>();
  const key = (t: string, v: string) => `${t}::${v}`;
  const bump = (
    type: string,
    value: string,
    points: number,
    factor: string,
    seen: string | null,
  ) => {
    if (!value) return;
    const k = key(type, value);
    const cur =
      acc.get(k) ??
      ({
        type,
        value,
        score: 0,
        alerts: 0,
        events: 0,
        lastSeen: null,
        factors: [],
      } satisfies Acc);
    cur.score += points;
    if (seen && (!cur.lastSeen || seen > cur.lastSeen)) cur.lastSeen = seen;
    const existing = cur.factors.find((f) => f.factor === factor);
    if (existing) existing.points += points;
    else cur.factors.push({ factor, points });
    acc.set(k, cur);
  };

  for (const a of alerts ?? []) {
    if (!a.entity) continue;
    const type = /@|^[a-z._-]+$/i.test(a.entity)
      ? /^\d+\.\d+\.\d+\.\d+$/.test(a.entity)
        ? "ip"
        : "user"
      : "asset";
    const weight = SEVERITY_WEIGHT[a.severity] ?? 5;
    bump(type, a.entity, weight, `${a.severity} alerts`, a.created_at);
    if (a.status === "new" || a.status === "in_progress" || a.status === "acknowledged")
      bump(type, a.entity, 6, "unresolved alerts", a.created_at);
    const entry = acc.get(key(type, a.entity));
    if (entry) entry.alerts += 1;
  }

  for (const e of events ?? []) {
    const weight = e.severity === "critical" || e.severity === "high" ? 3 : 0.3;
    for (const [type, value] of [
      ["asset", e.host],
      ["user", e.user],
      ["ip", e.source_ip],
    ] as [string, string | null][]) {
      if (!value) continue;
      bump(type, value, weight, "event volume", e.timestamp);
      const entry = acc.get(key(type, value));
      if (entry) entry.events += 1;
    }
  }

  const rows = [...acc.values()]
    .map((a) => {
      const score = Math.round(Math.min(100, a.score));
      return {
        org_id: orgId,
        entity_type: a.type,
        entity_value: a.value,
        score,
        level: levelFor(score),
        factors: a.factors
          .map((f) => ({ ...f, points: Math.round(f.points) }))
          .sort((x, y) => y.points - x.points) as never,
        alert_count: a.alerts,
        event_count: a.events,
        last_seen: a.lastSeen,
        computed_at: new Date().toISOString(),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 500);

  await supabaseAdmin.from("entity_risk_scores").delete().eq("org_id", orgId);
  if (rows.length) {
    const { error } = await supabaseAdmin
      .from("entity_risk_scores")
      .upsert(rows, { onConflict: "org_id,entity_type,entity_value" });
    if (error) throw new Error(error.message);
  }

  await audit({
    orgId,
    actorId: actor.id,
    actorName: actor.username,
    action: "risk.recomputed",
    details: { entities: rows.length },
  });
  return { entities: rows.length };
}

export async function listRisk(userId: string) {
  const actor = await getActor(userId);
  const orgId = scopeOrg(actor, null);
  const ent = await entitlements(orgId);
  const { data } = await supabaseAdmin
    .from("entity_risk_scores")
    .select("*")
    .eq("org_id", orgId)
    .order("score", { ascending: false })
    .limit(200);
  const items = data ?? [];
  return {
    enabled: ent.features.includes("risk_scoring"),
    plan: ent.plan,
    items,
    summary: {
      critical: items.filter((i) => i.level === "critical").length,
      high: items.filter((i) => i.level === "high").length,
      medium: items.filter((i) => i.level === "medium").length,
      low: items.filter((i) => i.level === "low").length,
      computed_at: items[0]?.computed_at ?? null,
    },
  };
}

export async function techniqueList(userId: string) {
  await getActor(userId);
  const { data } = await supabaseAdmin
    .from("mitre_techniques")
    .select("id, name, tactic")
    .order("id");
  return data ?? [];
}
