import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  conversationMessages,
  deleteConversation,
  listConversations,
  listInvestigations,
  runInvestigation,
  sendChatMessage,
  suggestHunts,
} from "./ai.server";

export const runInvestigationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ alertId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) =>
    runInvestigation(context.userId, data.alertId),
  );

export const listInvestigationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listInvestigations(context.userId));

export const listConversationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listConversations(context.userId));

export const conversationMessagesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) =>
    conversationMessages(context.userId, data.conversationId),
  );

export const sendChatMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversationId: z.string().uuid().nullish(),
        content: z.string().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) =>
    sendChatMessage(context.userId, {
      conversationId: data.conversationId ?? null,
      content: data.content,
    }),
  );

export const deleteConversationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) =>
    deleteConversation(context.userId, data.id),
  );

export const suggestHuntsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ hypothesis: z.string().min(4).max(1000) }).parse(d),
  )
  .handler(async ({ context, data }) =>
    suggestHunts(context.userId, data.hypothesis),
  );
