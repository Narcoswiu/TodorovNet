import path from "node:path";
import { cloneElement, isValidElement } from "react";
import { Circle, Document, Font, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localizedName, riderName, stageName, transliterate } from "@/i18n/localize";
import { formatClock, formatDateRange, formatDuration, formatGap } from "@/lib/format";
import type { SeasonStandings } from "@/lib/results/season";

// Result sheets, rendered on the server. The information follows the documents officials already know
// (per class: position, number, rider, times, points), dressed in the TodorovNET look: a dark masthead,
// a clear status stamp, class-coloured number plates, medal places and aligned monospaced times.

const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Noto Sans Condensed",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSans-CondensedSemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "NotoSans-CondensedBold.ttf"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Noto Sans Mono",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSansMono-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "NotoSansMono-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

export const PDF_FONT_FAMILIES = ["Noto Sans", "Noto Sans Condensed", "Noto Sans Mono"];

const INK = "#0b0d10";
const ACCENT = "#ff6a13";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const MEDALS = ["#f2b92c", "#b8c2cc", "#cd8a52"];

// Race-number plate colours per class (Р VI.4), matching the classes table.
const PLATES: Record<string, { bg: string; fg: string }> = {
  pro: { bg: "#111827", fg: "#ffffff" },
  exp: { bg: "#dc2626", fg: "#ffffff" },
  std: { bg: "#16a34a", fg: "#ffffff" },
  s40: { bg: "#2563eb", fg: "#ffffff" },
  s50: { bg: "#ffffff", fg: "#2563eb" },
  wom: { bg: "#7c3aed", fg: "#ffffff" },
  jst: { bg: "#ffffff", fg: "#16a34a" },
  jun: { bg: "#ffffff", fg: "#16a34a" },
  adv: { bg: "#ffffff", fg: "#111827" },
};
const plateFor = (code: string | undefined) => (code && PLATES[code]) || { bg: "#f3f4f6", fg: INK };

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 58, paddingHorizontal: 30, fontFamily: "Noto Sans", fontSize: 8, color: INK, backgroundColor: "#ffffff" },
  strip: { position: "absolute", top: 0, left: 0, right: 0, height: 24, backgroundColor: INK, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30 },
  stripAccent: { position: "absolute", top: 24, left: 0, right: 0, height: 2, backgroundColor: ACCENT },
  wordmark: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 10, color: "#ffffff", letterSpacing: 0.6 },
  stripText: { fontSize: 7, color: "#9aa3ad" },
  hero: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 6, marginBottom: 12 },
  kicker: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 8, color: ACCENT, letterSpacing: 1.2, textTransform: "uppercase" },
  eventName: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 22, lineHeight: 1.1, marginTop: 2 },
  meta: { fontSize: 8.5, color: MUTED, marginTop: 3 },
  docTitle: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 13, marginTop: 10 },
  stamp: { borderWidth: 1.5, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, alignItems: "center", minWidth: 150 },
  stampLabel: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 11, letterSpacing: 0.8 },
  stampSub: { fontSize: 7, marginTop: 2 },
  note: { fontSize: 7.5, color: MUTED, marginBottom: 8 },
  classBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f3f4f6", borderRadius: 5, paddingVertical: 5, paddingHorizontal: 8, marginTop: 12, marginBottom: 2 },
  className: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 12, marginLeft: 6 },
  classCount: { fontSize: 7, color: MUTED },
  swatch: { width: 9, height: 13, borderRadius: 2, borderWidth: 0.5, borderColor: "#9ca3af" },
  headRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: INK },
  headText: { fontSize: 6.5, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 3.2, borderBottomWidth: 0.4, borderBottomColor: LINE },
  rowAlt: { backgroundColor: "#fafafa" },
  cell: { paddingHorizontal: 3 },
  riderCell: { flexGrow: 1, flexBasis: 0, paddingHorizontal: 6 },
  riderName: { fontWeight: 700, fontSize: 8.5 },
  club: { fontSize: 6.5, color: MUTED, marginTop: 0.5 },
  mono: { fontFamily: "Noto Sans Mono", fontSize: 7.8 },
  monoBold: { fontFamily: "Noto Sans Mono", fontWeight: 700, fontSize: 8.2 },
  right: { textAlign: "right" },
  muted: { color: MUTED },
  penalty: { color: "#dc2626" },
  medal: { width: 15, height: 15, borderRadius: 7.5, alignItems: "center", justifyContent: "center" },
  medalText: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 8.5, color: INK },
  position: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 10 },
  status: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 7.5, color: "#dc2626" },
  plate: { borderRadius: 3, paddingVertical: 1.5, paddingHorizontal: 3, borderWidth: 0.5, borderColor: "#9ca3af" },
  plateText: { fontFamily: "Noto Sans Mono", fontWeight: 700, fontSize: 8, textAlign: "center" },
  points: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 10, textAlign: "right" },
  watermark: { position: "absolute", top: 360, left: -40, right: -40, textAlign: "center", fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 72, color: "#f59e0b", opacity: 0.08, transform: "rotate(-30deg)" },
  footer: { position: "absolute", bottom: 20, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 6, fontSize: 6.8, color: MUTED },
  signature: { width: 190, alignItems: "center" },
  signatureLine: { width: 170, borderBottomWidth: 0.6, borderBottomColor: "#9ca3af", marginBottom: 2, height: 14 },
});

