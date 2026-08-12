// Server-only administrative operations for DirAmn.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  audit,
  derivePassword,
  getActor,
  getPolicy,
  planDefaults,
  randomToken,
  requireOrgAdmin,
  requireSuperAdmin,
  scopeOrg,
  sha256Hex,
  signPayload,
  validatePassword,
  verifyPayload,
  type AppRole,
} from "./core.server";

/* ------------------------------- vendor ------------------------------- */

export async function createOrganization(
  userId: string,
  input: {
    name: string;
    slug: string;
    contactEmail: string;
    plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE_AI";
    adminUsername: string;
    adminEmail: string;
    adminPassword: string;
  },
) {
  const actor = await requireSuperAdmin(userId);
  const defaults = planDefaults(input.plan);

  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: input.name,
      slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      contact_email: input.contactEmail,
      plan: input.plan,
      eps_limit: defaults.eps,
      retention_days: defaults.retention,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("password_policies").insert({ org_id: org.id });
  await supabaseAdmin.from("ldap_configs").insert({ org_id: org.id });

  await createUserInternal({
    orgId: org.id,
    username: input.adminUsername,
    email: input.adminEmail,
    fullName: "Organization Administrator",
    password: input.adminPassword,
    role: "org_admin",
    skipPolicy: true,
  });

  await audit({
    orgId: org.id,
    actorId: actor.id,
    actorName: actor.username,
    action: "org.created",
    target: org.name,
    details: { plan: input.plan },
  });
  return org;
}

export async function listOrganizations(userId: string) {
  await requireSuperAdmin(userId);
  const { data: orgs } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("org_id");
  const { data: sources } = await supabaseAdmin
    .from("sources")
    .select("org_id");
  const { data: licenses } = await supabaseAdmin
    .from("licenses")
    .select("org_id, status, plan, expires_at");

  return (orgs ?? []).map((o) => ({
    ...o,
    user_count: (profiles ?? []).filter((p) => p.org_id === o.id).length,
    source_count: (sources ?? []).filter((s) => s.org_id === o.id).length,
    license: (licenses ?? []).find(
      (l) => l.org_id === o.id && l.status === "active",
    ) ?? null,
  }));
}

