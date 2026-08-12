// Server-only: correlation engine, threat rules, alerting and notifications.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { audit } from "./core.server";
import type { Severity } from "./events.server";

export type RuleConditions = {
  event_types?: string[];
  severities?: Severity[];
  categories?: string[];
  message_contains?: string[];
  distinct_field?: string;
  distinct_count?: number;
  sequence?: string[];
};

export type BuiltinRule = {
  name: string;
  description: string;
  rule_type: "threshold" | "sequence" | "pattern" | "anomaly" | "correlation";
  severity: Severity;
  threshold: number;
  window_minutes: number;
  group_by: string;
  conditions: RuleConditions;
};

/** The 10 built-in threat detection rules required by Phase 2. */
export const BUILTIN_RULES: BuiltinRule[] = [
  {
    name: "Brute Force Attack",
    description: "Many failed authentications from one source address in a short window.",
    rule_type: "threshold", severity: "high", threshold: 10, window_minutes: 5, group_by: "source_ip",
    conditions: { event_types: ["failed_login", "brute_force"] },
  },
  {
    name: "Port Scan Detected",
    description: "A single host touches many destination ports or triggers scan signatures.",
    rule_type: "threshold", severity: "high", threshold: 5, window_minutes: 5, group_by: "source_ip",
    conditions: { event_types: ["port_scan"] },
  },
  {
    name: "Multiple Failed Logins",
    description: "Repeated failed logins for the same account.",
    rule_type: "threshold", severity: "medium", threshold: 5, window_minutes: 10, group_by: "user",
    conditions: { event_types: ["failed_login"] },
  },
  {
    name: "Impossible Travel",
    description: "Successful logins for one account from several distinct source addresses.",
    rule_type: "correlation", severity: "high", threshold: 2, window_minutes: 60, group_by: "user",
    conditions: { event_types: ["successful_login"], distinct_field: "source_ip", distinct_count: 2 },
  },
  {
    name: "Privilege Escalation",
    description: "Privilege elevation activity detected on a host.",
    rule_type: "pattern", severity: "high", threshold: 1, window_minutes: 10, group_by: "host",
    conditions: { event_types: ["privilege_escalation"] },
  },
  {
    name: "Malware Keyword",
    description: "Malware, ransomware or quarantine keywords observed in logs.",
    rule_type: "pattern", severity: "critical", threshold: 1, window_minutes: 5, group_by: "host",
    conditions: { event_types: ["malware"], message_contains: ["malware", "ransom", "trojan", "virus"] },
  },
  {
    name: "Suspicious Authentication",
    description: "Failed logins followed by a success from the same address.",
    rule_type: "sequence", severity: "high", threshold: 1, window_minutes: 15, group_by: "source_ip",
    conditions: { sequence: ["failed_login", "successful_login"] },
  },
  {
    name: "Account Takeover",
    description: "Account lockout followed by a successful login for the same user.",
    rule_type: "sequence", severity: "critical", threshold: 1, window_minutes: 30, group_by: "user",
    conditions: { sequence: ["account_lockout", "successful_login"] },
  },
  {
    name: "Firewall Attack",
    description: "A burst of firewall denies from one source address.",
    rule_type: "threshold", severity: "medium", threshold: 20, window_minutes: 5, group_by: "source_ip",
    conditions: { event_types: ["firewall_block"] },
  },
  {
    name: "Suspicious Admin Activity",
    description: "Administrative accounts performing high severity actions.",
    rule_type: "anomaly", severity: "high", threshold: 3, window_minutes: 30, group_by: "user",
    conditions: { severities: ["high", "critical"], message_contains: ["admin", "root", "administrator"] },
  },
];

export async function ensureBuiltinRules(orgId: string) {
  const { data: existing } = await supabaseAdmin
    .from("correlation_rules")
    .select("name")
    .eq("org_id", orgId)
    .eq("is_builtin", true);
  const have = new Set((existing ?? []).map((r) => r.name));
  const missing = BUILTIN_RULES.filter((r) => !have.has(r.name)).map((r) => ({
    org_id: orgId,
    name: r.name,
    description: r.description,
    rule_type: r.rule_type,
    severity: r.severity,
    threshold: r.threshold,
    window_minutes: r.window_minutes,
    group_by: r.group_by,
    conditions: r.conditions as never,
    is_builtin: true,
    enabled: true,
  }));
  if (missing.length > 0) await supabaseAdmin.from("correlation_rules").insert(missing as never);
  return missing.length;
}

