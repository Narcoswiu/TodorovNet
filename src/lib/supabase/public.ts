import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Anonymous client without cookies, for responses that may be cached and shared between visitors. */
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
