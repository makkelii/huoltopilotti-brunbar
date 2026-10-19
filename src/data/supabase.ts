import { inspectAuthCallback, buildAuthRedirect } from "./authFlow";
import { validatePublicConfig } from "./publicConfig";
import { createClient } from "@supabase/supabase-js";
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
export const publicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();
validatePublicConfig(supabaseUrl, publicKey);
export const configured = Boolean(supabaseUrl && publicKey);
// Preserve callback intent before SDK initialization consumes the URL fragment.
export const initialAuthCallback = inspectAuthCallback(window.location.href);
export const supabase = configured
  ? createClient(supabaseUrl!, publicKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "huoltopilotti-auth-v1",
        flowType: "implicit",
      },
    })
  : null;
export const authRedirect = (purpose: "recovery" | "invite") =>
  buildAuthRedirect(purpose, window.location.origin, import.meta.env.BASE_URL);
