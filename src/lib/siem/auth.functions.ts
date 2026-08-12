import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { performLogin, ensureBootstrap } from "./auth.server";

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ identifier: z.string().min(1), password: z.string().min(1) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return performLogin(data.identifier, data.password, null);
  });

export const bootstrapFn = createServerFn({ method: "POST" }).handler(
  async () => {
    await ensureBootstrap();
    return { ok: true };
  },
);
