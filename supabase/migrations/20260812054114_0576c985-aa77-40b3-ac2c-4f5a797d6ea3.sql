-- Phase 3: AI, Threat Hunting, MITRE ATT&CK, Risk Scoring
-- All access is via server functions using the service role; RLS is enabled
-- with no anon/authenticated policies so the Data API cannot reach these rows.

CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'chat',
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_messages_conversation_idx ON public.ai_messages (conversation_id, created_at);

CREATE TABLE public.ai_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alert_id uuid,
  incident_id uuid,
  summary text NOT NULL,
  severity_assessment text,
  attack_narrative text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  mitre jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric,
  model text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_investigations TO service_role;
ALTER TABLE public.ai_investigations ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_investigations_org_idx ON public.ai_investigations (org_id, created_at DESC);

CREATE TABLE public.mitre_techniques (
  id text PRIMARY KEY,
  name text NOT NULL,
  tactic text NOT NULL,
  tactic_id text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT ''
);
GRANT ALL ON public.mitre_techniques TO service_role;
ALTER TABLE public.mitre_techniques ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.alert_mitre_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alert_id uuid NOT NULL,
  technique_id text NOT NULL REFERENCES public.mitre_techniques(id) ON DELETE CASCADE,
  confidence numeric NOT NULL DEFAULT 0.8,
  source text NOT NULL DEFAULT 'rule',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, technique_id)
);
GRANT ALL ON public.alert_mitre_map TO service_role;
ALTER TABLE public.alert_mitre_map ENABLE ROW LEVEL SECURITY;
CREATE INDEX alert_mitre_org_idx ON public.alert_mitre_map (org_id, technique_id);

CREATE TABLE public.saved_hunts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  hypothesis text NOT NULL DEFAULT '',
  query jsonb NOT NULL DEFAULT '{}'::jsonb,
  technique_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.saved_hunts TO service_role;
ALTER TABLE public.saved_hunts ENABLE ROW LEVEL SECURITY;
CREATE INDEX saved_hunts_org_idx ON public.saved_hunts (org_id, created_at DESC);

CREATE TABLE public.entity_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_value text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  level text NOT NULL DEFAULT 'low',
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  alert_count integer NOT NULL DEFAULT 0,
  event_count integer NOT NULL DEFAULT 0,
  last_seen timestamptz,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, entity_type, entity_value)
);
GRANT ALL ON public.entity_risk_scores TO service_role;
ALTER TABLE public.entity_risk_scores ENABLE ROW LEVEL SECURITY;
CREATE INDEX entity_risk_org_idx ON public.entity_risk_scores (org_id, score DESC);

CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  feature text NOT NULL,
  model text NOT NULL DEFAULT '',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_usage_log TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_usage_org_idx ON public.ai_usage_log (org_id, created_at DESC);

-- License hardening fields
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS signature_alg text NOT NULL DEFAULT 'HMAC-SHA256',
  ADD COLUMN IF NOT EXISTS key_id text,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS grace_days integer NOT NULL DEFAULT 14;

