import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addIncidentNote,
  alertEvents,
  buildReport,
  createIncident,
  dashboard,
  deleteRule,
  deleteSavedSearch,
  evaluateRulesNow,
  exportSearch,
  generateSampleData,
  getSmtpSettings,
  importFile,
  incidentDetail,
  ingestFromConsole,
  listAlerts,
  listIncidents,
  listIngestionJobs,
  listOutbox,
  listReports,
  listRules,
  listSavedSearches,
  previewFile,
  runRetention,
  saveRule,
  saveSearch,
  saveSmtpSettings,
  searchEvents,
  sendTestEmail,
  setRuleEnabled,
  sourceHealth,
  updateAlert,
  updateIncident,
} from "./siem.server";

const severityEnum = z.enum(["critical", "high", "medium", "low", "info"]);
const formatEnum = z.enum([
  "csv", "json", "jsonl", "txt", "apache", "nginx", "syslog", "windows", "auto",
]);

const searchSchema = z.object({
  query: z.string().optional(),
  from: z.string().nullish(),
  to: z.string().nullish(),
  event_type: z.string().nullish(),
  severity: z.string().nullish(),
  source_id: z.string().nullish(),
  source_ip: z.string().nullish(),
  user: z.string().nullish(),
  host: z.string().nullish(),
  vendor: z.string().nullish(),
  device_type: z.string().nullish(),
  category: z.string().nullish(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
});

export const searchEventsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => searchSchema.parse(d))
  .handler(async ({ context, data }) => searchEvents(context.userId, data));

export const exportSearchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => searchSchema.parse(d))
  .handler(async ({ context, data }) => exportSearch(context.userId, data));

export const listSavedSearchesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listSavedSearches(context.userId));

export const saveSearchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1),
        query: z.string(),
        filters: z.record(z.string(), z.unknown()),
        timeRange: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => saveSearch(context.userId, data));

export const deleteSavedSearchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => deleteSavedSearch(context.userId, data.id));

export const dashboardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ hours: z.number().default(24) }).parse(d))
  .handler(async ({ context, data }) => dashboard(context.userId, data.hours));

export const ingestFromConsoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        events: z.array(z.record(z.string(), z.unknown())),
        sourceId: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) =>
    ingestFromConsole(context.userId, { events: data.events, sourceId: data.sourceId ?? null }),
  );

export const previewFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ fileName: z.string(), format: formatEnum, content: z.string() }).parse(d),
  )
  .handler(async ({ data }) => previewFile(data));

export const importFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        fileName: z.string(),
        format: formatEnum,
        content: z.string(),
        sourceId: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) =>
    importFile(context.userId, {
      fileName: data.fileName,
      format: data.format,
      content: data.content,
      sourceId: data.sourceId ?? null,
    }),
  );

export const generateSampleDataFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ count: z.number().min(1).max(2000), attack: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ context, data }) => generateSampleData(context.userId, data.count, data.attack));

export const listIngestionJobsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listIngestionJobs(context.userId));

export const sourceHealthFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => sourceHealth(context.userId));

export const listRulesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listRules(context.userId));

export const saveRuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().nullish(),
        name: z.string().min(2),
        description: z.string().default(""),
        ruleType: z.enum(["threshold", "sequence", "pattern", "anomaly", "correlation"]),
        severity: severityEnum,
        threshold: z.number().min(1),
        windowMinutes: z.number().min(1),
        groupBy: z.string(),
        enabled: z.boolean(),
        conditions: z.record(z.string(), z.unknown()),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => saveRule(context.userId, data));

export const setRuleEnabledFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string(), enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => setRuleEnabled(context.userId, data.id, data.enabled));

export const deleteRuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => deleteRule(context.userId, data.id));

export const evaluateRulesNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => evaluateRulesNow(context.userId));

export const listAlertsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.string().nullish() }).parse(d))
  .handler(async ({ context, data }) => listAlerts(context.userId, data.status ?? null));

export const updateAlertFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string(), status: z.string().nullish(), assignedTo: z.string().nullish() }).parse(d),
  )
  .handler(async ({ context, data }) => updateAlert(context.userId, data));

export const alertEventsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ alertId: z.string() }).parse(d))
  .handler(async ({ context, data }) => alertEvents(context.userId, data.alertId));

export const listIncidentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listIncidents(context.userId));

export const createIncidentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().min(2),
        description: z.string().default(""),
        severity: severityEnum,
        alertId: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => createIncident(context.userId, data));

export const incidentDetailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => incidentDetail(context.userId, data.id));

export const updateIncidentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string(),
        status: z.string().nullish(),
        severity: z.string().nullish(),
        assignedTo: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => updateIncident(context.userId, data));

export const addIncidentNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string(), body: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => addIncidentNote(context.userId, data.id, data.body));

export const runRetentionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => runRetention(context.userId));

export const getSmtpSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getSmtpSettings(context.userId));

export const saveSmtpSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        host: z.string(),
        port: z.number(),
        username: z.string(),
        password: z.string(),
        use_tls: z.boolean(),
        from_name: z.string(),
        from_address: z.string(),
        alert_recipients: z.string(),
        notify_critical: z.boolean(),
        notify_high: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => saveSmtpSettings(context.userId, data));

export const sendTestEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => sendTestEmail(context.userId));

export const listOutboxFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listOutbox(context.userId));

export const buildReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        type: z.enum([
          "security_events", "alerts", "incidents", "source_usage", "eps",
          "authentication", "pci_dss", "iso_27001", "soc2",
        ]),
        days: z.number().min(1).max(365),
        format: z.enum(["pdf", "csv"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => buildReport(context.userId, data));

export const listReportsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listReports(context.userId));