type EventRow = {
  id: string;
  timestamp: string;
  event_type: string;
  severity: Severity;
  raw_message: string;
  source_ip: string | null;
  user: string | null;
  host: string | null;
  category: string | null;
};

function matches(event: EventRow, c: RuleConditions): boolean {
  if (c.event_types?.length && !c.event_types.includes(event.event_type)) return false;
  if (c.severities?.length && !c.severities.includes(event.severity)) return false;
  if (c.categories?.length && !c.categories.includes(event.category ?? "")) return false;
  if (c.message_contains?.length) {
    const msg = `${event.raw_message} ${event.user ?? ""}`.toLowerCase();
    if (!c.message_contains.some((k) => msg.includes(k.toLowerCase()))) return false;
  }
  return true;
}

function keyOf(event: EventRow, field: string): string | null {
  const value = (event as unknown as Record<string, unknown>)[field];
  return value == null || value === "" ? null : String(value);
}

/** Evaluates every enabled rule against the recent event window. */
export async function runCorrelation(orgId: string): Promise<{ created: number }> {
  const { data: rules } = await supabaseAdmin
    .from("correlation_rules")
    .select("*")
    .eq("org_id", orgId)
    .eq("enabled", true);
  if (!rules || rules.length === 0) return { created: 0 };

  const maxWindow = Math.max(...rules.map((r) => r.window_minutes ?? 5), 5);
  const since = new Date(Date.now() - maxWindow * 60_000).toISOString();
  const { data: events } = await supabaseAdmin
    .from("log_events")
    .select("id, timestamp, event_type, severity, raw_message, source_ip, user, host, category")
    .eq("org_id", orgId)
    .gte("timestamp", since)
    .order("timestamp", { ascending: true })
    .limit(5000);
  const rows = (events ?? []) as unknown as EventRow[];
  if (rows.length === 0) return { created: 0 };

  let created = 0;
  for (const rule of rules) {
    const conditions = (rule.conditions ?? {}) as RuleConditions;
    const windowStart = Date.now() - (rule.window_minutes ?? 5) * 60_000;
    const scoped = rows.filter(
      (e) => new Date(e.timestamp).getTime() >= windowStart &&
        (conditions.sequence ? true : matches(e, conditions)),
    );
    if (scoped.length === 0) continue;

    const groups = new Map<string, EventRow[]>();
    for (const e of scoped) {
      const key = keyOf(e, rule.group_by ?? "source_ip") ?? "unknown";
      const bucket = groups.get(key);
      if (bucket) bucket.push(e);
      else groups.set(key, [e]);
    }

    for (const [entity, group] of groups) {
      if (entity === "unknown") continue;
      let triggered = false;
      let matched = group;

      if (conditions.sequence?.length) {
        const order = conditions.sequence;
        let idx = 0;
        const seqEvents: EventRow[] = [];
        for (const e of group) {
          if (e.event_type === order[idx]) { seqEvents.push(e); idx++; }
          if (idx >= order.length) break;
        }
        triggered = idx >= order.length;
        matched = seqEvents;
      } else if (conditions.distinct_field) {
        const distinct = new Set(
          group.map((e) => keyOf(e, conditions.distinct_field as string)).filter(Boolean),
        );
        triggered = distinct.size >= (conditions.distinct_count ?? 2);
      } else {
        triggered = group.length >= (rule.threshold ?? 1);
      }
      if (!triggered) continue;

      // De-duplicate: skip if an open alert for this rule+entity already exists in the window.
      const { data: dup } = await supabaseAdmin
        .from("alerts")
        .select("id")
        .eq("org_id", orgId)
        .eq("rule_id", rule.id)
        .eq("entity", entity)
        .in("status", ["new", "acknowledged", "in_progress"])
        .gte("created_at", new Date(windowStart).toISOString())
        .limit(1);
      if (dup && dup.length > 0) continue;

      const { data: alert } = await supabaseAdmin
        .from("alerts")
        .insert({
          org_id: orgId,
          rule_id: rule.id,
          rule_name: rule.name,
          title: `${rule.name} — ${entity}`,
          description: `${rule.description} Matched ${matched.length} events in ${rule.window_minutes} minutes.`,
          severity: rule.severity,
          entity,
          event_count: matched.length,
          event_ids: matched.slice(0, 100).map((e) => e.id) as never,
        } as never)
        .select("id, title, severity")
        .single();
      created++;
      await supabaseAdmin
        .from("correlation_rules")
        .update({ last_triggered_at: new Date().toISOString() } as never)
        .eq("id", rule.id);
      await audit({
        orgId,
        action: "alert.created",
        target: alert?.id ?? rule.name,
        details: { rule: rule.name, entity, events: matched.length },
      });
      if (alert) await notifyAlert(orgId, alert.id, alert.title, rule.severity as Severity);
    }
  }
  return { created };
}