export async function platformHealth(userId: string) {
  await requireSuperAdmin(userId);
  const [orgs, users, sources, licenses, logins] = await Promise.all([
    supabaseAdmin.from("organizations").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("sources").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("licenses").select("status, plan, eps_limit, expires_at"),
    supabaseAdmin
      .from("audit_logs")
      .select("action, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const lic = licenses.data ?? [];
  return {
    organizations: orgs.count ?? 0,
    users: users.count ?? 0,
    sources: sources.count ?? 0,
    licenses_active: lic.filter((l) => l.status === "active").length,
    licenses_expiring: lic.filter(
      (l) =>
        l.status === "active" &&
        new Date(l.expires_at).getTime() - Date.now() < 30 * 86400000,
    ).length,
    licensed_eps: lic
      .filter((l) => l.status === "active")
      .reduce((a, l) => a + (l.eps_limit ?? 0), 0),
    plans: ["STARTER", "PROFESSIONAL", "ENTERPRISE_AI"].map((p) => ({
      plan: p,
      count: lic.filter((l) => l.plan === p && l.status === "active").length,
    })),
    recent_logins: (logins.data ?? []).filter((a) =>
      a.action.startsWith("auth."),
    ).length,
  };
}

/* ------------------------------ licensing ------------------------------ */

export async function generateLicense(
  userId: string,
  input: {
    orgId: string;
    plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE_AI";
    epsLimit: number;
    retentionDays: number;
    maxUsers: number;
    maxSources: number;
    expiresAt: string;
    features: string[];
  },
) {
  const actor = await requireSuperAdmin(userId);
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq("id", input.orgId)
    .single();
  if (!org) throw new Error("Organization not found");

  const licenseKey = `DIRAMN-${input.plan.slice(0, 4)}-${randomToken(6).toUpperCase()}`;
  const payload = {
    license_key: licenseKey,
    org_id: org.id,
    org_name: org.name,
    plan: input.plan,
    eps_limit: input.epsLimit,
    retention_days: input.retentionDays,
    max_users: input.maxUsers,
    max_sources: input.maxSources,
    issued_at: new Date().toISOString(),
    expires_at: new Date(input.expiresAt).toISOString(),
    features: input.features,
  };
  const signature = await signPayload(payload);

  const { data: license, error } = await supabaseAdmin
    .from("licenses")
    .insert({
      org_id: org.id,
      license_key: licenseKey,
      plan: input.plan,
      status: "active",
      eps_limit: input.epsLimit,
      retention_days: input.retentionDays,
      max_users: input.maxUsers,
      max_sources: input.maxSources,
      expires_at: payload.expires_at,
      signature,
      payload: payload as never,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (input.features.length) {
    await supabaseAdmin
      .from("license_features")
      .insert(
        input.features.map((f) => ({ license_id: license.id, feature_key: f })),
      );
  }

  await supabaseAdmin
    .from("organizations")
    .update({
      plan: input.plan,
      eps_limit: input.epsLimit,
      retention_days: input.retentionDays,
    })
    .eq("id", org.id);

  await audit({
    orgId: org.id,
    actorId: actor.id,
    actorName: actor.username,
    action: "license.generated",
    target: licenseKey,
    details: { plan: input.plan },
  });

  return { license, file: buildLicenseFile(payload, signature) };
}

function buildLicenseFile(payload: unknown, signature: string) {
  const body = btoa(JSON.stringify({ payload, signature }, null, 0));
  return `-----BEGIN DIRAMN LICENSE-----\n${(body.match(/.{1,64}/g) ?? []).join("\n")}\n-----END DIRAMN LICENSE-----\n`;
}

export async function downloadLicense(userId: string, licenseId: string) {
  const actor = await getActor(userId);
  const { data: license } = await supabaseAdmin
    .from("licenses")
    .select("*")
    .eq("id", licenseId)
    .single();
  if (!license) throw new Error("License not found");
  if (!actor.isSuperAdmin && license.org_id !== actor.orgId)
    throw new Error("Forbidden: cross-tenant access denied");
  return { file: buildLicenseFile(license.payload, license.signature) };
}

export async function setLicenseStatus(
  userId: string,
  licenseId: string,
  status: "active" | "suspended" | "revoked" | "expired",
  expiresAt?: string,
) {
  const actor = await requireSuperAdmin(userId);
  const update: Record<string, unknown> = { status };
  if (expiresAt) update["expires_at"] = new Date(expiresAt).toISOString();
  const { data, error } = await supabaseAdmin
    .from("licenses")
    .update(update as never)
    .eq("id", licenseId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await audit({
    orgId: data.org_id,
    actorId: actor.id,
    actorName: actor.username,
    action: `license.${status}`,
    target: data.license_key,
  });
  return data;
}

/** Customers upload a signed .lic file — the file alone decides the plan. */
export async function uploadLicense(userId: string, fileContent: string) {
  const actor = await requireOrgAdmin(userId);
  const orgId = scopeOrg(actor, null);

  const b64 = fileContent
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  let parsed: { payload: Record<string, unknown>; signature: string };
  try {
    parsed = JSON.parse(atob(b64));
  } catch {
    throw new Error("Invalid license file format");
  }
  if (!parsed?.payload || !parsed?.signature)
    throw new Error("Invalid license file");

  const valid = await verifyPayload(parsed.payload, parsed.signature);
  if (!valid) {
    await audit({
      orgId,
      actorId: actor.id,
      actorName: actor.username,
      action: "license.upload",
      status: "failure",
      details: { reason: "invalid_signature" },
    });
    throw new Error("License signature verification failed");
  }

  const p = parsed.payload as {
    org_id: string;
    license_key: string;
    plan: string;
    eps_limit: number;
    retention_days: number;
    max_users: number;
    max_sources: number;
    expires_at: string;
  };
  if (p.org_id !== orgId)
    throw new Error("This license was issued to a different organization");
  if (new Date(p.expires_at).getTime() < Date.now())
    throw new Error("This license has expired");

  const { data: license, error } = await supabaseAdmin
    .from("licenses")
    .upsert(
      {
        org_id: orgId,
        license_key: p.license_key,
        plan: p.plan as never,
        status: "active",
        eps_limit: Number(p.eps_limit),
        retention_days: Number(p.retention_days),
        max_users: Number(p.max_users),
        max_sources: Number(p.max_sources),
        expires_at: p.expires_at,
        signature: parsed.signature,
        payload: parsed.payload as never,
      },
      { onConflict: "license_key" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("organizations")
    .update({
      plan: license.plan,
      eps_limit: license.eps_limit,
      retention_days: license.retention_days,
    })
    .eq("id", orgId);

  await audit({
    orgId,
    actorId: actor.id,
    actorName: actor.username,
    action: "license.upload",
    target: license.license_key,
    details: { plan: license.plan },
  });
  return license;
}

/* --------------------------- user management --------------------------- */

async function createUserInternal(input: {
  orgId: string;
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: AppRole;
  authMethod?: "local" | "ldap";
  skipPolicy?: boolean;
}) {
  if (input.role === "super_admin")
    throw new Error("Super administrators cannot be created here");
  if (!input.skipPolicy) {
    const policy = await getPolicy(input.orgId);
    validatePassword(input.password, policy);
  }

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: derivePassword(input.password),
    email_confirm: true,
    user_metadata: { username: input.username },
  });
  if (error || !created?.user) throw new Error(error?.message ?? "Cannot create user");

  const { error: pErr } = await supabaseAdmin.from("profiles").insert({
    id: created.user.id,
    org_id: input.orgId,
    username: input.username,
    email: input.email,
    full_name: input.fullName,
    auth_method: input.authMethod ?? "local",
  });
  if (pErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    throw new Error(pErr.message);
  }
  await supabaseAdmin.from("user_roles").insert({
    user_id: created.user.id,
    org_id: input.orgId,
    role: input.role,
  });
  return created.user.id;
}

export async function createUser(
  userId: string,
  input: {
    orgId?: string | null | undefined;
    username: string;
    email: string;
    fullName: string;
    password: string;
    role: AppRole;
    authMethod: "local" | "ldap";
  },
) {
  const actor = await requireOrgAdmin(userId);
  const orgId = scopeOrg(actor, input.orgId ?? null);

  const license = await activeLicense(orgId);
  if (license) {
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);
    if ((count ?? 0) >= license.max_users)
      throw new Error(
        `License limit reached: ${license.max_users} users on the ${license.plan} plan`,
      );
  }

  const id = await createUserInternal({ ...input, orgId });
  await audit({
    orgId,
    actorId: actor.id,
    actorName: actor.username,
    action: "user.created",
    target: input.username,
    details: { role: input.role },
  });
  return { id };
}

export async function updateUser(
  userId: string,
  input: {
    targetId: string;
    fullName?: string | undefined;
    status?: "active" | "disabled" | "locked" | undefined;
    role?: AppRole | undefined;
  },
) {
  const actor = await requireOrgAdmin(userId);
  const target = await loadTarget(actor, input.targetId);

  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch["full_name"] = input.fullName;
  if (input.status !== undefined) {
    patch["status"] = input.status;
    if (input.status === "active") {
      patch["locked_until"] = null;
      patch["failed_login_count"] = 0;
    }
  }
  if (Object.keys(patch).length)
    await supabaseAdmin
      .from("profiles")
      .update(patch as never)
      .eq("id", target.id);

  if (input.role) {
    if (input.role === "super_admin")
      throw new Error("The super administrator role cannot be assigned");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", target.id);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: target.id, org_id: target.org_id, role: input.role });
    await audit({
      orgId: target.org_id,
      actorId: actor.id,
      actorName: actor.username,
      action: "user.role_changed",
      target: target.username,
      details: { role: input.role },
    });
  }

  await audit({
    orgId: target.org_id,
    actorId: actor.id,
    actorName: actor.username,
    action: "user.updated",
    target: target.username,
    details: patch,
  });
  return { ok: true };
}

export async function deleteUser(userId: string, targetId: string) {
  const actor = await requireOrgAdmin(userId);
  const target = await loadTarget(actor, targetId);
  if (target.id === actor.id) throw new Error("You cannot delete your own account");

  await supabaseAdmin.from("user_roles").delete().eq("user_id", target.id);
  await supabaseAdmin.from("profiles").delete().eq("id", target.id);
  await supabaseAdmin.auth.admin.deleteUser(target.id);
  await audit({
    orgId: target.org_id,
    actorId: actor.id,
    actorName: actor.username,
    action: "user.deleted",
    target: target.username,
  });
  return { ok: true };
}

export async function resetUserPassword(
  userId: string,
  targetId: string,
  newPassword: string,
) {
  const actor = await requireOrgAdmin(userId);
  const target = await loadTarget(actor, targetId);
  const policy = await getPolicy(target.org_id);
  validatePassword(newPassword, policy);

  const { error } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
    password: derivePassword(newPassword),
  });
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("profiles")
    .update({
      password_changed_at: new Date().toISOString(),
      failed_login_count: 0,
      locked_until: null,
      status: target.status === "locked" ? "active" : target.status,
    })
    .eq("id", target.id);

  await audit({
    orgId: target.org_id,
    actorId: actor.id,
    actorName: actor.username,
    action: "user.password_reset",
    target: target.username,
  });
  return { ok: true };
}

async function loadTarget(
  actor: Awaited<ReturnType<typeof getActor>>,
  targetId: string,
) {
  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) throw new Error("User not found");
  if (!actor.isSuperAdmin && target.org_id !== actor.orgId)
    throw new Error("Forbidden: cross-tenant access denied");
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetId);
  if (
    !actor.isSuperAdmin &&
    (roles ?? []).some((r) => r.role === "super_admin")
  )
    throw new Error("Forbidden: vendor account");
  return target;
}

/* ------------------------------ policies ------------------------------ */

export async function savePasswordPolicy(
  userId: string,
  input: Record<string, unknown> & { orgId?: string | null | undefined },
) {
  const actor = await requireOrgAdmin(userId);
  const orgId = scopeOrg(actor, input.orgId ?? null);
  const { orgId: _drop, ...values } = input;
  const { error } = await supabaseAdmin
    .from("password_policies")
    .upsert({ org_id: orgId, ...values, updated_at: new Date().toISOString() } as never);
  if (error) throw new Error(error.message);
  await audit({
    orgId,
    actorId: actor.id,
    actorName: actor.username,
    action: "policy.updated",
    details: values,
  });
  return { ok: true };
}

/* -------------------------------- LDAP -------------------------------- */

export async function saveLdapConfig(
  userId: string,
  input: Record<string, unknown> & { bindPassword?: string | null | undefined },
) {
  const actor = await requireOrgAdmin(userId);
  const orgId = scopeOrg(actor, null);
  const { bindPassword, ...values } = input;

  if (bindPassword) {
    await supabaseAdmin.from("ldap_secrets").upsert({
      org_id: orgId,
      bind_password_encrypted: btoa(bindPassword),
      updated_at: new Date().toISOString(),
    });
  }
  const { error } = await supabaseAdmin.from("ldap_configs").upsert({
    org_id: orgId,
    ...values,
    ...(bindPassword ? { bind_password_set: true } : {}),
    updated_at: new Date().toISOString(),
  } as never);
  if (error) throw new Error(error.message);

  await audit({
    orgId,
    actorId: actor.id,
    actorName: actor.username,
    action: "ldap.updated",
    details: { enabled: values["enabled"] ?? null },
  });
  return { ok: true };
}

export async function testLdap(
  userId: string,
  mode: "connection" | "authentication",
  username?: string,
) {
  const actor = await requireOrgAdmin(userId);
  const orgId = scopeOrg(actor, null);
  const { data: cfg } = await supabaseAdmin
    .from("ldap_configs")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!cfg?.server_host) throw new Error("LDAP server host is not configured");

  const started = Date.now();
  const reachable = await probeTcp(cfg.server_host, cfg.server_port);
  const ms = Date.now() - started;

  const messages: string[] = [];
  messages.push(
    reachable
      ? `TCP connection to ${cfg.server_host}:${cfg.server_port} succeeded in ${ms} ms`
      : `Could not reach ${cfg.server_host}:${cfg.server_port} (timeout after ${ms} ms)`,
  );
  if (!cfg.bind_dn) messages.push("Bind DN is empty");
  if (!cfg.bind_password_set) messages.push("Bind password has not been set");
  if (!cfg.base_dn) messages.push("Base DN is empty");

  if (mode === "authentication") {
    if (!username) throw new Error("Provide a username to test");
    messages.push(
      `Resolved search filter: ${cfg.user_search_filter.replace("{username}", username)}`,
    );
    messages.push(
      "Directory bind is performed by the collector service; configuration validated only.",
    );
  }

  const ok = reachable && !!cfg.bind_dn && !!cfg.base_dn && cfg.bind_password_set;
  await audit({
    orgId,
    actorId: actor.id,
    actorName: actor.username,
    action: `ldap.test_${mode}`,
    status: ok ? "success" : "failure",
    details: { host: cfg.server_host, reachable },
  });
  return { ok, messages };
}

