import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, StatCard } from "@/components/siem/ui-bits";
import {
  listConversationsFn,
  conversationMessagesFn,
  sendChatMessageFn,
  deleteConversationFn,
} from "@/lib/siem/ai.functions";

export const Route = createFileRoute("/console/ai-chat")({
  head: () => ({
    meta: [
      { title: "AI Security Assistant — DirAmn SIEM" },
      {
        name: "description",
        content:
          "Ask DirAmn's AI security assistant about your own telemetry: alert triage guidance, detection ideas and MITRE ATT&CK context.",
      },
      { property: "og:title", content: "AI Security Assistant — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Chat with an AI SOC analyst grounded in your organization's log data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiChatPage,
});

function AiChatPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listConversationsFn);
  const messagesFn = useServerFn(conversationMessagesFn);
  const sendFn = useServerFn(sendChatMessageFn);
  const removeFn = useServerFn(deleteConversationFn);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const { data: conversations } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => listFn(),
  });

  const { data: thread } = useQuery({
    queryKey: ["ai-thread", activeId],
    enabled: !!activeId,
    queryFn: () => messagesFn({ data: { conversationId: activeId! } }),
  });

  const send = useMutation({
    mutationFn: (content: string) =>
      sendFn({ data: { conversationId: activeId, content } }),
    onSuccess: (res) => {
      setActiveId(res.conversationId);
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      void qc.invalidateQueries({ queryKey: ["ai-thread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      setActiveId(null);
      void qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const locked = conversations && !conversations.enabled;

  return (
    <>
      <PageHeader
        title="AI Security Assistant"
        description="Grounded in your organization's alerts, events and risk scores. Enterprise AI licence required."
      />

      {locked ? (
        <EmptyState
          title="AI assistant is not included in your licence"
          hint={`Current plan: ${conversations?.plan}. Upload an Enterprise AI licence to enable the assistant.`}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="panel space-y-2 p-4">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setActiveId(null)}
            >
              New conversation
            </Button>
            {(conversations?.items ?? []).map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
                  activeId === c.id ? "bg-secondary" : "hover:bg-secondary/60"
                }`}
              >
                <button
                  className="flex-1 truncate text-left"
                  onClick={() => setActiveId(c.id)}
                >
                  {c.title}
                </button>
                <button
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(c.id)}
                  aria-label="Delete conversation"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="panel flex min-h-[60vh] flex-col p-4">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {!activeId && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard label="Ask about" value="Alerts" />
                  <StatCard label="Ask about" value="Hunting" />
                  <StatCard label="Ask about" value="MITRE" />
                </div>
              )}
              {(thread?.messages ?? []).map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-secondary text-secondary-foreground"
                      : "border border-border bg-card"
                  }`}
                >
                  <div className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                    {m.role === "user" ? "You" : "DirAmn AI"}
                  </div>
                  {m.content}
                </div>
              ))}
              {send.isPending && (
                <p className="text-sm text-muted-foreground">Analysing…</p>
              )}
            </div>

            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) send.mutate(draft.trim());
              }}
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Which accounts show brute-force activity in the last 24 hours?"
              />
              <Button type="submit" disabled={send.isPending || !draft.trim()}>
                Send
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
