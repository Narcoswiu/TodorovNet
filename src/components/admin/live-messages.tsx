"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { resolveMessage } from "@/lib/admin/actions/messages";
import { formatClock } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export type CourseMessage = {
  id: number;
  kind: "sos" | "info";
  race_number: number | null;
  body: string;
  lat: number | null;
  lon: number | null;
  accuracy_m: number | null;
  sent_at: string;
  resolved_at: string | null;
  checkpoint: string | null;
  rider: string | null;
  sender: string | null;
};

/** Course messages for the event, refreshed the moment a new one arrives, with a beep for a new SOS. */
export function LiveMessages({
  lang,
  dict,
  eventId,
  messages,
  canResolve,
}: {
  lang: Locale;
  dict: Dictionary;
  eventId: number;
  messages: CourseMessage[];
  canResolve: boolean;
}) {
  const text = dict.admin.messages;
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const knownSos = useRef(new Set(messages.filter((m) => m.kind === "sos").map((m) => m.id)));

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "marshal_messages", filter: `event_id=eq.${eventId}` }, () =>
        router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, router]);

  // A short alarm for every SOS that was not on screen before. Browsers may block sound until the page
  // has been clicked once; the red banner is the part that always works.
  useEffect(() => {
    const fresh = messages.filter((m) => m.kind === "sos" && !m.resolved_at && !knownSos.current.has(m.id));
    for (const m of messages) if (m.kind === "sos") knownSos.current.add(m.id);
    if (!fresh.length) return;
    try {
      const audio = new AudioContext();
      const tone = audio.createOscillator();
      tone.frequency.value = 880;
      tone.connect(audio.destination);
      tone.start();
      tone.stop(audio.currentTime + 0.6);
    } catch {
      // No audio: nothing else to do.
    }
  }, [messages]);

  const openSos = messages.filter((m) => m.kind === "sos" && !m.resolved_at).length;

  return (
    <div>
      <p className="mb-3 text-sm text-muted">{text.intro}</p>
      {openSos > 0 && (
        <p role="alert" className="mb-4 rounded-md bg-bad px-4 py-3 text-lg font-bold text-white">
          {t(text.openSos, { n: openSos })}
        </p>
      )}
      {!messages.length && <p className="text-sm text-muted">{text.none}</p>}
      <ul className="space-y-2">
        {messages.map((message) => {
          const sos = message.kind === "sos";
          return (
            <li
              key={message.id}
              className={`rounded-lg border p-3 text-sm ${
                message.resolved_at ? "border-border text-muted" : sos ? "border-bad bg-bad/10" : "border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-bold ${sos ? "bg-bad text-white" : "bg-border"}`}>
                    {sos ? text.sos : text.info}
                  </span>
                  <span className="font-mono">{formatClock(message.sent_at)}</span>
                  {message.checkpoint && <span className="ml-2 font-medium">{message.checkpoint}</span>}
                  {message.race_number && (
                    <span className="ml-2 font-semibold">
                      #{message.race_number} {message.rider}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {message.lat != null && message.lon != null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${message.lat}&mlon=${message.lon}#map=16/${message.lat}/${message.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline"
                    >
                      {text.map}
                      {message.accuracy_m ? ` ±${Math.round(message.accuracy_m)} m` : ""}
                    </a>
                  )}
                  {message.resolved_at ? (
                    <span>{t(text.resolved, { time: formatClock(message.resolved_at) })}</span>
                  ) : (
                    canResolve && (
                      <ActionButton action={resolveMessage} fields={{ lang, message_id: message.id }} label={text.resolve} pendingLabel="…" tone="good" />
                    )
                  )}
                </div>
              </div>
              {message.body && <p className="mt-1 whitespace-pre-line">{message.body}</p>}
              {message.sender && <p className="mt-1 text-xs text-muted">{t(text.from, { name: message.sender })}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
