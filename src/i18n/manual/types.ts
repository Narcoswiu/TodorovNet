// The officials' manual. Kept apart from the UI dictionaries: it is long prose, and the page renders it
// generically. Labels in quotes must match the real buttons, so update them when a button is renamed.

export type ManualSection = {
  title: string;
  /** Plain paragraphs. */
  text?: string[];
  /** Numbered steps. */
  steps?: string[];
  /** Bulleted facts. */
  bullets?: string[];
  tip?: string;
  warning?: string;
};

export type ManualChapter = {
  id: string;
  icon: string;
  title: string;
  summary: string;
  sections: ManualSection[];
};

export type Manual = {
  title: string;
  subtitle: string;
  updated: string;
  contents: string;
  quickStart: { title: string; items: { role: string; text: string; anchor: string }[] };
  roles: { title: string; intro: string; columns: string[]; rows: { task: string; marks: string[] }[]; legend: string };
  chapters: ManualChapter[];
  checklist: { title: string; groups: { title: string; items: string[] }[] };
  faq: { title: string; items: { q: string; a: string }[] };
  tipLabel: string;
  warningLabel: string;
  back: string;
};
