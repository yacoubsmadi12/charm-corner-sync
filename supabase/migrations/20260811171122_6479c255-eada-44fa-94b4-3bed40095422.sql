
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('super_admin','org_admin','analyst','viewer');
CREATE TYPE public.user_status AS ENUM ('active','disabled','locked');
CREATE TYPE public.auth_method AS ENUM ('local','ldap');
CREATE TYPE public.license_plan AS ENUM ('STARTER','PROFESSIONAL','ENTERPRISE_AI');
CREATE TYPE public.license_status AS ENUM ('active','suspended','expired','revoked');
CREATE TYPE public.source_status AS ENUM ('enabled','disabled');

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  contact_email text,
  status text NOT NULL DEFAULT 'active',
  plan public.license_plan NOT NULL DEFAULT 'STARTER',
  eps_limit integer NOT NULL DEFAULT 500,
  retention_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  username text NOT NULL,
  email text NOT NULL,
  full_name text,
  status public.user_status NOT NULL DEFAULT 'active',
  auth_method public.auth_method NOT NULL DEFAULT 'local',
  last_login_at timestamptz,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_org_idx ON public.profiles (lower(username), coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  UNIQUE (role, permission)
);

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'org_admin');
$$;

-- POLICIES TABLES
CREATE TABLE public.password_policies (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  min_length integer NOT NULL DEFAULT 8,
  require_uppercase boolean NOT NULL DEFAULT true,
  require_lowercase boolean NOT NULL DEFAULT true,
  require_number boolean NOT NULL DEFAULT true,
  require_special boolean NOT NULL DEFAULT false,
  password_expiry_days integer NOT NULL DEFAULT 90,
  password_history integer NOT NULL DEFAULT 3,
  failed_login_limit integer NOT NULL DEFAULT 5,
  lockout_minutes integer NOT NULL DEFAULT 15,
  session_timeout_minutes integer NOT NULL DEFAULT 60,
  inactive_user_days integer NOT NULL DEFAULT 90,
  local_auth_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ldap_configs (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  server_host text NOT NULL DEFAULT '',
  server_port integer NOT NULL DEFAULT 389,
  use_ssl boolean NOT NULL DEFAULT false,
  use_tls boolean NOT NULL DEFAULT false,
  bind_dn text NOT NULL DEFAULT '',
  base_dn text NOT NULL DEFAULT '',
  user_search_base text NOT NULL DEFAULT '',
  user_search_filter text NOT NULL DEFAULT '(sAMAccountName={username})',
  username_attribute text NOT NULL DEFAULT 'sAMAccountName',
  email_attribute text NOT NULL DEFAULT 'mail',
  display_name_attribute text NOT NULL DEFAULT 'displayName',
  group_search_base text NOT NULL DEFAULT '',
  group_search_filter text NOT NULL DEFAULT '(member={dn})',
  group_map_org_admin text NOT NULL DEFAULT '',
  group_map_analyst text NOT NULL DEFAULT '',
  group_map_viewer text NOT NULL DEFAULT '',
  bind_password_set boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- secret storage, never readable by app users
CREATE TABLE public.ldap_secrets (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  bind_password_encrypted text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_type text NOT NULL,
  source_ip text,
  vendor text,
  device_type text,
  status public.source_status NOT NULL DEFAULT 'enabled',
  api_key_hash text,
  api_key_prefix text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  license_key text NOT NULL UNIQUE,
  plan public.license_plan NOT NULL,
  status public.license_status NOT NULL DEFAULT 'active',
  eps_limit integer NOT NULL DEFAULT 500,
  retention_days integer NOT NULL DEFAULT 30,
  max_users integer NOT NULL DEFAULT 10,
  max_sources integer NOT NULL DEFAULT 10,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  signature text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.license_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE (license_id, feature_key)
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  target text,
  status text NOT NULL DEFAULT 'success',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_org_created_idx ON public.audit_logs (org_id, created_at DESC);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ldap_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT SELECT ON public.license_features TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.organizations, public.profiles, public.user_roles, public.permissions,
  public.role_permissions, public.password_policies, public.ldap_configs, public.ldap_secrets,
  public.sources, public.licenses, public.license_features, public.audit_logs TO service_role;

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ldap_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ldap_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs readable by members and vendor" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.current_org_id());
CREATE POLICY "orgs managed by vendor" ON public.organizations FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "profiles readable in tenant" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = auth.uid() OR org_id = public.current_org_id());
CREATE POLICY "profiles updatable by admins" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()))
  WITH CHECK (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()));

CREATE POLICY "roles readable in tenant" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid() OR org_id = public.current_org_id());

CREATE POLICY "permissions readable" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role permissions readable" ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "policies readable in tenant" ON public.password_policies FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "policies managed by org admin" ON public.password_policies FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()))
  WITH CHECK (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()));

CREATE POLICY "ldap readable by org admin" ON public.ldap_configs FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()));
CREATE POLICY "ldap managed by org admin" ON public.ldap_configs FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()))
  WITH CHECK (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()));

CREATE POLICY "sources readable in tenant" ON public.sources FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "sources managed by org admin" ON public.sources FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()))
  WITH CHECK (public.is_super_admin() OR (public.is_org_admin() AND org_id = public.current_org_id()));

CREATE POLICY "licenses readable in tenant" ON public.licenses FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());
CREATE POLICY "licenses managed by vendor" ON public.licenses FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "license features readable in tenant" ON public.license_features FOR SELECT TO authenticated
  USING (public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.licenses l WHERE l.id = license_id AND l.org_id = public.current_org_id()));

CREATE POLICY "audit readable in tenant" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.current_org_id());

-- SEED permissions
INSERT INTO public.permissions (key, description) VALUES
  ('users.view','View users'),('users.manage','Create, edit and delete users'),
  ('roles.view','View roles'),('roles.manage','Assign roles'),
  ('sources.view','View log sources'),('sources.manage','Manage log sources'),
  ('policies.manage','Manage password and account policies'),
  ('ldap.manage','Manage LDAP / Active Directory'),
  ('license.view','View license information'),('license.upload','Upload a license file'),
  ('license.generate','Generate and sign licenses'),
  ('audit.view','View audit logs'),
  ('orgs.manage','Manage organizations'),
  ('platform.view','View platform health'),
  ('settings.manage','Manage organization settings');

INSERT INTO public.role_permissions (role, permission)
SELECT 'super_admin', key FROM public.permissions;
INSERT INTO public.role_permissions (role, permission) VALUES
  ('org_admin','users.view'),('org_admin','users.manage'),('org_admin','roles.view'),
  ('org_admin','roles.manage'),('org_admin','sources.view'),('org_admin','sources.manage'),
  ('org_admin','policies.manage'),('org_admin','ldap.manage'),('org_admin','license.view'),
  ('org_admin','license.upload'),('org_admin','audit.view'),('org_admin','settings.manage'),
  ('analyst','users.view'),('analyst','sources.view'),('analyst','audit.view'),('analyst','license.view'),
  ('viewer','sources.view'),('viewer','license.view');
