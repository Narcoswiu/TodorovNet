import path from "node:path";
import { Circle, Document, Font, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { Locale } from "@/i18n/config";
import type { Manual, ManualSection } from "@/i18n/manual/types";

// The officials' manual as a printable booklet: the same text as the website, laid out for A4 so it can
// be handed out at a riders' briefing or sent to the federation.

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

// The print fonts carry letters, not pictures: emoji and arrows would come out as blanks.
const plain = (value: string) =>
  value
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, (match) =>
      match === "\u2192" ? ">" : match === "\u2713" ? "" : "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();

const INK = "#0b0d10";
const ACCENT = "#ff6a13";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 54, paddingHorizontal: 46, fontFamily: "Noto Sans", fontSize: 9.5, lineHeight: 1.45, color: INK },
  strip: { position: "absolute", top: 0, left: 0, right: 0, height: 24, backgroundColor: INK, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 46 },
  stripAccent: { position: "absolute", top: 24, left: 0, right: 0, height: 2, backgroundColor: ACCENT },
  wordmark: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 10, color: "#ffffff", letterSpacing: 0.6 },
  stripText: { fontSize: 7, color: "#9aa3ad" },
  kicker: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 8.5, color: ACCENT, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 30, lineHeight: 1.05, marginTop: 6 },
  subtitle: { fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.5 },
  tocTitle: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 24, marginBottom: 6 },
  tocRow: { flexDirection: "row", alignItems: "baseline", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3.5 },
  tocNumber: { fontFamily: "Noto Sans Condensed", fontWeight: 700, width: 18, color: ACCENT },
  chapterHead: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, marginTop: 4 },
  chapterNumber: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 22, color: ACCENT, width: 26 },
  chapterTitle: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 17, lineHeight: 1.15, textTransform: "uppercase", letterSpacing: 0.4 },
  chapterSummary: { fontSize: 9, lineHeight: 1.35, color: MUTED, marginTop: 2 },
  sectionTitle: { fontWeight: 700, fontSize: 10.5, marginTop: 12, marginBottom: 4 },
  paragraph: { marginTop: 3 },
  step: { flexDirection: "row", marginTop: 3.5 },
  stepNumber: { fontFamily: "Noto Sans Condensed", fontWeight: 700, width: 14, color: ACCENT },
  bullet: { flexDirection: "row", marginTop: 3 },
  dot: { width: 10, color: ACCENT },
  callout: { marginTop: 7, padding: 7, borderRadius: 4, borderLeftWidth: 3 },
  tip: { backgroundColor: "#ecfdf3", borderLeftColor: "#15803d" },
  warning: { backgroundColor: "#fffbeb", borderLeftColor: "#b45309" },
  calloutLabel: { fontWeight: 700 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 3, marginTop: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: LINE, paddingVertical: 3 },
  taskCell: { flexGrow: 1, flexBasis: 0, paddingRight: 6 },
  markCell: { width: 62, alignItems: "center" },
  markDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#15803d" },
  headText: { fontSize: 6.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.2, textAlign: "center" },
  checkGroup: { marginTop: 10 },
  checkTitle: { fontFamily: "Noto Sans Condensed", fontWeight: 700, fontSize: 11, color: ACCENT, textTransform: "uppercase" },
  checkItem: { flexDirection: "row", marginTop: 3 },
  box: { width: 9, height: 9, borderWidth: 0.8, borderColor: MUTED, borderRadius: 1.5, marginRight: 6, marginTop: 2 },
  question: { fontWeight: 700, marginTop: 8 },
  footer: { position: "absolute", bottom: 20, left: 46, right: 46, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 6, fontSize: 7, color: MUTED },
});

function Masthead({ title }: { title: string }) {
  return (
    <>
      <View style={s.strip} fixed>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Svg width={14} height={14} viewBox="0 0 64 64">
            <Rect x="0" y="0" width="64" height="64" rx="16" fill={INK} />
            <Circle cx="32" cy="35" r="19" stroke={ACCENT} strokeWidth={5} fill="none" />
            <Rect x="28" y="7" width="8" height="6" rx="2" fill={ACCENT} />
            <Path d="M32 35 L32 22" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" />
          </Svg>
          <Text style={[s.wordmark, { marginLeft: 5 }]}>
            TODOROV<Text style={{ color: ACCENT }}>NET</Text>
          </Text>
        </View>
        <Text style={s.stripText}>{plain(title)}</Text>
      </View>
      <View style={s.stripAccent} fixed />
    </>
  );
}

function Section({ section, manual }: { section: ManualSection; manual: Manual }) {
  return (
    <View wrap>
      <Text style={s.sectionTitle} minPresenceAhead={40}>
        {plain(section.title)}
      </Text>
      {section.text?.map((paragraph) => (
        <Text key={paragraph} style={s.paragraph}>
          {plain(paragraph)}
        </Text>
      ))}
      {section.steps?.map((step, index) => (
        <View key={step} style={s.step} wrap={false}>
          <Text style={s.stepNumber}>{index + 1}.</Text>
          <Text style={{ flexGrow: 1, flexBasis: 0 }}>{plain(step)}</Text>
        </View>
      ))}
      {section.bullets?.map((bullet) => (
        <View key={bullet} style={s.bullet} wrap={false}>
          <Text style={s.dot}>-</Text>
          <Text style={{ flexGrow: 1, flexBasis: 0 }}>{plain(bullet)}</Text>
        </View>
      ))}
      {section.tip && (
        <Text style={[s.callout, s.tip]}>
          <Text style={s.calloutLabel}>{manual.tipLabel}: </Text>
          {plain(section.tip)}
        </Text>
      )}
      {section.warning && (
        <Text style={[s.callout, s.warning]}>
          <Text style={s.calloutLabel}>{manual.warningLabel}: </Text>
          {plain(section.warning)}
        </Text>
      )}
    </View>
  );
}

