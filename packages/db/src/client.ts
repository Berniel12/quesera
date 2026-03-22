import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type TypedSupabaseClient = SupabaseClient<Database>;

interface CreateClientOptions {
  serviceRole?: boolean;
}

export function createSupabaseClient(
  options: CreateClientOptions = {},
): TypedSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = options.serviceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!supabaseKey) {
    throw new Error(
      options.serviceRole
        ? "SUPABASE_SERVICE_ROLE_KEY is not set"
        : "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set",
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: !options.serviceRole,
      persistSession: !options.serviceRole,
    },
  });
}
