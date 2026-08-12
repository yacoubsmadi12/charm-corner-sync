import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSiemContext } from "@/lib/siem/session";

export const Route = createFileRoute("/redirect")({
  head: () => ({
    meta: [
      { title: "DirAmn SIEM — Routing to your console" },
      {
        name: "description",
        content: "Directing you to the DirAmn vendor or customer console.",
      },
      { property: "og:title", content: "DirAmn SIEM console" },
      {
        property: "og:description",
        content: "Directing you to the DirAmn vendor or customer console.",
      },
    ],
  }),
  component: RedirectPage,
});

function RedirectPage() {
  const navigate = useNavigate();
  const { data, isAuthLoading, userId, isError } = useSiemContext();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!userId || isError) {
      void navigate({ to: "/" });
      return;
    }
    if (!data) return;
    void navigate({ to: data.actor.isSuperAdmin ? "/vendor" : "/console" });
  }, [data, isAuthLoading, userId, isError, navigate]);

  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      Establishing secure session…
    </div>
  );
}
