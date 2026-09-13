import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = Database["public"]["Enums"]["staff_role"];

export type Viewer = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string;
  isSuperAdmin: boolean;
};

/** The signed-in user, verified against the auth server's signing keys. Null when signed out. */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    isSuperAdmin: profile?.is_super_admin ?? false,
  };
}

export async function requireViewer(lang: Locale, returnTo: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/${lang}/login?next=${encodeURIComponent(returnTo)}`);
  return viewer;
}

export async function getEventRoles(viewer: Viewer, eventId: number): Promise<Set<StaffRole>> {
  const { data } = await viewer.supabase
    .from("event_staff")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", viewer.userId);
  return new Set((data ?? []).map((row) => row.role));
}

// Which admin tabs each role works in. The database enforces the same rules; this only hides dead ends.
export const ADMIN_TABS = {
  settings: ["organizer"],
  classes: ["organizer"],
  entries: ["organizer", "jury", "jury_chair"],
  stages: ["organizer"],
  timing: ["organizer", "timekeeper", "jury", "jury_chair"],
  results: ["organizer", "timekeeper", "jury", "jury_chair"],
  protests: ["organizer", "jury", "jury_chair"],
  staff: ["organizer", "jury_chair"],
  penalties: ["organizer", "gps_judge", "jury", "jury_chair"],
} satisfies Record<string, StaffRole[]>;

export type AdminTab = keyof typeof ADMIN_TABS;

export function allowedTabs(roles: Set<StaffRole>, isSuperAdmin: boolean): AdminTab[] {
  return (Object.keys(ADMIN_TABS) as AdminTab[]).filter(
    (tab) => isSuperAdmin || ADMIN_TABS[tab].some((role) => roles.has(role as StaffRole)),
  );
}
