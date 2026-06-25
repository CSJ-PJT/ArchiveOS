import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

function throwSupabaseUnavailable(): never {
  throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for Supabase-backed operations.");
}

export const supabaseAdmin = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      realtime: {
        transport: WebSocket as unknown as any,
      },
    })
  : new Proxy(
      {},
      {
        get() {
          return throwSupabaseUnavailable;
        },
      },
    ) as ReturnType<typeof createClient>;