-- MITRE ATT&CK enterprise seed (techniques used by DirAmn detections)
INSERT INTO public.mitre_techniques (id, name, tactic, tactic_id, description, url) VALUES
('T1078','Valid Accounts','Defense Evasion','TA0005','Adversaries obtain and abuse credentials of existing accounts.','https://attack.mitre.org/techniques/T1078/'),
('T1110','Brute Force','Credential Access','TA0006','Adversaries systematically guess passwords to gain access to accounts.','https://attack.mitre.org/techniques/T1110/'),
('T1110.001','Password Guessing','Credential Access','TA0006','Repeated authentication attempts against one account with many passwords.','https://attack.mitre.org/techniques/T1110/001/'),
('T1110.003','Password Spraying','Credential Access','TA0006','A few common passwords tried across many accounts.','https://attack.mitre.org/techniques/T1110/003/'),
('T1021','Remote Services','Lateral Movement','TA0008','Adversaries use valid accounts to log into remote services.','https://attack.mitre.org/techniques/T1021/'),
('T1021.001','Remote Desktop Protocol','Lateral Movement','TA0008','Lateral movement via RDP sessions.','https://attack.mitre.org/techniques/T1021/001/'),
('T1059','Command and Scripting Interpreter','Execution','TA0002','Abuse of command and script interpreters to execute code.','https://attack.mitre.org/techniques/T1059/'),
('T1059.001','PowerShell','Execution','TA0002','Abuse of PowerShell for execution and discovery.','https://attack.mitre.org/techniques/T1059/001/'),
('T1071','Application Layer Protocol','Command and Control','TA0011','C2 traffic blended into standard application protocols.','https://attack.mitre.org/techniques/T1071/'),
('T1071.004','DNS','Command and Control','TA0011','C2 or exfiltration tunnelled over DNS.','https://attack.mitre.org/techniques/T1071/004/'),
('T1041','Exfiltration Over C2 Channel','Exfiltration','TA0010','Data stolen over the existing command and control channel.','https://attack.mitre.org/techniques/T1041/'),
('T1048','Exfiltration Over Alternative Protocol','Exfiltration','TA0010','Data stolen over a protocol other than the C2 channel.','https://attack.mitre.org/techniques/T1048/'),
('T1486','Data Encrypted for Impact','Impact','TA0040','Ransomware encrypts data to interrupt availability.','https://attack.mitre.org/techniques/T1486/'),
('T1490','Inhibit System Recovery','Impact','TA0040','Deleting backups and shadow copies to prevent recovery.','https://attack.mitre.org/techniques/T1490/'),
('T1562','Impair Defenses','Defense Evasion','TA0005','Disabling security tools, logging, or alerting.','https://attack.mitre.org/techniques/T1562/'),
('T1562.001','Disable or Modify Tools','Defense Evasion','TA0005','Security agents or EDR stopped or tampered with.','https://attack.mitre.org/techniques/T1562/001/'),
('T1070','Indicator Removal','Defense Evasion','TA0005','Deleting or clearing artifacts such as event logs.','https://attack.mitre.org/techniques/T1070/'),
('T1070.001','Clear Windows Event Logs','Defense Evasion','TA0005','Windows event logs cleared to hide activity.','https://attack.mitre.org/techniques/T1070/001/'),
('T1068','Exploitation for Privilege Escalation','Privilege Escalation','TA0004','Exploiting software vulnerabilities to elevate privileges.','https://attack.mitre.org/techniques/T1068/'),
('T1548','Abuse Elevation Control Mechanism','Privilege Escalation','TA0004','Bypassing elevation controls such as sudo or UAC.','https://attack.mitre.org/techniques/T1548/'),
('T1098','Account Manipulation','Persistence','TA0003','Modifying accounts or their privileges to keep access.','https://attack.mitre.org/techniques/T1098/'),
('T1136','Create Account','Persistence','TA0003','Creating new accounts to maintain access.','https://attack.mitre.org/techniques/T1136/'),
('T1543','Create or Modify System Process','Persistence','TA0003','Services or daemons created or altered for persistence.','https://attack.mitre.org/techniques/T1543/'),
('T1053','Scheduled Task/Job','Execution','TA0002','Task schedulers abused for execution or persistence.','https://attack.mitre.org/techniques/T1053/'),
('T1046','Network Service Discovery','Discovery','TA0007','Port and service scanning to map the network.','https://attack.mitre.org/techniques/T1046/'),
('T1087','Account Discovery','Discovery','TA0007','Enumerating local or domain accounts.','https://attack.mitre.org/techniques/T1087/'),
('T1082','System Information Discovery','Discovery','TA0007','Gathering details about the operating system and hardware.','https://attack.mitre.org/techniques/T1082/'),
('T1190','Exploit Public-Facing Application','Initial Access','TA0001','Exploiting an internet-facing host or web application.','https://attack.mitre.org/techniques/T1190/'),
('T1566','Phishing','Initial Access','TA0001','Malicious email used to obtain access or credentials.','https://attack.mitre.org/techniques/T1566/'),
('T1133','External Remote Services','Initial Access','TA0001','VPN or remote access services abused for entry.','https://attack.mitre.org/techniques/T1133/'),
('T1055','Process Injection','Defense Evasion','TA0005','Injecting code into live processes to evade defenses.','https://attack.mitre.org/techniques/T1055/'),
('T1105','Ingress Tool Transfer','Command and Control','TA0011','Tools downloaded from external systems into the network.','https://attack.mitre.org/techniques/T1105/'),
('T1567','Exfiltration Over Web Service','Exfiltration','TA0010','Data uploaded to a legitimate external web service.','https://attack.mitre.org/techniques/T1567/'),
('T1531','Account Access Removal','Impact','TA0040','Accounts deleted or locked to deny access.','https://attack.mitre.org/techniques/T1531/'),
('T1499','Endpoint Denial of Service','Impact','TA0040','Flooding a service to degrade availability.','https://attack.mitre.org/techniques/T1499/')
ON CONFLICT (id) DO NOTHING;