import { createPublicClient } from "@/lib/supabase/public";

// GET /api/keep-alive — called once a day by the Vercel cron in vercel.json. A free Supabase project is
// paused after a week without requests; one tiny read keeps it awake between race weekends.
export async function GET() {
  const { error } = await createPublicClient().from("seasons").select("id").limit(1);
  return Response.json({ ok: !error }, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
