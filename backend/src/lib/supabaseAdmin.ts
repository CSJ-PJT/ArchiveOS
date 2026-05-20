import { createClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WebSocketTransport = WebSocket as unknown as WebSocketLikeConstructor;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocketTransport,
  },
});
