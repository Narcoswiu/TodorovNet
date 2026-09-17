/** The stopwatch mark as a small 3D coin: it turns every few seconds and spins when hovered. */
export function Logo3D({ size = "2.25rem" }: { size?: string }) {
  const face = (
    <svg viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="35" r="19" fill="none" stroke="url(#logo3d-ring)" strokeWidth="5" />
      <rect x="28" y="7" width="8" height="6" rx="2" fill="#ff6a13" />
      <path className="logo3d-hand" d="M32 35 L32 22" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="35" r="2.6" fill="#ffffff" />
    </svg>
  );
  return (
    <span className="logo3d" style={{ "--s": size } as React.CSSProperties} aria-hidden>
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="logo3d-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb347" />
            <stop offset="1" stopColor="#ff4d00" />
          </linearGradient>
        </defs>
      </svg>
      <span className="logo3d-coin">
        {[-0.06, -0.03, 0, 0.03, 0.06].map((depth) => (
          <span key={depth} className="logo3d-edge" style={{ transform: `translateZ(calc(var(--s) * ${depth}))` }} />
        ))}
        <span className="logo3d-face logo3d-front">{face}</span>
        <span className="logo3d-face logo3d-back">{face}</span>
      </span>
    </span>
  );
}
