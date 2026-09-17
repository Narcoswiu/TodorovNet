// Race-number colours from Р VI.4, stored as names in classes.number_bg / number_fg.
const COLORS: Record<string, string> = {
  black: "#111827",
  white: "#ffffff",
  red: "#dc2626",
  green: "#15803d", // darker than pure green so white numbers stay readable
  blue: "#2563eb",
  purple: "#7c3aed",
};

export function numberPlateStyle(bg: string | null | undefined, fg: string | null | undefined) {
  return {
    backgroundColor: bg ? (COLORS[bg] ?? bg) : undefined,
    color: fg ? (COLORS[fg] ?? fg) : undefined,
  };
}
