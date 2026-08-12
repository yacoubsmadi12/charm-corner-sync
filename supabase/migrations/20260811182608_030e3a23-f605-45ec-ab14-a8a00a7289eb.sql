
CREATE TYPE public.event_severity AS ENUM ('critical','high','medium','low','info');
CREATE TYPE public.alert_status AS ENUM ('new','acknowledged','in_progress','resolved','closed','false_positive');
CREATE TYPE public.incident_status AS ENUM ('new','investigating','contained','resolved','closed');
CREATE TYPE public.rule_type AS ENUM ('threshold','sequence','pattern','anomaly','correlation');
CREATE TYPE public.ingestion_status AS ENUM ('pending','running','completed','failed');

CREATE TABLE public.log_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'rest',
  source_ip text,
  event_type text NOT NULL DEFAULT 'generic',
  severity public.event_severity NOT NULL DEFAULT 'info',
  raw_message text NOT NULL DEFAULT '',
  parsed_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  "user" text,
  host text,
  category text,
  vendor text,
  device_type text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX log_events_org_ts_idx ON public.log_events (org_id, timestamp DESC);
CREATE INDEX log_events_source_idx ON public.log_events (org_id, source_id);
CREATE INDEX log_events_source_ip_idx ON public.log_events (org_id, source_ip);
CREATE INDEX log_events_event_type_idx ON public.log_events (org_id, event_type);
CREATE INDEX log_events_severity_idx ON public.log_events (org_id, severity);
CREATE INDEX log_events_user_idx ON public.log_events (org_id, "user");
CREATE INDEX log_events_host_idx ON public.log_events (org_id, host);
CREATE INDEX log_events_vendor_idx ON public.log_events (org_id, vendor);
CREATE INDEX log_events_device_type_idx ON public.log_events (org_id, device_type);
CREATE INDEX log_events_category_idx ON public.log_events (org_id, category);
CREATE INDEX log_events_source_type_idx ON public.log_events (org_id, source_type);
CREATE INDEX log_events_parsed_idx ON public.log_events USING gin (parsed_fields);
CREATE INDEX log_events_message_idx ON public.log_events USING gin (to_tsvector('simple', raw_message));

CREATE TABLE public.source_stats (
  source_id uuid PRIMARY KEY REFERENCES public.sources(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_count bigint NOT NULL DEFAULT 0,
  eps numeric NOT NULL DEFAULT 0,
  last_event_at timestamptz,
  health text NOT NULL DEFAULT 'unknown',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  query text NOT NULL DEFAULT '',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_range text NOT NULL DEFAULT '24h',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.correlation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  rule_type public.rule_type NOT NULL DEFAULT 'threshold',
  enabled boolean NOT NULL DEFAULT true,
  severity public.event_severity NOT NULL DEFAULT 'medium',
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  threshold integer NOT NULL DEFAULT 5,
  window_minutes integer NOT NULL DEFAULT 5,
  group_by text NOT NULL DEFAULT 'source_ip',
  is_builtin boolean NOT NULL DEFAULT false,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.correlation_rules(id) ON DELETE SET NULL,
  rule_name text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity public.event_severity NOT NULL DEFAULT 'medium',
  status public.alert_status NOT NULL DEFAULT 'new',
  entity text,
  event_count integer NOT NULL DEFAULT 0,
  event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_to uuid,
  incident_id uuid,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alerts_org_created_idx ON public.alerts (org_id, created_at DESC);

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity public.event_severity NOT NULL DEFAULT 'medium',
  status public.incident_status NOT NULL DEFAULT 'new',
  assigned_to uuid,
  created_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incidents_org_created_idx ON public.incidents (org_id, created_at DESC);

ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_incident_fk FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE SET NULL;

CREATE TABLE public.incident_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id uuid,
  author_name text NOT NULL DEFAULT '',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.incident_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  format text NOT NULL,
  status public.ingestion_status NOT NULL DEFAULT 'pending',
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  message text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  report_type text NOT NULL,
  format text NOT NULL DEFAULT 'pdf',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by uuid,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.smtp_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 587,
  use_tls boolean NOT NULL DEFAULT true,
  username text NOT NULL DEFAULT '',
  from_address text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT 'DirAmn SIEM',
  alert_recipients text NOT NULL DEFAULT '',
  notify_high boolean NOT NULL DEFAULT true,
  notify_critical boolean NOT NULL DEFAULT true,
  daily_report boolean NOT NULL DEFAULT false,
  weekly_report boolean NOT NULL DEFAULT false,
  password_set boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipients text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'alert',
  status text NOT NULL DEFAULT 'queued',
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.log_events TO authenticated;
GRANT SELECT ON public.source_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.correlation_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_notes TO authenticated;
GRANT SELECT, INSERT ON public.incident_timeline TO authenticated;
GRANT SELECT, INSERT ON public.ingestion_jobs TO authenticated;
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.smtp_settings TO authenticated;
GRANT SELECT ON public.email_outbox TO authenticated;
GRANT ALL ON public.log_events, public.source_stats, public.saved_searches, public.correlation_rules,
  public.alerts, public.incidents, public.incident_notes, public.incident_timeline,
  public.ingestion_jobs, public.reports, public.smtp_settings, public.email_outbox TO service_role;

ALTER TABLE public.log_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correlation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events readable in tenant" ON public.log_events FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "events writable in tenant" ON public.log_events FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "events deletable by org admin" ON public.log_events FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()));

CREATE POLICY "source stats readable in tenant" ON public.source_stats FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());

CREATE POLICY "saved searches in tenant" ON public.saved_searches FOR ALL TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id())
  WITH CHECK (public.is_super_admin() OR org_id = public.current_org_id());

