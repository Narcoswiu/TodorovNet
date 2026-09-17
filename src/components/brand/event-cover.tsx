import Image from "next/image";

/**
 * An event's cover photo, or generated artwork when there is none: a dusk gradient with mountain
 * contour lines, varied by the event id so neighbouring cards don't look alike.
 */
export function EventCover({
  src,
  alt,
  seed,
  sizes,
  priority = false,
  animate = false,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  seed: number;
  sizes: string;
  priority?: boolean;
  animate?: boolean;
  className?: string;
}) {
  // Callers that place the cover themselves (absolute backgrounds) must not also get `relative`.
  const position = /\b(absolute|fixed)\b/.test(className) ? "" : "relative";
  if (src) {
    return (
      <div className={`${position} overflow-hidden bg-card ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          quality={70}
          priority={priority}
          className={`object-cover ${animate ? "ken-burns" : ""}`}
        />
      </div>
    );
  }

  const hue = (seed * 47) % 360;
  const lines = Array.from({ length: 9 }, (_, i) => {
    const y = 70 + i * 26;
    const amp = 18 + ((seed + i * 13) % 22);
    const shift = (seed * 31 + i * 57) % 400;
    return `M-20 ${y} C ${80 + shift / 4} ${y - amp}, ${220 - shift / 5} ${y + amp}, 320 ${y - amp / 2} S ${520 + shift / 6} ${y + amp}, 640 ${y}`;
  });
  return (
    <div
      role="img"
      aria-label={alt}
      className={`${position} overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 20% 0%, hsl(${hue} 75% 38% / 0.75), transparent 60%),
          radial-gradient(90% 80% at 100% 100%, rgb(255 106 19 / 0.5), transparent 60%),
          linear-gradient(160deg, #1a2130, #07090c)`,
      }}
    >
      <svg viewBox="0 0 620 320" preserveAspectRatio="xMidYMid slice" className={`absolute inset-0 h-full w-full ${animate ? "ken-burns" : ""}`} aria-hidden>
        {lines.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={i % 3 === 0 ? "rgb(255 140 60 / 0.7)" : "rgb(255 255 255 / 0.18)"} strokeWidth={i % 3 === 0 ? 2 : 1.2} />
        ))}
      </svg>
    </div>
  );
}
