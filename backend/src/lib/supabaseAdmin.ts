import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

const unavailableResult = {
  data: null,
  error: {
    code: "SUPABASE_NOT_CONFIGURED",
    message: "Supabase is not configured for this runtime.",
  },
};

let unavailableQuery: ReturnType<typeof createClient>;

const unavailableProxy = new Proxy(() => unavailableProxy, {
  apply() {
    return unavailableProxy;
  },
  get(_target, property) {
    if (property === "then") {
      return (resolve: (value: typeof unavailableResult) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(unavailableResult).then(resolve, reject);
    }
    return unavailableProxy;
  },
}) as unknown as ReturnType<typeof createClient>;

unavailableQuery = unavailableProxy;

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
  : unavailableQuery;
