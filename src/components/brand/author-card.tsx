import Image from "next/image";
import type { Dictionary } from "@/i18n/get-dictionary";

/** Who built TodorovNET: shown on the home page and in the guide. */
export function AuthorCard({ dict }: { dict: Dictionary }) {
  const a = dict.author;
  return (
    <section className="reveal relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-accent/10">
      <div className="grid items-center gap-0 md:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="relative aspect-square w-full md:h-full md:aspect-auto">
          <Image
            src="/about/nikolay-todorov.jpg"
            alt={a.photoAlt}
            fill
            sizes="(min-width: 768px) 22rem, 100vw"
            quality={85}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-card/40" />
        </div>
        <div className="p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{a.kicker}</p>
          <h2 className="font-display mt-2 text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">{a.name}</h2>
          <p className="mt-2 text-muted">{a.role}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {a.titles.map((title) => (
              <span key={title} className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-semibold">
                {title}
              </span>
            ))}
          </div>
          <p className="mt-5 max-w-xl leading-relaxed text-foreground/90">{a.story}</p>
          <p className="mt-3 max-w-xl leading-relaxed text-muted">{a.mission}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a href={`mailto:${a.email}`} className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-foreground">
              {a.contact}
            </a>
            <a href="https://wavsy.dev" target="_blank" rel="noreferrer" className="rounded-full border border-border px-5 py-2.5 font-semibold hover:border-accent">
              Wavsy ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