CREATE POLICY "rules readable in tenant" ON public.correlation_rules FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "rules managed by org admin" ON public.correlation_rules FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()))
  WITH CHECK (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()));

CREATE POLICY "alerts readable in tenant" ON public.alerts FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "alerts managed in tenant" ON public.alerts FOR ALL TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id())
  WITH CHECK (public.is_super_admin() OR org_id = public.current_org_id());

CREATE POLICY "incidents in tenant" ON public.incidents FOR ALL TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id())
  WITH CHECK (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "incident notes in tenant" ON public.incident_notes FOR ALL TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id())
  WITH CHECK (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "incident timeline readable in tenant" ON public.incident_timeline FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "incident timeline writable in tenant" ON public.incident_timeline FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR org_id = public.current_org_id());

CREATE POLICY "ingestion jobs readable in tenant" ON public.ingestion_jobs FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "ingestion jobs writable in tenant" ON public.ingestion_jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR org_id = public.current_org_id());

CREATE POLICY "reports readable in tenant" ON public.reports FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "reports writable in tenant" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR org_id = public.current_org_id());

CREATE POLICY "smtp readable by org admin" ON public.smtp_settings FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()));
CREATE POLICY "smtp managed by org admin" ON public.smtp_settings FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()))
  WITH CHECK (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()));

CREATE POLICY "outbox readable by org admin" ON public.email_outbox FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()));

INSERT INTO public.permissions (key, description) VALUES
  ('events.view','View and search log events'),
  ('events.ingest','Ingest log events'),
  ('rules.view','View correlation rules'),
  ('rules.manage','Create and edit correlation rules'),
  ('alerts.view','View alerts'),
  ('alerts.manage','Triage and update alerts'),
  ('incidents.view','View incidents'),
  ('incidents.manage','Create and manage incidents'),
  ('reports.generate','Generate and export reports'),
  ('smtp.manage','Manage email notification settings')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission)
SELECT 'super_admin', key FROM public.permissions ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, permission) VALUES
  ('org_admin','events.view'),('org_admin','events.ingest'),('org_admin','rules.view'),
  ('org_admin','rules.manage'),('org_admin','alerts.view'),('org_admin','alerts.manage'),
  ('org_admin','incidents.view'),('org_admin','incidents.manage'),('org_admin','reports.generate'),
  ('org_admin','smtp.manage'),
  ('analyst','events.view'),('analyst','events.ingest'),('analyst','rules.view'),
  ('analyst','alerts.view'),('analyst','alerts.manage'),('analyst','incidents.view'),
  ('analyst','incidents.manage'),('analyst','reports.generate'),
  ('viewer','events.view'),('viewer','alerts.view'),('viewer','incidents.view')
ON CONFLICT DO NOTHING;
