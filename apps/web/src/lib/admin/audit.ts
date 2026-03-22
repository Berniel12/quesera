import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Create an admin audit log entry.
 * FAIL CLOSED: if audit insert fails, throws — the calling admin write must also fail.
 */
export async function auditLog(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: oldValue,
    new_value: newValue,
    metadata: metadata ?? {},
  });

  if (error) {
    throw new Error(`Audit log failed (fail closed): ${error.message}`);
  }
}

/**
 * Verify request is from an authenticated admin.
 * Returns { user, isAdmin } or throws with appropriate status.
 */
export async function requireAdmin(
  supabase: SupabaseClient,
): Promise<{ userId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AdminAuthError(401, "Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile || !(profile as { is_admin: boolean }).is_admin) {
    throw new AdminAuthError(403, "Forbidden");
  }

  return { userId: user.id };
}

export class AdminAuthError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}
