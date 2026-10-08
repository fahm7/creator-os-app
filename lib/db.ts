import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// server-only above is load-bearing: this module holds the service role key, which bypasses RLS
// entirely. Importing it from a client component becomes a build error rather than a leaked key.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Every table has RLS enabled with no policies, so the anon key reads nothing and the service
// role is the only way in. That is deliberate: all database access goes through route handlers,
// which is already where the model calls live.
export function db() {
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then restart the dev server."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Postgres errors arrive as objects rather than thrown exceptions, and a silently ignored one
// would let the app report success while writing nothing. Every call site routes through here.
// A null payload is treated as a failure too: every query in this app selects what it wrote, so
// null means the row is not there and callers should not have to re-narrow it.
// Generic over the whole response rather than over the payload. A Postgrest response is a
// discriminated union whose failure arm types data as null, so inferring the payload directly
// collapses it to never; indexing the response type keeps the row type intact. NonNullable
// because the runtime guards below rule out the null the caller would otherwise re-narrow.
export function orThrow<R extends { data: unknown; error: unknown }>(
  result: R,
  context: string
): NonNullable<R["data"]> {
  if (result.error) {
    const message =
      typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message: unknown }).message)
        : "unknown database error";
    throw new Error(`${context}: ${message}`);
  }
  if (result.data === null || result.data === undefined) {
    throw new Error(`${context}: the database returned nothing.`);
  }
  return result.data as NonNullable<R["data"]>;
}
