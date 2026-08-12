import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getContextFn } from "./admin.functions";

export type SiemContext = Awaited<ReturnType<typeof getContextFn>>;

export function useSupabaseUserId() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return userId;
}

export function useSiemContext() {
  const userId = useSupabaseUserId();
  const fetchContext = useServerFn(getContextFn);
  const query = useQuery({
    queryKey: ["siem-context", userId],
    queryFn: () => fetchContext(),
    enabled: !!userId,
    retry: false,
  });
  return { ...query, userId, isAuthLoading: userId === undefined };
}

export function can(ctx: SiemContext | undefined, permission: string) {
  return !!ctx?.permissions.includes(permission);
}

export async function signOutEverywhere() {
  await supabase.auth.signOut();
  window.location.href = "/";
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Organization Admin",
  analyst: "Analyst",
  viewer: "Viewer",
};
