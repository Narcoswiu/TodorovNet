import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localizedName, riderName, stageName, transliterate } from "@/i18n/localize";
import { formatClock, formatDateRange, formatDuration, formatGap } from "@/lib/format";

// Official result sheets, rendered on the server. Layout follows the documents officials already know
// (per class, position, number, rider, times, points) with a status banner, version and signature line.

const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 48, paddingHorizontal: 28, fontFamily: "Noto Sans", fontSize: 8, color: "#111" },
  eventName: { fontSize: 14, fontWeight: 700 },
  meta: { fontSize: 9, color: "#444", marginTop: 2 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10, marginBottom: 8 },
  title: { fontSize: 12, fontWeight: 700 },
  banner: { fontSize: 9, fontWeight: 700, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 2 },
  bannerProvisional: { backgroundColor: "#fff4e5", color: "#9a5b00" },
  bannerOfficial: { backgroundColor: "#e7f6ec", color: "#166534" },
  bannerLive: { backgroundColor: "#eeeeee", color: "#444" },
  publishLine: { fontSize: 8, color: "#444", marginBottom: 8 },
  classHeading: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: "#111" },
  headRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999", paddingVertical: 2, color: "#555" },
  row: { flexDirection: "row", borderBottomWidth: 0.3, borderBottomColor: "#ddd", paddingVertical: 2.5 },
  rider: { flexGrow: 1, flexBasis: 0, paddingLeft: 8, paddingRight: 4 },
  cellGap: { paddingLeft: 4 },
  club: { fontSize: 7, color: "#666" },
  right: { textAlign: "right" },
  bold: { fontWeight: 700 },
  footer: { position: "absolute", bottom: 20, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#555" },
  signature: { width: 180, borderTopWidth: 0.5, borderTopColor: "#555", paddingTop: 2, textAlign: "center" },
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
export type EnduroRow = RiderFields & { position: number | null; heat_points: number; points: number };
export type SessionRow = { entry_id: number; class_id: number; kind: string; number: number; laps: number; points: number; result_status: string };

export type Snapshot =
  | { kind: "navigation"; rows: NavigationRow[]; event: SnapshotEvent; stage: SnapshotStage; classes: SnapshotClass[] }
  | { kind: "round"; rows: RoundRow[]; event: SnapshotEvent; stage: null; classes: SnapshotClass[] }
  | { kind: "enduro_cross"; rows: EnduroRow[]; sessions: SessionRow[]; event: SnapshotEvent; stage: SnapshotStage; classes: SnapshotClass[] };

export type PublicationInfo = {
  state: "provisional" | "official";
  version: number;
  published_at: string;
  protest_deadline_at: string | null;
  published_by_name: string | null;
};

type Column<Row> = { label: string; width?: number; align?: "right"; render: (row: Row) => string; bold?: boolean };

function Table<Row extends { entry_id: number }>({ columns, rows }: { columns: Column<Row>[]; rows: Row[] }) {
  const cellStyle = (column: Column<Row>) => [
    column.width ? [{ width: column.width }, styles.cellGap] : styles.rider,
    column.align === "right" ? styles.right : {},
    column.bold ? styles.bold : {},
  ];
  return (
    <View>
      <View style={styles.headRow} fixed>
        {columns.map((column) => (
          <Text key={column.label} style={cellStyle(column)}>
            {column.label}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.entry_id} style={styles.row} wrap={false}>
          {columns.map((column) => (
            <Text key={column.label} style={cellStyle(column)}>
              {column.render(row)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Header({
  lang,
  dict,
  event,
  title,
  subtitle,
  publication,
}: {
  lang: Locale;
  dict: Dictionary;
  event: SnapshotEvent;
  title: string;
  subtitle?: string;
  publication: PublicationInfo | null | "none";
}) {
  const text = (value: string) => (lang === "en" ? transliterate(value) : value);
  // "none": documents that are not results (a start list) carry no results status.
  const banner =
    publication === "none"
      ? null
      : publication
        ? publication.state === "official"
          ? { label: dict.pdf.official, style: styles.bannerOfficial }
          : { label: dict.pdf.provisional, style: styles.bannerProvisional }
        : { label: dict.publication.live.toUpperCase(), style: styles.bannerLive };
  return (
    <View>
      <Text style={styles.eventName}>{text(event.name)}</Text>
      <Text style={styles.meta}>
        {[
          event.round_number ? t(dict.home.round, { n: event.round_number }) : null,
          text(event.location),
          formatDateRange(event.date_from, event.date_to, lang),
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.meta}>{subtitle}</Text>}
        </View>
        {banner && <Text style={[styles.banner, banner.style]}>{banner.label}</Text>}
      </View>
      {publication && publication !== "none" && (
        <Text style={styles.publishLine}>
          {t(dict.pdf.published, { time: formatClock(publication.published_at), version: publication.version })}
          {publication.protest_deadline_at ? ` · ${t(dict.pdf.protestDeadline, { time: formatClock(publication.protest_deadline_at) })}` : ""}
        </Text>
      )}
    </View>
  );
}

function Footer({ dict, generatedAt, signer }: { dict: Dictionary; generatedAt: string; signer: string | null }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{t(dict.pdf.generated, { time: generatedAt })}</Text>
      <Text style={styles.signature}>
        {dict.pdf.chiefReferee}
        {signer ? `: ${signer}` : ""}
      </Text>
      <Text render={({ pageNumber, totalPages }) => t(dict.pdf.page, { page: pageNumber, total: totalPages })} />
    </View>
  );
}

function ClassSections<Row extends RiderFields>({
  lang,
  classes,
  rows,
  sort,
  table,
}: {
  lang: Locale;
  classes: SnapshotClass[];
  rows: Row[];
  sort: (a: Row, b: Row) => number;
  table: (rows: Row[]) => React.ReactNode;
}) {
  return (
    <>
      {classes.map((cls) => {
        const classRows = rows.filter((row) => row.class_id === cls.id).sort(sort);
        if (!classRows.length) return null;
        return (
          <View key={cls.id} wrap>
            <Text style={styles.classHeading} minPresenceAhead={40}>
              {localizedName(cls, lang)}
            </Text>
            {table(classRows)}
          </View>
        );
      })}
    </>
  );
}

const STATUS_ORDER = ["classified", "on_course", "nc", "dnf", "dns", "dsq"];

const riderCell = (lang: Locale) => (row: RiderFields) =>
  `${riderName(row.first_name, row.last_name, lang)}${row.club ? `  ·  ${lang === "en" ? transliterate(row.club) : row.club}` : ""}`;

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
  const status = (value: string) => dict.status[value as keyof Dictionary["status"]] ?? value;
  const labels = { day: dict.event.day, stageType: dict.stageType };
  const subtitle = snapshot.stage ? stageName(snapshot.stage, lang, labels) : undefined;

  let title: string;
  let body: React.ReactNode;

  if (snapshot.kind === "navigation") {
    title = dict.pdf.navigation;
    body = (
      <ClassSections
        lang={lang}
        classes={snapshot.classes}
        rows={snapshot.rows}
        sort={(a, b) =>
          STATUS_ORDER.indexOf(a.result_status) - STATUS_ORDER.indexOf(b.result_status) ||
          (a.position ?? 0) - (b.position ?? 0) ||
          a.race_number - b.race_number
        }
        table={(rows) => (
          <Table<NavigationRow>
            rows={rows}
            columns={[
              { label: r.pos, width: 26, align: "right", bold: true, render: (x) => (x.result_status === "classified" ? `${x.position}` : status(x.result_status)) },
              { label: r.number, width: 30, align: "right", render: (x) => `${x.race_number}` },
              { label: r.rider, render: riderCell(lang) },
              { label: r.start, width: 44, align: "right", render: (x) => (x.scheduled_start ? formatClock(x.scheduled_start) : "") },
              { label: r.finish, width: 44, align: "right", render: (x) => (x.finish_at ? formatClock(x.finish_at) : "") },
              { label: dict.pdf.elapsed, width: 48, align: "right", render: (x) => (x.elapsed_s != null ? formatDuration(x.elapsed_s) : "") },
              { label: dict.pdf.penalty, width: 42, align: "right", render: (x) => (x.penalty_s ? `+${formatDuration(x.penalty_s)}` : "") },
              { label: dict.pdf.adjustment, width: 42, align: "right", render: (x) => (x.adjustment_s ? formatDuration(x.adjustment_s) : "") },
              { label: r.total, width: 52, align: "right", bold: true, render: (x) => (x.total_s != null && x.result_status !== "dnf" ? formatDuration(x.total_s, { tenths: true }) : "") },
              { label: r.gap, width: 42, align: "right", render: (x) => (x.result_status === "classified" ? formatGap(x.gap_s) : "") },
              { label: r.points, width: 22, align: "right", bold: true, render: (x) => (x.points ? `${x.points}` : "") },
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
        classes={snapshot.classes}
        rows={snapshot.rows}
        sort={(a, b) => a.position - b.position || a.race_number - b.race_number}
        table={(rows) => (
          <Table<RoundRow>
            rows={rows}
            columns={[
              { label: r.pos, width: 26, align: "right", bold: true, render: (x) => (x.total_points ? `${x.position}` : "") },
              { label: r.number, width: 30, align: "right", render: (x) => `${x.race_number}` },
              { label: r.rider, render: riderCell(lang) },
              { label: t(dict.event.day, { n: 1 }), width: 46, align: "right", render: (x) => (x.day1_points ? `${x.day1_points}` : "") },
              { label: t(dict.event.day, { n: 2 }), width: 46, align: "right", render: (x) => (x.day2_points ? `${x.day2_points}` : "") },
              { label: r.total, width: 46, align: "right", bold: true, render: (x) => (x.total_points ? `${x.total_points}` : "") },
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
        classes={snapshot.classes}
        rows={snapshot.rows}
        sort={(a, b) => (a.position ?? 999) - (b.position ?? 999) || a.race_number - b.race_number}
        table={(rows) => (
          <Table<EnduroRow>
            rows={rows}
            columns={[
              { label: r.pos, width: 26, align: "right", bold: true, render: (x) => (x.position ? `${x.position}` : "") },
              { label: r.number, width: 30, align: "right", render: (x) => `${x.race_number}` },
              { label: r.rider, render: riderCell(lang) },
              ...heats.map((n) => ({
                label: t(dict.pdf.heat, { n }),
                width: 60,
                align: "right" as const,
                render: (x: EnduroRow) => {
                  const heat = snapshot.sessions.find((s) => s.entry_id === x.entry_id && s.kind === "heat" && s.number === n);
                  if (!heat) return "";
                  return heat.result_status === "classified" ? `${heat.points} (${heat.laps} ${r.laps.toLowerCase()})` : status(heat.result_status);
                },
              })),
              { label: "Σ", width: 30, align: "right", render: (x) => `${x.heat_points}` },
              { label: r.points, width: 26, align: "right", bold: true, render: (x) => (x.points ? `${x.points}` : "") },
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
          classes={ordered}
          rows={rows}
          sort={(a, b) => a.position - b.position}
          table={(classRows) => (
            <Table<StartListRow>
              rows={classRows}
              columns={[
                { label: "#", width: 26, align: "right", render: (x) => `${x.position}` },
                { label: r.start, width: 50, align: "right", bold: true, render: (x) => formatClock(x.scheduled_start) },
                { label: r.number, width: 34, align: "right", bold: true, render: (x) => `${x.race_number}` },
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
