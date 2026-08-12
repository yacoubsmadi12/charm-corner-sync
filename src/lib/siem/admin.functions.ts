import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createOrganization,
  createUser,
  currentContext,
  deleteSource,
  deleteUser,
  downloadLicense,
  generateLicense,
  listOrganizations,
  platformHealth,
  resetUserPassword,
  rotateSourceKey,
  saveLdapConfig,
  savePasswordPolicy,
  saveSource,
  setLicenseStatus,
  testLdap,
  updateUser,
  uploadLicense,
} from "./admin.server";

const roleEnum = z.enum(["super_admin", "org_admin", "analyst", "viewer"]);
const planEnum = z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE_AI"]);

export const getContextFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => currentContext(context.userId));

export const listOrganizationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listOrganizations(context.userId));

export const platformHealthFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => platformHealth(context.userId));

export const createOrganizationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(2),
        slug: z.string().min(2),
        contactEmail: z.string().email(),
        plan: planEnum,
        adminUsername: z.string().min(2),
        adminEmail: z.string().email(),
        adminPassword: z.string().min(4),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => createOrganization(context.userId, data));

export const generateLicenseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orgId: z.string().uuid(),
        plan: planEnum,
        epsLimit: z.number().int().positive(),
        retentionDays: z.number().int().positive(),
        maxUsers: z.number().int().positive(),
        maxSources: z.number().int().positive(),
        expiresAt: z.string().min(4),
        features: z.array(z.string()),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => generateLicense(context.userId, data));

export const downloadLicenseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ licenseId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) =>
    downloadLicense(context.userId, data.licenseId),
  );

export const setLicenseStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        licenseId: z.string().uuid(),
        status: z.enum(["active", "suspended", "revoked", "expired"]),
        expiresAt: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) =>
    setLicenseStatus(context.userId, data.licenseId, data.status, data.expiresAt),
  );

export const uploadLicenseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ fileContent: z.string().min(10) }).parse(d))
  .handler(async ({ context, data }) =>
    uploadLicense(context.userId, data.fileContent),
  );

export const createUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orgId: z.string().uuid().nullish(),
        username: z.string().min(2),
        email: z.string().email(),
        fullName: z.string().default(""),
        password: z.string().min(1),
        role: roleEnum,
        authMethod: z.enum(["local", "ldap"]).default("local"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => createUser(context.userId, data));

export const updateUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        targetId: z.string().uuid(),
        fullName: z.string().optional(),
        status: z.enum(["active", "disabled", "locked"]).optional(),
        role: roleEnum.optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => updateUser(context.userId, data));

export const deleteUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ targetId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => deleteUser(context.userId, data.targetId));

export const resetPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ targetId: z.string().uuid(), newPassword: z.string().min(1) })
      .parse(d),
  )
  .handler(async ({ context, data }) =>
    resetUserPassword(context.userId, data.targetId, data.newPassword),
  );

export const savePolicyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        min_length: z.number().int().min(1).max(64),
        require_uppercase: z.boolean(),
        require_lowercase: z.boolean(),
        require_number: z.boolean(),
        require_special: z.boolean(),
        password_expiry_days: z.number().int().min(0),
        password_history: z.number().int().min(0),
        failed_login_limit: z.number().int().min(1),
        lockout_minutes: z.number().int().min(1),
        session_timeout_minutes: z.number().int().min(5),
        inactive_user_days: z.number().int().min(0),
        local_auth_enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => savePasswordPolicy(context.userId, data));

export const saveLdapFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        server_host: z.string(),
        server_port: z.number().int(),
        use_ssl: z.boolean(),
        use_tls: z.boolean(),
        bind_dn: z.string(),
        base_dn: z.string(),
        user_search_base: z.string(),
        user_search_filter: z.string(),
        username_attribute: z.string(),
        email_attribute: z.string(),
        display_name_attribute: z.string(),
        group_search_base: z.string(),
        group_search_filter: z.string(),
        group_map_org_admin: z.string(),
        group_map_analyst: z.string(),
        group_map_viewer: z.string(),
        bindPassword: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => saveLdapConfig(context.userId, data));

export const testLdapFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        mode: z.enum(["connection", "authentication"]),
        username: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) =>
    testLdap(context.userId, data.mode, data.username),
  );

export const saveSourceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        name: z.string().min(1),
        sourceType: z.string().min(1),
        sourceIp: z.string().nullish(),
        vendor: z.string().nullish(),
        deviceType: z.string().nullish(),
        status: z.enum(["enabled", "disabled"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => saveSource(context.userId, data));

export const deleteSourceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sourceId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) =>
    deleteSource(context.userId, data.sourceId),
  );

export const rotateSourceKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sourceId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) =>
    rotateSourceKey(context.userId, data.sourceId),
  );