export function ManualDocument({ lang, manual, generatedAt }: { lang: Locale; manual: Manual; generatedAt: string }) {
  return (
    <Document title={manual.title} author="TodorovNET" language={lang}>
      <Page size="A4" style={s.page}>
        <Masthead title={manual.title} />

        <Text style={s.kicker}>{plain(manual.updated)}</Text>
        <Text style={s.title}>{plain(manual.title)}</Text>
        <Text style={s.subtitle}>{plain(manual.subtitle)}</Text>

        <Text style={s.tocTitle}>{plain(manual.contents)}</Text>
        {manual.chapters.map((chapter, index) => (
          <View key={chapter.id} style={s.tocRow} wrap={false}>
            <Text style={s.tocNumber}>{index + 1}</Text>
            <Text style={{ flexGrow: 1, flexBasis: 0, fontWeight: 700 }}>{plain(chapter.title)}</Text>
            <Text style={{ color: MUTED, fontSize: 8.5 }}>{plain(chapter.summary)}</Text>
          </View>
        ))}
        {[manual.roles.title, manual.checklist.title, manual.faq.title].map((title) => (
          <View key={title} style={s.tocRow} wrap={false}>
            <Text style={s.tocNumber}>-</Text>
            <Text style={{ flexGrow: 1, flexBasis: 0, fontWeight: 700 }}>{plain(title)}</Text>
          </View>
        ))}

        {manual.chapters.map((chapter, index) => (
          <View key={chapter.id} break={index === 0} wrap>
            <View style={s.chapterHead} wrap={false} minPresenceAhead={60}>
              <Text style={s.chapterNumber}>{index + 1}</Text>
              <View style={{ flexGrow: 1, flexBasis: 0 }}>
                <Text style={s.chapterTitle}>{plain(chapter.title)}</Text>
                <Text style={s.chapterSummary}>{plain(chapter.summary)}</Text>
              </View>
            </View>
            {chapter.sections.map((section) => (
              <Section key={section.title} section={section} manual={manual} />
            ))}
          </View>
        ))}

        <View break wrap>
          <View style={s.chapterHead} wrap={false}>
            <Text style={s.chapterNumber}>A</Text>
            <View style={{ flexGrow: 1, flexBasis: 0 }}>
              <Text style={s.chapterTitle}>{plain(manual.roles.title)}</Text>
              <Text style={s.chapterSummary}>{plain(manual.roles.intro)}</Text>
            </View>
          </View>
          <View style={s.tableHead} wrap={false}>
            <Text style={[s.taskCell, s.headText]} />
            {manual.roles.columns.map((column) => (
              <Text key={column} style={[s.markCell, s.headText]}>
                {plain(column)}
              </Text>
            ))}
          </View>
          {manual.roles.rows.map((row) => (
            <View key={row.task} style={s.tableRow} wrap={false}>
              <Text style={s.taskCell}>{plain(row.task)}</Text>
              {row.marks.map((mark, index) => (
                <View key={index} style={s.markCell}>
                  {mark ? <View style={s.markDot} /> : <Text style={{ color: LINE }}>·</Text>}
                </View>
              ))}
            </View>
          ))}
          <Text style={[s.paragraph, { fontSize: 8, color: MUTED, marginTop: 6 }]}>{plain(manual.roles.legend)}</Text>
        </View>

        <View style={{ marginTop: 18 }} wrap>
          <View style={s.chapterHead} wrap={false}>
            <Text style={s.chapterNumber}>B</Text>
            <Text style={[s.chapterTitle, { flexGrow: 1, flexBasis: 0 }]}>{plain(manual.checklist.title)}</Text>
          </View>
          {manual.checklist.groups.map((group) => (
            <View key={group.title} style={s.checkGroup} wrap={false}>
              <Text style={s.checkTitle}>{plain(group.title)}</Text>
              {group.items.map((item) => (
                <View key={item} style={s.checkItem}>
                  <View style={s.box} />
                  <Text style={{ flexGrow: 1, flexBasis: 0 }}>{plain(item)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View break wrap>
          <View style={s.chapterHead} wrap={false}>
            <Text style={s.chapterNumber}>C</Text>
            <Text style={[s.chapterTitle, { flexGrow: 1, flexBasis: 0 }]}>{plain(manual.faq.title)}</Text>
          </View>
          {manual.faq.items.map((item) => (
            <View key={item.q} wrap={false}>
              <Text style={s.question}>{plain(item.q)}</Text>
              <Text>{plain(item.a)}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>{generatedAt} · todorovnet.vercel.app</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
