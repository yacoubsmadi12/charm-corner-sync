import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteHunt,
  listHunts,
  listRisk,
  mitreCoverage,
  recomputeRisk,
  runHunt,
  saveHunt,
  techniqueList,
} from "./analytics.server";

const huntQuery = z.object({
  filters: z
    .array(
      z.object({
        field: z.string().min(1),
        op: z.enum(["eq", "contains"]),
        value: z.string().min(1),
      }),
    )
    .max(6),
  hours: z.number().int().min(1).max(2160),
  severity: z.string().nullish(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const runHuntFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => huntQuery.parse(d))
  .handler(async ({ context, data }) =>
    runHunt(context.userId, {
      filters: data.filters,
      hours: data.hours,
      severity: data.severity ?? null,
      ...(data.limit !== undefined ? { limit: data.limit } : {}),
    }),
  );

export const listHuntsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listHunts(context.userId));

export const saveHuntFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        name: z.string().min(2).max(120),
        description: z.string().max(500).optional(),
        hypothesis: z.string().max(1000).optional(),
        techniqueId: z.string().max(20).nullish(),
        query: huntQuery,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) =>
    saveHunt(context.userId, {
      id: data.id ?? null,
      name: data.name,
      description: data.description ?? "",
      hypothesis: data.hypothesis ?? "",
      techniqueId: data.techniqueId ?? null,
      query: {
        filters: data.query.filters,
        hours: data.query.hours,
        severity: data.query.severity ?? null,
      },
    }),
  );

export const deleteHuntFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => deleteHunt(context.userId, data.id));

export const mitreCoverageFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => mitreCoverage(context.userId));

export const techniqueListFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => techniqueList(context.userId));

export const listRiskFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listRisk(context.userId));

export const recomputeRiskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => recomputeRisk(context.userId));
