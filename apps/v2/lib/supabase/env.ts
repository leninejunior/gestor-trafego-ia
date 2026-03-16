type SupabaseEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function readEnv(): SupabaseEnv | null {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function tryGetSupabaseEnv(): SupabaseEnv | null {
  return readEnv();
}

export function getSupabaseEnv(): SupabaseEnv {
  const env = readEnv();
  if (!env) {
    throw new Error(
      "Missing Supabase env vars: SUPABASE_URL/SUPABASE_ANON_KEY (or NEXT_PUBLIC_* fallback).",
    );
  }

  return env;
}
