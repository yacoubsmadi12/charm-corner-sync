// Server-only DirAmn core helpers. Never imported by client code directly.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppRole = "super_admin" | "org_admin" | "analyst" | "viewer";

/**
 * Local credentials are stored in the identity provider with a fixed
 * namespace prefix so the platform can enforce its own password policy
 * (including short bootstrap credentials) independently of provider limits.
 */
const PASSWORD_NAMESPACE = "DirAmn::v1::";
export function derivePassword(plain: string): string {
  return PASSWORD_NAMESPACE + plain;
}

const enc = new TextEncoder();

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function signingSecret(): string {
  return (
    process.env["LICENSE_SIGNING_KEY"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    "diramn-dev-signing-key"
  );
}

/** HMAC-SHA256 signature. The signing secret never leaves the server. */
export async function signPayload(payload: unknown): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(JSON.stringify(payload)),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function verifyPayload(
  payload: unknown,
  signature: string,
): Promise<boolean> {
  const expected = await signPayload(payload);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type PasswordPolicy = {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_special: boolean;
  failed_login_limit: number;
  lockout_minutes: number;
  local_auth_enabled: boolean;
  password_expiry_days: number;
  session_timeout_minutes: number;
  inactive_user_days: number;
  password_history: number;
};

export const DEFAULT_POLICY: PasswordPolicy = {
  min_length: 8,
  require_uppercase: true,
  require_lowercase: true,
  require_number: true,
  require_special: false,
  failed_login_limit: 5,
  lockout_minutes: 15,
  local_auth_enabled: true,
  password_expiry_days: 90,
  session_timeout_minutes: 60,
  inactive_user_days: 90,
  password_history: 3,
};

export async function getPolicy(
  orgId: string | null,
): Promise<PasswordPolicy> {
  if (!orgId) return DEFAULT_POLICY;
  const { data } = await supabaseAdmin
    .from("password_policies")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return DEFAULT_POLICY;
  return { ...DEFAULT_POLICY, ...(data as Partial<PasswordPolicy>) };
}

export function validatePassword(password: string, policy: PasswordPolicy) {
  const errors: string[] = [];
  if (password.length < policy.min_length)
    errors.push(`must be at least ${policy.min_length} characters`);
  if (policy.require_uppercase && !/[A-Z]/.test(password))
    errors.push("must contain an uppercase letter");
  if (policy.require_lowercase && !/[a-z]/.test(password))
    errors.push("must contain a lowercase letter");
  if (policy.require_number && !/[0-9]/.test(password))
    errors.push("must contain a number");
  if (policy.require_special && !/[^A-Za-z0-9]/.test(password))
    errors.push("must contain a special character");
  if (errors.length) throw new Error(`Password ${errors.join(", ")}.`);
}

export async function audit(entry: {
  orgId: string | null;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  target?: string | null;
  status?: "success" | "failure";
  details?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("audit_logs").insert({
    org_id: entry.orgId,
    actor_id: entry.actorId ?? null,
    actor_name: entry.actorName ?? null,
    action: entry.action,
    target: entry.target ?? null,
    status: entry.status ?? "success",
    details: (entry.details ?? {}) as never,
  });
}

export type Actor = {
  id: string;
  orgId: string | null;
  username: string;
  email: string;
  roles: AppRole[];
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
};

/** Resolves the caller's tenant + roles from the database, never from input. */
export async function getActor(userId: string): Promise<Actor> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, org_id, username, email, status")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) throw new Error("Unauthorized: no profile");
  if (profile.status === "disabled") throw new Error("Account is disabled");

  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (roleRows ?? []).map((r) => r.role as AppRole);

  return {
    id: profile.id,
    orgId: profile.org_id,
    username: profile.username,
    email: profile.email,
    roles,
    isSuperAdmin: roles.includes("super_admin"),
    isOrgAdmin: roles.includes("org_admin"),
  };
}

export async function requireSuperAdmin(userId: string): Promise<Actor> {
  const actor = await getActor(userId);
  if (!actor.isSuperAdmin) throw new Error("Forbidden: vendor access only");
  return actor;
}

export async function requireOrgAdmin(userId: string): Promise<Actor> {
  const actor = await getActor(userId);
  if (!actor.isOrgAdmin && !actor.isSuperAdmin)
    throw new Error("Forbidden: administrator access required");
  return actor;
}

/** Tenant guard: an org admin may only ever touch their own organization. */
export function scopeOrg(actor: Actor, requestedOrgId?: string | null): string {
  if (actor.isSuperAdmin) {
    const target = requestedOrgId ?? actor.orgId;
    if (!target) throw new Error("Organization is required");
    return target;
  }
  if (!actor.orgId) throw new Error("No organization assigned");
  if (requestedOrgId && requestedOrgId !== actor.orgId)
    throw new Error("Forbidden: cross-tenant access denied");
  return actor.orgId;
}

export function planDefaults(plan: string) {
  switch (plan) {
    case "ENTERPRISE_AI":
      return {
        eps: 20000,
        retention: 365,
        users: 500,
        sources: 1000,
        features: [
          "correlation",
          "ai_analytics",
          "threat_intel",
          "ueba",
          "soar",
          "compliance",
        ],
      };
    case "PROFESSIONAL":
      return {
        eps: 5000,
        retention: 180,
        users: 100,
        sources: 250,
        features: ["correlation", "threat_intel", "compliance"],
      };
    default:
      return {
        eps: 500,
        retention: 30,
        users: 10,
        sources: 25,
        features: ["correlation"],
      };
  }
}
