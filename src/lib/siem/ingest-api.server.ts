// Server-only: shared handler for the public log ingestion endpoints.
import {
  normalizeEvent,
  parseSyslog,
  resolveSourceByApiKey,
  storeEvents,
  type LogEventInput,
} from "./events.server";
import { ensureBuiltinRules } from "./correlation.server";
import { audit } from "./core.server";

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function readApiKey(request: Request): string | null {
  const header = request.headers.get("x-api-key");
  if (header) return header.trim();
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const url = new URL(request.url);
  return url.searchParams.get("api_key");
}

export type IngestChannel = "rest" | "syslog" | "webhook" | "snmp";

/** Authenticates the caller by source API key and stores the supplied events. */
export async function ingestPublic(
  request: Request,
  channel: IngestChannel,
  extract: (payload: unknown, raw: string) => LogEventInput[],
) {
  const apiKey = readApiKey(request);
  if (!apiKey) return json({ error: "Missing API key. Send X-API-Key header." }, 401);

  let source;
  try {
    source = await resolveSourceByApiKey(apiKey);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unauthorized" }, 401);
  }

  const raw = await request.text();
  if (raw.length > 5_000_000) return json({ error: "Payload too large (max 5MB)" }, 413);

  let payload: unknown = null;
  if (raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  let inputs: LogEventInput[];
  try {
    inputs = extract(payload, raw);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Invalid payload" }, 400);
  }
  if (inputs.length === 0) return json({ error: "No events found in payload" }, 400);
  if (inputs.length > 5000) return json({ error: "Too many events (max 5000 per request)" }, 413);

  await ensureBuiltinRules(source.org_id);
  const normalized = inputs.map((e) =>
    normalizeEvent(source.org_id, e, {
      source_id: source.id,
      source_type: source.source_type ?? channel,
      vendor: source.vendor ?? null,
      device_type: source.device_type ?? null,
    }),
  );
  const result = await storeEvents(source.org_id, normalized, { sourceId: source.id });
  await audit({
    orgId: source.org_id,
    action: `ingest.${channel}`,
    target: source.name,
    details: { accepted: result.accepted, rejected: result.rejected, alerts: result.alerts },
    status: result.errors.length > 0 ? "failure" : "success",
  });

  return json({
    ok: result.errors.length === 0,
    source: source.name,
    accepted: result.accepted,
    rejected: result.rejected,
    alerts_created: result.alerts,
    errors: result.errors,
  }, result.errors.length > 0 ? 207 : 202);
}

/** Pulls an event array out of common REST/webhook payload shapes. */
export function extractEvents(payload: unknown, raw: string): LogEventInput[] {
  if (Array.isArray(payload)) return payload as LogEventInput[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["events", "logs", "records", "data", "items"]) {
      const value = obj[key];
      if (Array.isArray(value)) return value as LogEventInput[];
    }
    return [obj as LogEventInput];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ raw_message: line }));
}

/** Accepts raw syslog lines (RFC3164/RFC5424) or a JSON array of lines. */
export function extractSyslog(payload: unknown, raw: string): LogEventInput[] {
  const lines: string[] = Array.isArray(payload)
    ? payload.map((l) => (typeof l === "string" ? l : JSON.stringify(l)))
    : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>)["messages"])
      ? ((payload as Record<string, unknown>)["messages"] as string[])
      : raw.split(/\r?\n/);
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ ...parseSyslog(line), source_type: "syslog" }));
}

/** Maps an SNMP trap payload into a log event. */
export function extractSnmp(payload: unknown, raw: string): LogEventInput[] {
  const traps = Array.isArray(payload) ? payload : payload ? [payload] : [];
  if (traps.length === 0) return [{ raw_message: raw, source_type: "snmp", event_type: "device_status" }];
  return traps.map((t) => {
    const trap = (t ?? {}) as Record<string, unknown>;
    const name = String(trap["trap"] ?? trap["oid"] ?? "snmp_trap");
    return {
      timestamp: (trap["timestamp"] as string) ?? null,
      source_ip: (trap["agent_address"] as string) ?? (trap["source_ip"] as string) ?? null,
      host: (trap["host"] as string) ?? (trap["agent_address"] as string) ?? null,
      event_type: "device_status",
      category: "infrastructure",
      source_type: "snmp",
      severity: (trap["severity"] as string) ?? (/down|fail|error/i.test(name) ? "high" : "info"),
      raw_message: `SNMP ${name} ${JSON.stringify(trap["varbinds"] ?? trap)}`,
      parsed_fields: trap,
    } satisfies LogEventInput;
  });
}