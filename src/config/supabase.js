import { createClient } from "@supabase/supabase-js";

let supabaseAdmin = null;

function getSupabaseCredentials() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    const error = new Error("Supabase is not configured.");
    error.statusCode = 503;
    error.publicMessage = "Supabase is not configured in Render.";
    throw error;
  }

  return {
    url,
    serviceRoleKey
  };
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getSupabaseAdmin() {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const { url, serviceRoleKey } = getSupabaseCredentials();

  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  return supabaseAdmin;
}
