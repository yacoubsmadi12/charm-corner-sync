// Server-only authentication logic for DirAmn.
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  audit,
  derivePassword,
  getPolicy,
  type AppRole,
} from "./core.server";

function publicAuthClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const SUPER_ADMIN_EMAIL = "admin@diramn.local";

/** Creates the vendor super_admin account (admin / admin) on first run. */
export async function ensureBootstrap() {
  const { data: existing } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("role", "super_admin")
    .limit(1);
  if (existing && existing.length > 0) return;

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: SUPER_ADMIN_EMAIL,
    password: derivePassword("admin"),
    email_confirm: true,
    user_metadata: { username: "admin" },
  });
  let userId = created?.user?.id;
  if (error && !userId) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email === SUPER_ADMIN_EMAIL)?.id;
  }
  if (!userId) throw new Error("Unable to bootstrap the vendor account");

  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    org_id: null,
    username: "admin",
    email: SUPER_ADMIN_EMAIL,
    full_name: "DirAmn Vendor Administrator",
    status: "active",
    auth_method: "local",
  });
  await supabaseAdmin
    .from("user_roles")
    .upsert(
      { user_id: userId, org_id: null, role: "super_admin" as AppRole },
      { onConflict: "user_id,role" },
    );
}

export type LoginResult = {
  access_token: string;
  refresh_token: string;
  session_timeout_minutes: number;
};

export async function performLogin(
  identifier: string,
  password: string,
  ip: string | null,
): Promise<LoginResult> {
  await ensureBootstrap();

  const ident = identifier.trim().toLowerCase();
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .or(`username.ilike.${ident},email.ilike.${ident}`)
    .limit(1);
  const profile = profiles?.[0];

  if (!profile) {
    await audit({
      orgId: null,
      action: "auth.login_failed",
      actorName: identifier,
      status: "failure",
      details: { reason: "unknown_user", ip },
    });
    throw new Error("Invalid username or password");
  }

  const policy = await getPolicy(profile.org_id);

  if (profile.status === "disabled")
    throw new Error("This account is disabled. Contact your administrator.");

  if (profile.locked_until && new Date(profile.locked_until) > new Date())
    throw new Error(
      `Account locked until ${new Date(profile.locked_until).toLocaleTimeString()}`,
    );

  if (profile.auth_method === "local" && !policy.local_auth_enabled)
    throw new Error("Local authentication is disabled for this organization");

  const client = publicAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: profile.email,
    password: derivePassword(password),
  });

  if (error || !data.session) {
    const failed = (profile.failed_login_count ?? 0) + 1;
    const lock = failed >= policy.failed_login_limit;
    await supabaseAdmin
      .from("profiles")
      .update({
        failed_login_count: lock ? 0 : failed,
        locked_until: lock
          ? new Date(Date.now() + policy.lockout_minutes * 60000).toISOString()
          : null,
        status: lock ? "locked" : profile.status,
      })
      .eq("id", profile.id);
    await audit({
      orgId: profile.org_id,
      actorId: profile.id,
      actorName: profile.username,
      action: "auth.login_failed",
      status: "failure",
      details: { attempts: failed, locked: lock },
    });
    throw new Error(
      lock
        ? `Too many failed attempts. Account locked for ${policy.lockout_minutes} minutes.`
        : "Invalid username or password",
    );
  }

  await supabaseAdmin
    .from("profiles")
    .update({
      failed_login_count: 0,
      locked_until: null,
      status: "active",
      last_login_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  await audit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: profile.username,
    action: "auth.login",
    details: { method: profile.auth_method },
  });

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    session_timeout_minutes: policy.session_timeout_minutes,
  };
}
