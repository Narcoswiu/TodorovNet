import { loadView, type StageSelector } from "@/lib/results/queries";
import { createPublicClient } from "@/lib/supabase/public";

// GET /api/live/42?stage=7  or  /api/live/42?stage=round&ranking=time → live standings as JSON.
// Public data only, read without cookies, and cached at the edge for a few seconds: however many people
// watch, the database answers about one query per stage every 5 seconds.
const CACHED = { "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=5" };
const MEMORY_MS = 3000;

// The edge cache absorbs the crowd, but a realtime change makes every viewer refetch at the same
// second. This keeps the last answer per stage for a moment, so one burst is one database query.
const memory = new Map<string, { at: number; body: string }>();

const notFound = () => Response.json({ error: "not found" }, { status: 404, headers: CACHED });

export async function GET(request: Request, { params }: RouteContext<"/api/live/[eventId]">) {
  const { eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!Number.isInteger(eventId)) return notFound();

  const search = new URL(request.url).searchParams;
  const stageParam = search.get("stage") ?? "round";
  const supabase = createPublicClient();

  let selector: StageSelector;
  if (stageParam === "round") {
    selector = { kind: "round", ranking: search.get("ranking") === "time" ? "time" : "points" };
  } else {
    const stageId = Number(stageParam);
    if (!Number.isInteger(stageId)) return notFound();
    const { data: stage } = await supabase.from("stages").select("type").eq("id", stageId).eq("event_id", eventId).maybeSingle();
    if (!stage || (stage.type !== "navigation" && stage.type !== "enduro_cross")) return notFound();
    selector = { kind: stage.type, stageId };
  }

  const key = `${eventId}:${stageParam}:${search.get("ranking") ?? ""}`;
  const fresh = memory.get(key);
  if (fresh && Date.now() - fresh.at < MEMORY_MS) {
    return new Response(fresh.body, { headers: { ...CACHED, "Content-Type": "application/json" } });
  }

  try {
    const body = JSON.stringify(await loadView(supabase, eventId, selector));
    memory.set(key, { at: Date.now(), body });
    if (memory.size > 64) for (const [k, v] of memory) if (Date.now() - v.at > MEMORY_MS) memory.delete(k);
    return new Response(body, { headers: { ...CACHED, "Content-Type": "application/json" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
