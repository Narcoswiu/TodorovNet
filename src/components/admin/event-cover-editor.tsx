"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EventCover } from "@/components/brand/event-cover";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";

const MAX_SIDE = 2000;

/** Shrinks a photo in the browser so a 12 MB phone picture uploads as a few hundred kilobytes of WebP. */
async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/webp", 0.85),
  );
}

export function EventCoverEditor({ eventId, imageUrl, dict }: { eventId: number; imageUrl: string | null; dict: Dictionary }) {
  const text = dict.admin.cover;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(next: string | null) {
    const supabase = createClient();
    const { error } = await supabase.from("events").update({ image_url: next }).eq("id", eventId);
    setMessage(error ? { ok: false, text: text.failed } : { ok: true, text: text.saved });
    if (!error) router.refresh();
  }

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const blob = await toWebp(file);
      const path = `events/${eventId}/cover-${Date.now()}.webp`;
      const { error } = await supabase.storage.from("event-media").upload(path, blob, { contentType: "image/webp", upsert: false });
      if (error) throw error;
      await save(supabase.storage.from("event-media").getPublicUrl(path).data.publicUrl);
    } catch {
      setMessage({ ok: false, text: text.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[18rem_1fr]">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border">
        <EventCover src={imageUrl} alt={text.title} seed={eventId} sizes="18rem" className="h-full w-full" />
      </div>
      <div className="space-y-3 text-sm">
        <p className="text-muted">{text.help}</p>
        <div className="flex flex-wrap gap-2">
          <label className={`cursor-pointer rounded-full bg-accent px-4 py-2 font-semibold text-accent-foreground ${busy ? "opacity-60" : ""}`}>
            {busy ? text.uploading : text.upload}
            <input
              type="file"
              name="cover"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file);
                event.target.value = "";
              }}
            />
          </label>
          {imageUrl && (
            <button type="button" onClick={() => save(null)} className="rounded-full border border-border px-4 py-2 font-semibold text-muted hover:text-foreground">
              {text.remove}
            </button>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (/^https?:\/\//.test(url.trim())) save(url.trim());
          }}
        >
          <input
            type="url"
            name="cover_url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={text.url}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="submit" className="rounded-md border border-border px-3 py-2 font-semibold hover:border-accent">
            {text.saveUrl}
          </button>
        </form>
        {message && <p className={message.ok ? "text-good" : "text-bad"}>{message.text}</p>}
      </div>
    </div>
  );
}