// ─── Snapshot shapes (written by publish_results) ───
type SnapshotClass = { id: number; code: string; name: string; name_en: string | null };
type SnapshotEvent = { name: string; location: string; date_from: string; date_to: string; round_number: number | null };
type SnapshotStage = { name: string; name_en: string | null; type: string; day_number: number } | null;
type RiderFields = { entry_id: number; class_id: number; race_number: number; first_name: string; last_name: string; club: string | null; country: string };

export type NavigationRow = RiderFields & {
  scheduled_start: string | null;
  actual_start: string | null;
  finish_at: string | null;
  elapsed_s: number | null;
  adjustment_s: number;
  penalty_s: number;
  total_s: number | null;
  gap_s: number | null;
  result_status: string;
  position: number | null;
  points: number;
};
export type RoundRow = RiderFields & { position: number; total_points: number; day1_points: number; day2_points: number };
export type RoundTimeRow = RiderFields & {
  position: number | null;
  total_s: number | null;
  gap_s: number | null;
  penalty_s: number;
  result_status: string;
};
export type EnduroRow = RiderFields & { position: number | null; heat_points: number; points: number };
export type SessionRow = { entry_id: number; class_id: number; kind: string; number: number; laps: number; points: number; result_status: string };

export type Snapshot =
  | { kind: "navigation"; rows: NavigationRow[]; event: SnapshotEvent; stage: SnapshotStage; classes: SnapshotClass[] }
  | { kind: "round"; rows: RoundRow[]; event: SnapshotEvent; stage: null; classes: SnapshotClass[] }
  | { kind: "round_time"; rows: RoundTimeRow[]; event: SnapshotEvent; stage: null; classes: SnapshotClass[] }
  | { kind: "enduro_cross"; rows: EnduroRow[]; sessions: SessionRow[]; event: SnapshotEvent; stage: SnapshotStage; classes: SnapshotClass[] };

export type PublicationInfo = {
  state: "provisional" | "official";
  version: number;
  published_at: string;
  protest_deadline_at: string | null;
  published_by_name: string | null;
};

type Column<Row> = { label: string; width?: number; align?: "right" | "center"; render: (row: Row) => React.ReactNode };