/* ---------------------------- notifications --------------------------- */

export async function notifyAlert(
  orgId: string,
  alertId: string,
  title: string,
  severity: Severity,
) {
  const { data: smtp } = await supabaseAdmin
    .from("smtp_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!smtp?.enabled) return;
  if (severity === "critical" && !smtp.notify_critical) return;
  if (severity === "high" && !smtp.notify_high) return;
  if (severity !== "critical" && severity !== "high") return;

  await queueEmail(orgId, {
    recipients: smtp.alert_recipients,
    subject: `[DirAmn][${severity.toUpperCase()}] ${title}`,
    body: `A ${severity} alert was raised by DirAmn SIEM.\n\n${title}\nAlert ID: ${alertId}\nTime: ${new Date().toISOString()}`,
    category: "alert",
  });
}

export async function queueEmail(
  orgId: string,
  mail: { recipients: string; subject: string; body: string; category?: string },
) {
  const { data: row } = await supabaseAdmin
    .from("email_outbox")
    .insert({
      org_id: orgId,
      recipients: mail.recipients,
      subject: mail.subject,
      body: mail.body,
      category: mail.category ?? "alert",
      status: "queued",
    } as never)
    .select("id")
    .single();
  if (row) await deliverEmail(orgId, row.id);
  return row?.id ?? null;
}

/**
 * Delivers a queued message through the configured SMTP relay.
 * The runtime has no raw TCP, so an HTTPS SMTP relay endpoint is used when
 * configured; otherwise the message stays in the outbox and is marked pending.
 */
export async function deliverEmail(orgId: string, mailId: string) {
  const { data: mail } = await supabaseAdmin
    .from("email_outbox")
    .select("*")
    .eq("id", mailId)
    .maybeSingle();
  if (!mail) return;
  const { data: smtp } = await supabaseAdmin
    .from("smtp_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  const relay = process.env["SMTP_RELAY_URL"];
  const relayKey = process.env["SMTP_RELAY_KEY"];
  if (!smtp?.enabled || !relay) {
    await supabaseAdmin
      .from("email_outbox")
      .update({ status: "pending", error: "No SMTP relay configured" } as never)
      .eq("id", mailId);
    return;
  }
  try {
    const res = await fetch(relay, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(relayKey ? { Authorization: `Bearer ${relayKey}` } : {}),
      },
      body: JSON.stringify({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.use_tls,
        username: smtp.username,
        from: `${smtp.from_name} <${smtp.from_address}>`,
        to: mail.recipients.split(/[,;]/).map((r) => r.trim()).filter(Boolean),
        subject: mail.subject,
        text: mail.body,
      }),
    });
    if (!res.ok) throw new Error(`Relay responded ${res.status}: ${await res.text()}`);
    await supabaseAdmin
      .from("email_outbox")
      .update({ status: "sent", sent_at: new Date().toISOString(), error: null } as never)
      .eq("id", mailId);
    await audit({ orgId, action: "email.sent", target: mail.subject });
  } catch (err) {
    await supabaseAdmin
      .from("email_outbox")
      .update({ status: "failed", error: err instanceof Error ? err.message : "send failed" } as never)
      .eq("id", mailId);
    await audit({ orgId, action: "email.failed", target: mail.subject, status: "failure" });
  }
}