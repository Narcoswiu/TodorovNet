import type { Metadata } from "next";
import { Geist, Oswald } from "next/font/google";
import { NotFoundContent } from "@/components/brand/not-found-content";
import "./globals.css";

// Unmatched URLs outside /bg and /en never reach the [lang] layout, so this page brings its own shell.
const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const display = Oswald({ variable: "--font-display", subsets: ["latin", "cyrillic"], weight: ["700"] });

export const metadata: Metadata = { title: "404 · TodorovNET" };

export default function GlobalNotFound() {
  return (
    <html lang="bg" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NotFoundContent />
      </body>
    </html>
  );
}