/** A cell's content: strings become text; components (medals, plates) are placed as they are. */
function Cell({ children, align }: { children: React.ReactNode; align?: "right" | "center" }) {
  if (typeof children === "string" || typeof children === "number") {
    return <Text style={align ? { textAlign: align } : {}}>{children}</Text>;
  }
  return <View style={{ alignItems: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start" }}>{children}</View>;
}

function Table<Row extends { entry_id: number }>({ columns, rows, lead }: { columns: Column<Row>[]; rows: Row[]; lead?: React.ReactNode }) {
  const box = (column: Column<Row>) => (column.width ? [styles.cell, { width: column.width }] : styles.riderCell);
  return (
    <View>
      {lead}
      <View style={styles.headRow} minPresenceAhead={60} wrap={false}>
        {columns.map((column) => (
          <View key={column.label} style={box(column)}>
            <Text style={[styles.headText, column.align ? { textAlign: column.align } : {}]}>{column.label}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={row.entry_id} style={[styles.row, index % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
          {columns.map((column) => (
            <View key={column.label} style={box(column)}>
              <Cell align={column.align}>{column.render(row)}</Cell>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Medal({ position }: { position: number | null | undefined }) {
  if (position == null) return null;
  if (position <= 3) {
    return (
      <View style={[styles.medal, { backgroundColor: MEDALS[position - 1] }]}>
        <Text style={styles.medalText}>{position}</Text>
      </View>
    );
  }
  return <Text style={styles.position}>{position}</Text>;
}

function Plate({ number, code }: { number: number; code?: string }) {
  const plate = plateFor(code);
  return (
    <View style={[styles.plate, { backgroundColor: plate.bg, width: 26 }]}>
      <Text style={[styles.plateText, { color: plate.fg }]}>{number}</Text>
    </View>
  );
}

function RiderCell({ row, lang }: { row: RiderFields; lang: Locale }) {
  return (
    <View>
      <Text style={styles.riderName}>{riderName(row.first_name, row.last_name, lang)}</Text>
      {row.club && <Text style={styles.club}>{lang === "en" ? transliterate(row.club) : row.club}</Text>}
    </View>
  );
}

const mono = (value: string, bold = false, extra: Style = {}) => <Text style={[bold ? styles.monoBold : styles.mono, styles.right, extra]}>{value}</Text>;

function LogoMark() {
  return (
    <Svg width={14} height={14} viewBox="0 0 64 64">
      <Rect x="0" y="0" width="64" height="64" rx="16" fill={INK} />
      <Circle cx="32" cy="35" r="19" stroke={ACCENT} strokeWidth={5} fill="none" />
      <Rect x="28" y="7" width="8" height="6" rx="2" fill={ACCENT} />
      <Path d="M32 35 L32 22" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}

type Banner = { label: string; color: string; background: string; sub?: string };

function Masthead({ event }: { event: string }) {
  return (
    <>
      <View style={styles.strip} fixed>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <LogoMark />
          <Text style={[styles.wordmark, { marginLeft: 5 }]}>
            TODOROV<Text style={{ color: ACCENT }}>NET</Text>
          </Text>
        </View>
        <Text style={styles.stripText}>{event}</Text>
      </View>
      <View style={styles.stripAccent} fixed />
    </>
  );
}

function Header({
  lang,
  dict,
  event,
  heading,
  title,
  subtitle,
  publication,
}: {
  lang: Locale;
  dict: Dictionary;
  event?: SnapshotEvent;
  /** Replaces the event name and meta line on documents that are not about one event. */
  heading?: { name: string; meta: string };
  title: string;
  subtitle?: string;
  publication: PublicationInfo | null | "none";
}) {
  const text = (value: string) => (lang === "en" ? transliterate(value) : value);
  const name = heading ? heading.name : event ? text(event.name) : "";
  const meta = heading
    ? heading.meta
    : event
      ? [text(event.location), formatDateRange(event.date_from, event.date_to, lang)].filter(Boolean).join(" · ")
      : "";
  // "none": documents that are not results (a start list, season standings) carry no results status.
  const banner: Banner | null =
    publication === "none"
      ? null
      : publication
        ? publication.state === "official"
          ? { label: dict.pdf.official, color: "#15803d", background: "#ecfdf3" }
          : { label: dict.pdf.provisional, color: "#b45309", background: "#fffbeb" }
        : { label: dict.publication.live.toUpperCase(), color: "#4b5563", background: "#f3f4f6" };
  const published =
    publication && publication !== "none"
      ? [
          t(dict.pdf.published, { time: formatClock(publication.published_at), version: publication.version }),
          publication.protest_deadline_at ? t(dict.pdf.protestDeadline, { time: formatClock(publication.protest_deadline_at) }) : null,
        ].filter(Boolean)
      : [];

  return (
    <>
      <Masthead event={name} />
      {banner && (publication === null || (publication !== "none" && publication.state !== "official")) && (
        <Text style={styles.watermark} fixed>
          {banner.label}
        </Text>
      )}
      <View style={styles.hero}>
        <View style={{ flexGrow: 1, flexBasis: 0, paddingRight: 12 }}>
          <Text style={styles.kicker}>
            {["BG-X", event?.round_number ? t(dict.home.round, { n: event.round_number }) : null].filter(Boolean).join("  ·  ")}
          </Text>
          <Text style={styles.eventName}>{name}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          <Text style={styles.docTitle}>
            {title}
            {subtitle ? <Text style={{ color: MUTED, fontWeight: 600 }}>{`  ·  ${subtitle}`}</Text> : null}
          </Text>
        </View>
        {banner && (
          <View style={[styles.stamp, { borderColor: banner.color, backgroundColor: banner.background }]}>
            <Text style={[styles.stampLabel, { color: banner.color }]}>{banner.label}</Text>
            {published.map((line) => (
              <Text key={line} style={[styles.stampSub, { color: banner.color }]}>
                {line}
              </Text>
            ))}
          </View>
        )}
      </View>
    </>
  );
}

function Footer({ dict, generatedAt, signer }: { dict: Dictionary; generatedAt: string; signer: string | null }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{t(dict.pdf.generated, { time: generatedAt })}</Text>
      <View style={styles.signature}>
        <View style={styles.signatureLine}>
          {signer ? <Text style={{ fontSize: 8, color: INK, textAlign: "center", marginTop: 3 }}>{signer}</Text> : null}
        </View>
        <Text>{dict.pdf.chiefReferee}</Text>
      </View>
      <Text render={({ pageNumber, totalPages }) => t(dict.pdf.page, { page: pageNumber, total: totalPages })} />
    </View>
  );
}

function ClassSections<Row extends { class_id: number }>({
  lang,
  dict,
  classes,
  rows,
  sort,
  table,
}: {
  lang: Locale;
  dict: Dictionary;
  classes: SnapshotClass[];
  rows: Row[];
  sort: (a: Row, b: Row) => number;
  table: (rows: Row[], cls: SnapshotClass) => React.ReactNode;
}) {
  const table_ = table;
  return (
    <>
      {classes.map((cls) => {
        const classRows = rows.filter((row) => row.class_id === cls.id).sort(sort);
        if (!classRows.length) return null;
        const plate = plateFor(cls.code);
        const bar = (
          <View style={styles.classBar}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.swatch, { backgroundColor: plate.bg }]} />
              <Text style={styles.className}>{localizedName(cls, lang)}</Text>
            </View>
            <Text style={styles.classCount}>{t(dict.pdf.riders, { n: classRows.length })}</Text>
          </View>
        );
        const table = table_(classRows, cls);
        return (
          // A class that fits on a page is kept whole, so its heading never ends up alone at the bottom.
          <View key={cls.id} wrap={classRows.length > KEEP_WHOLE}>
            {isValidElement<{ lead?: React.ReactNode }>(table) ? cloneElement(table, { lead: bar }) : table}
          </View>
        );
      })}
    </>
  );
}

const KEEP_WHOLE = 18;

const STATUS_ORDER = ["classified", "on_course", "nc", "dnf", "dns", "dsq"];

function riderCell(lang: Locale) {
  return function RiderColumn(row: RiderFields) {
    return <RiderCell row={row} lang={lang} />;
  };
}

export function ResultsDocument({
  lang,
  dict,
  snapshot,
  publication,
  generatedAt,
}: {
  lang: Locale;
  dict: Dictionary;
  snapshot: Snapshot;
  publication: PublicationInfo | null;
  generatedAt: string;
}) {
  const r = dict.results;
  const status = (value: string) => <Text style={styles.status}>{dict.status[value as keyof Dictionary["status"]] ?? value}</Text>;
  const labels = { day: dict.event.day, stageType: dict.stageType };
  const subtitle = snapshot.stage ? stageName(snapshot.stage, lang, labels) : undefined;
  const points = (value: number) => (value ? <Text style={[styles.points, { color: ACCENT }]}>{value}</Text> : "");
  const byStatus = <Row extends { result_status: string; position: number | null; race_number: number }>(a: Row, b: Row) =>
    STATUS_ORDER.indexOf(a.result_status) - STATUS_ORDER.indexOf(b.result_status) ||
    (a.position ?? 0) - (b.position ?? 0) ||
    a.race_number - b.race_number;

  let title: string;
  let body: React.ReactNode;

  if (snapshot.kind === "navigation") {
    title = dict.pdf.navigation;
    body = (
      <ClassSections
        lang={lang}
        dict={dict}
        classes={snapshot.classes}
        rows={snapshot.rows}
        sort={byStatus}
        table={(rows, cls) => (
          <Table<NavigationRow>
            rows={rows}
            columns={[
              { label: r.pos, width: 28, align: "center", render: (x) => (x.result_status === "classified" ? <Medal position={x.position} /> : status(x.result_status)) },
              { label: r.number, width: 34, align: "center", render: (x) => <Plate number={x.race_number} code={cls.code} /> },
              { label: r.rider, render: riderCell(lang) },
              { label: r.start, width: 46, align: "right", render: (x) => (x.scheduled_start ? mono(formatClock(x.scheduled_start)) : "") },
              { label: r.finish, width: 46, align: "right", render: (x) => (x.finish_at ? mono(formatClock(x.finish_at)) : "") },
              { label: dict.pdf.penalty, width: 44, align: "right", render: (x) => (x.penalty_s ? mono(`+${formatDuration(x.penalty_s)}`, false, styles.penalty) : "") },
              { label: dict.pdf.adjustment, width: 42, align: "right", render: (x) => (x.adjustment_s ? mono(formatDuration(x.adjustment_s), false, styles.muted) : "") },
              { label: r.total, width: 58, align: "right", render: (x) => (x.total_s != null && x.result_status !== "dnf" ? mono(formatDuration(x.total_s, { tenths: true }), true) : "") },
              { label: r.gap, width: 46, align: "right", render: (x) => (x.result_status === "classified" && x.position !== 1 ? mono(formatGap(x.gap_s), false, styles.muted) : "") },
              { label: r.points, width: 24, align: "right", render: (x) => points(x.points) },
            ]}
          />
        )}
      />
    );
  } else if (snapshot.kind === "round_time") {
    title = dict.pdf.round;
    body = (
      <ClassSections
        lang={lang}
        dict={dict}
        classes={snapshot.classes}
        rows={snapshot.rows}
        sort={byStatus}
        table={(rows, cls) => (
          <Table<RoundTimeRow>
            rows={rows}
            columns={[
              { label: r.pos, width: 28, align: "center", render: (x) => (x.result_status === "classified" ? <Medal position={x.position} /> : status(x.result_status)) },
              { label: r.number, width: 34, align: "center", render: (x) => <Plate number={x.race_number} code={cls.code} /> },
              { label: r.rider, render: riderCell(lang) },
              { label: dict.pdf.penalty, width: 50, align: "right", render: (x) => (x.penalty_s ? mono(`+${formatDuration(x.penalty_s)}`, false, styles.penalty) : "") },
              { label: r.total, width: 64, align: "right", render: (x) => (x.result_status === "classified" ? mono(formatDuration(x.total_s, { tenths: true }), true) : "") },
              { label: r.gap, width: 54, align: "right", render: (x) => (x.result_status === "classified" && x.position !== 1 ? mono(formatGap(x.gap_s), false, styles.muted) : "") },
            ]}
          />
        )}
      />
    );
  } else if (snapshot.kind === "round") {
    title = dict.pdf.round;
    body = (
      <ClassSections
        lang={lang}
        dict={dict}
        classes={snapshot.classes}
        rows={snapshot.rows}
        sort={(a, b) => a.position - b.position || a.race_number - b.race_number}
        table={(rows, cls) => (
          <Table<RoundRow>
            rows={rows}
            columns={[
              { label: r.pos, width: 28, align: "center", render: (x) => (x.total_points ? <Medal position={x.position} /> : "") },
              { label: r.number, width: 34, align: "center", render: (x) => <Plate number={x.race_number} code={cls.code} /> },
              { label: r.rider, render: riderCell(lang) },
              { label: t(dict.event.day, { n: 1 }), width: 50, align: "right", render: (x) => (x.day1_points ? mono(`${x.day1_points}`) : mono("–", false, styles.muted)) },
              { label: t(dict.event.day, { n: 2 }), width: 50, align: "right", render: (x) => (x.day2_points ? mono(`${x.day2_points}`) : mono("–", false, styles.muted)) },
              { label: r.total, width: 44, align: "right", render: (x) => points(x.total_points) },
            ]}
          />
        )}
      />
    );
  } else {
    title = dict.pdf.enduroCross;
    const heats = [...new Set(snapshot.sessions.filter((s) => s.kind === "heat").map((s) => s.number))].sort((a, b) => a - b);
    body = (
      <ClassSections
        lang={lang}
        dict={dict}
        classes={snapshot.classes}
        rows={snapshot.rows}
        sort={(a, b) => (a.position ?? 999) - (b.position ?? 999) || a.race_number - b.race_number}
        table={(rows, cls) => (
          <Table<EnduroRow>
            rows={rows}
            columns={[
              { label: r.pos, width: 28, align: "center", render: (x) => (x.position ? <Medal position={x.position} /> : "") },
              { label: r.number, width: 34, align: "center", render: (x) => <Plate number={x.race_number} code={cls.code} /> },
              { label: r.rider, render: riderCell(lang) },
              ...heats.map((n) => ({
                label: t(dict.pdf.heat, { n }),
                width: 70,
                align: "right" as const,
                render: (x: EnduroRow) => {
                  const heat = snapshot.sessions.find((s) => s.entry_id === x.entry_id && s.kind === "heat" && s.number === n);
                  if (!heat) return "";
                  if (heat.result_status !== "classified") return status(heat.result_status);
                  return (
                    <Text style={styles.right}>
                      <Text style={styles.monoBold}>{heat.points}</Text>
                      <Text style={[styles.mono, styles.muted]}>{`  ${t(dict.pdf.lapsShort, { n: heat.laps })}`}</Text>
                    </Text>
                  );
                },
              })),
              { label: "Σ", width: 30, align: "right", render: (x) => mono(`${x.heat_points}`) },
              { label: r.points, width: 28, align: "right", render: (x) => points(x.points) },
            ]}
          />
        )}
      />
    );
  }

  return (
    <Document title={title} author="TodorovNET" language={lang}>
      <Page size="A4" style={styles.page}>
        <Header lang={lang} dict={dict} event={snapshot.event} title={title} subtitle={subtitle} publication={publication} />
        {body}
        <Footer dict={dict} generatedAt={generatedAt} signer={publication?.state === "official" ? publication.published_by_name : null} />
      </Page>
    </Document>
  );
}

type SeasonRow = RiderFields & { position: number; gross_points: number; net_points: number; rounds: Record<number, number> };
type TeamRow = { entry_id: number; class_id: number; club: string; position: number; team_points: number; rounds: Record<number, number> };

export function SeasonDocument({
  lang,
  dict,
  data,
  view,
  generatedAt,
}: {
  lang: Locale;
  dict: Dictionary;
  data: SeasonStandings;
  view: "riders" | "teams";
  generatedAt: string;
}) {
  const s = dict.season;
  const text = (value: string) => (lang === "en" ? transliterate(value) : value);
  const roundColumns = <Row extends { rounds: Record<number, number> }>(): Column<Row & { entry_id: number }>[] =>
    data.rounds.map((round) => ({
      label: t(s.round, { n: round.round_number ?? "?" }),
      width: 32,
      align: "right" as const,
      render: (row: Row) => (row.rounds[round.id] != null ? mono(`${row.rounds[round.id]}`) : mono("–", false, styles.muted)),
    }));

  const title = t(s.heading, { year: data.season.year });
  const note = view === "teams" ? s.teamNote : data.dropApplies ? s.finalNote : t(s.interimNote, { n: data.season.drop_worst_rounds + 1 });
  const points = (value: number) => <Text style={[styles.points, { color: ACCENT }]}>{value}</Text>;

  let body: React.ReactNode;
  if (view === "teams") {
    const rows: TeamRow[] = data.teams.map((team) => ({ ...team, entry_id: team.club_id, class_id: 0 }));
    body = (
      <Table<TeamRow>
        rows={rows}
        columns={[
          { label: dict.results.pos, width: 28, align: "center", render: (x) => <Medal position={x.position} /> },
          { label: s.club, render: (x) => <Text style={styles.riderName}>{text(x.club)}</Text> },
          ...roundColumns<TeamRow>(),
          { label: dict.results.total, width: 44, align: "right", render: (x) => points(x.team_points) },
        ]}
      />
    );
  } else {
    const rows: SeasonRow[] = data.riders.map((rider) => ({ ...rider, entry_id: rider.rider_id, race_number: 0, country: "" }));
    body = (
      <ClassSections
        lang={lang}
        dict={dict}
        classes={data.classes}
        rows={rows}
        sort={(a, b) => a.position - b.position}
        table={(classRows) => (
          <Table<SeasonRow>
            rows={classRows}
            columns={[
              { label: dict.results.pos, width: 28, align: "center", render: (x) => <Medal position={x.position} /> },
              { label: dict.results.rider, render: riderCell(lang) },
              ...roundColumns<SeasonRow>(),
              { label: s.gross, width: 38, align: "right", render: (x) => (data.dropApplies ? mono(`${x.gross_points}`, false, styles.muted) : points(x.gross_points)) },
              ...(data.dropApplies ? [{ label: s.net, width: 58, align: "right" as const, render: (x: SeasonRow) => points(x.net_points) }] : []),
            ]}
          />
        )}
      />
    );
  }

  return (
    <Document title={title} author="TodorovNET" language={lang}>
      <Page size="A4" style={styles.page}>
        <Header
          lang={lang}
          dict={dict}
          heading={{ name: title, meta: data.season.name }}
          title={view === "teams" ? s.team : s.individual}
          publication="none"
        />
        <Text style={styles.note}>{note}</Text>
        {body}
        <Footer dict={dict} generatedAt={generatedAt} signer={null} />
      </Page>
    </Document>
  );
}

export type StartListRow = RiderFields & { position: number; scheduled_start: string };

export function StartListDocument({
  lang,
  dict,
  event,
  stage,
  classes,
  rows,
  generatedAt,
}: {
  lang: Locale;
  dict: Dictionary;
  event: SnapshotEvent;
  stage: NonNullable<SnapshotStage>;
  classes: SnapshotClass[];
  rows: StartListRow[];
  generatedAt: string;
}) {
  const r = dict.results;
  const firstPosition = (classId: number) => Math.min(...rows.filter((row) => row.class_id === classId).map((row) => row.position));
  const ordered = [...classes].sort((a, b) => firstPosition(a.id) - firstPosition(b.id));
  return (
    <Document title={dict.pdf.startList} author="TodorovNET" language={lang}>
      <Page size="A4" style={styles.page}>
        <Header
          lang={lang}
          dict={dict}
          event={event}
          title={dict.pdf.startList}
          subtitle={stageName(stage, lang, { day: dict.event.day, stageType: dict.stageType })}
          publication="none"
        />
        <ClassSections
          lang={lang}
          dict={dict}
          classes={ordered}
          rows={rows}
          sort={(a, b) => a.position - b.position}
          table={(classRows, cls) => (
            <Table<StartListRow>
              rows={classRows}
              columns={[
                { label: "#", width: 26, align: "right", render: (x) => mono(`${x.position}`, false, styles.muted) },
                { label: r.start, width: 62, align: "right", render: (x) => mono(formatClock(x.scheduled_start), true, { fontSize: 10 }) },
                { label: r.number, width: 40, align: "center", render: (x) => <Plate number={x.race_number} code={cls.code} /> },
                { label: r.rider, render: riderCell(lang) },
              ]}
            />
          )}
        />
        <Footer dict={dict} generatedAt={generatedAt} signer={null} />
      </Page>
    </Document>
  );
}