async function probeTcp(host: string, port: number): Promise<boolean> {
  try {
    const net = await import("node:net");
    return await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port });
      const done = (v: boolean) => {
        try {
          socket.destroy();
        } catch {
          /* noop */
        }
        resolve(v);
      };
      socket.setTimeout(4000);
      socket.on("connect", () => done(true));
      socket.on("timeout", () => done(false));
      socket.on("error", () => done(false));
    });
  } catch {
    return false;
  }
}

/* ------------------------------- sources ------------------------------- */

async function activeLicense(orgId: string) {
  const { data } = await supabaseAdmin
    .from("licenses")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function saveSource(
  userId: string,
  input: {
    id?: string | null | undefined;
    name: string;
    sourceType: string;
    sourceIp?: string | null | undefined;
    vendor?: string | null | undefined;
    deviceType?: string | null | undefined;
    status: "enabled" | "disabled";
  },
) {
  const actor = await requireOrgAdmin(userId);
  const orgId = scopeOrg(actor, null);

  if (!input.id) {
    const license = await activeLicense(orgId);
    if (license) {
      const { count } = await supabaseAdmin
        .from("sources")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);
      if ((count ?? 0) >= license.max_sources)
        throw new Error(`License limit reached: ${license.max_sources} sources`);
    }
  }

  const row = {
    org_id: orgId,
    name: input.name,
    source_type: input.sourceType,
    source_ip: input.sourceIp ?? null,
    vendor: input.vendor ?? null,
    device_type: input.deviceType ?? null,
    status: input.status,
  };

  let result;
  if (input.id) {
    const { data, error } = await supabaseAdmin
      .from("sources")
      .update(row)
      .eq("id", input.id)
      .eq("org_id", orgId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    result = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("sources")
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    result = data;
  }

  await audit({
    orgId,
    actorId: actor.id,
    actorName: actor.username,
    action: input.id ? "source.updated" : "source.created",
    target: input.name,
  });
  return result;
}

export async function deleteSource(userId: string, sourceId: string) {
  const actor = await requireOrgAdmin(userId);
  const orgId = scopeOrg(actor, null);
  const { data, error } = await supabaseAdmin
    .from("sources")
    .delete()
    .eq("id", sourceId)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  await audit({
    orgId,
    actorId: actor.id,
    actorName: actor.username,
    action: "source.deleted",
    target: data?.name ?? sourceId,
  });
  return { ok: true };
}

export async function rotateSourceKey(userId: string, sourceId: string) {
  const actor = await requireOrgAdmin(userId);
  const orgId = scopeOrg(actor, null);
  const key = `dk_${randomToken(24)}`;
  const { data, error } = await supabaseAdmin
    .from("sources")
    .update({
      api_key_hash: await sha256Hex(key),
      api_key_prefix: key.slice(0, 10),
    })
    .eq("id", sourceId)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await audit({
    orgId,
    actorId: actor.id,
    actorName: actor.username,
    action: "source.api_key_rotated",
    target: data.name,
  });
  return { apiKey: key };
}

/* ------------------------------- session ------------------------------- */

export async function currentContext(userId: string) {
  const actor = await getActor(userId);
  let org = null;
  let license = null;
  if (actor.orgId) {
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", actor.orgId)
      .maybeSingle();
    org = data;
    license = await activeLicense(actor.orgId);
  }
  const { data: perms } = await supabaseAdmin
    .from("role_permissions")
    .select("permission, role")
    .in("role", actor.roles.length ? actor.roles : ["viewer"]);
  return {
    actor,
    org,
    license,
    permissions: [...new Set((perms ?? []).map((p) => p.permission))],
  };
}
