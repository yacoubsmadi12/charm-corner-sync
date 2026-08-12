import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, Field, PageHeader, StatusPill } from "@/components/siem/ui-bits";
import {
  createUserFn,
  deleteUserFn,
  resetPasswordFn,
  updateUserFn,
} from "@/lib/siem/admin.functions";
import { ROLE_LABELS, useSiemContext } from "@/lib/siem/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/console/users")({
  head: () => ({
    meta: [
      { title: "User Management — DirAmn SIEM Console" },
      {
        name: "description",
        content:
          "Create, disable and role-assign users inside your DirAmn SIEM tenant, with local and LDAP authentication support.",
      },
      { property: "og:title", content: "User Management — DirAmn SIEM" },
      {
        property: "og:description",
        content: "Manage tenant users, roles and account status in DirAmn SIEM.",
      },
    ],
  }),
  component: UsersPage,
});

const ROLES = ["org_admin", "analyst", "viewer"] as const;

function UsersPage() {
  const qc = useQueryClient();
  const { data: ctx } = useSiemContext();
  const createUser = useServerFn(createUserFn);
  const updateUser = useServerFn(updateUserFn);
  const deleteUser = useServerFn(deleteUserFn);
  const resetPassword = useServerFn(resetPasswordFn);
  const [open, setOpen] = useState(false);

  const orgId = ctx?.actor.orgId ?? null;

  const { data: users } = useQuery({
    queryKey: ["users", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");
      return (profiles ?? []).map((p) => ({
        ...p,
        role:
          (roles ?? []).find((r) => r.user_id === p.id)?.role ?? "viewer",
      }));
    },
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["users", orgId] });

  const createMutation = useMutation({
    mutationFn: (form: FormData) =>
      createUser({
        data: {
          orgId,
          username: String(form.get("username")),
          email: String(form.get("email")),
          fullName: String(form.get("fullName") ?? ""),
          password: String(form.get("password")),
          role: String(form.get("role")) as "analyst",
          authMethod: String(form.get("authMethod")) as "local",
        },
      }),
    onSuccess: () => {
      toast.success("User created");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (vars: {
      targetId: string;
      status?: "active" | "disabled" | "locked";
      role?: "org_admin" | "analyst" | "viewer";
      fullName?: string;
    }) => updateUser({ data: vars }),
    onSuccess: () => {
      toast.success("User updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="User Management"
        description="Users are scoped to your organization. Cross-tenant access is impossible."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add user</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create user</DialogTitle>
              </DialogHeader>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate(new FormData(e.currentTarget));
                }}
              >
                <Field label="Username">
                  <Input name="username" required />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" required />
                </Field>
                <Field label="Full name">
                  <Input name="fullName" />
                </Field>
                <Field label="Password">
                  <Input name="password" required minLength={4} />
                </Field>
                <Field label="Role">
                  <Select name="role" defaultValue="analyst">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Auth method">
                  <Select name="authMethod" defaultValue="local">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="ldap">LDAP / AD</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" disabled={createMutation.isPending}>
                    Create user
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {!users?.length ? (
        <EmptyState title="No users" hint="Add your first team member." />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Auth</th>
                <th className="p-4">Status</th>
                <th className="p-4">Last login</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4">
                    <div className="font-medium">{u.full_name || u.username}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {u.username} · {u.email}
                    </div>
                  </td>
                  <td className="p-4">
                    <Select
                      value={u.role}
                      onValueChange={(v) =>
                        update.mutate({
                          targetId: u.id,
                          role: v as "analyst",
                        })
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-4 font-mono text-xs uppercase">
                    {u.auth_method}
                  </td>
                  <td className="p-4">
                    <StatusPill status={u.status} />
                  </td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleString()
                      : "never"}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          update.mutate({
                            targetId: u.id,
                            status: u.status === "active" ? "disabled" : "active",
                          })
                        }
                      >
                        {u.status === "active" ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const pwd = window.prompt("New password");
                          if (!pwd) return;
                          try {
                            await resetPassword({
                              data: { targetId: u.id, newPassword: pwd },
                            });
                            toast.success("Password reset");
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                      >
                        Reset password
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!window.confirm(`Delete ${u.username}?`)) return;
                          try {
                            await deleteUser({ data: { targetId: u.id } });
                            toast.success("User deleted");
                            invalidate();
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
