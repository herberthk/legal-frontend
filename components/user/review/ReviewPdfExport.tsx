"use client";

import { useCallback } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Font,
} from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

// Register a clean font
Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff",
      fontWeight: 700,
    },
  ],
});

const COLORS = {
  primary: "#059669",
  dark: "#0f172a",
  gray: "#64748b",
  lightGray: "#f1f5f9",
  border: "#e2e8f0",
  red: "#dc2626",
  amber: "#d97706",
  green: "#059669",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    color: COLORS.dark,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    backgroundColor: COLORS.white,
  },
  // Cover page
  cover: { flex: 1, justifyContent: "center", alignItems: "flex-start" },
  coverBadge: {
    backgroundColor: "#ecfdf5",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  coverBadgeText: { color: COLORS.primary, fontSize: 9, fontWeight: 700 },
  coverTitle: { fontSize: 26, fontWeight: 700, color: COLORS.dark, marginBottom: 8, lineHeight: 1.3 },
  coverSub: { fontSize: 11, color: COLORS.gray, marginBottom: 28, lineHeight: 1.5 },
  scoreBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  scoreNumber: { fontSize: 36, fontWeight: 700, color: COLORS.primary },
  scoreLabel: { fontSize: 10, color: COLORS.gray },
  metaRow: { flexDirection: "row", gap: 24 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 8, color: COLORS.gray, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  metaValue: { fontSize: 10, color: COLORS.dark, fontWeight: 700 },
  // Sections
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryText: { fontSize: 10, color: COLORS.dark, lineHeight: 1.6 },
  // Score table
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 6 },
  tableCell: { flex: 1, fontSize: 10 },
  tableHeader: { fontWeight: 700, fontSize: 9, color: COLORS.gray },
  scoreBar: { height: 6, borderRadius: 3, marginTop: 3 },
  // Risk cards
  riskCard: { borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1 },
  riskHigh: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  riskMedium: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  riskLow: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  riskTitle: { fontWeight: 700, fontSize: 10, marginBottom: 4 },
  riskHighText: { color: COLORS.red },
  riskMedText: { color: COLORS.amber },
  riskLowText: { color: COLORS.green },
  riskBody: { fontSize: 9, color: COLORS.dark, lineHeight: 1.5, marginBottom: 4 },
  riskRec: { fontSize: 9, color: COLORS.gray, fontStyle: "italic" },
  // Rec list
  recItem: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "flex-start" },
  recNum: {
    width: 20, height: 20, borderRadius: 4,
    backgroundColor: COLORS.lightGray,
    textAlign: "center",
    lineHeight: 1.8,
    fontSize: 9,
    fontWeight: 700,
    color: COLORS.dark,
  },
  recBody: { flex: 1 },
  recTitle: { fontWeight: 700, fontSize: 10, marginBottom: 2 },
  recDesc: { fontSize: 9, color: COLORS.gray, lineHeight: 1.5 },
  // Clause item
  clauseItem: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  clauseHigh: { borderLeftColor: COLORS.red },
  clauseMed: { borderLeftColor: COLORS.amber },
  clauseLow: { borderLeftColor: COLORS.green },
  clauseTitle: { fontWeight: 700, fontSize: 10, marginBottom: 3 },
  clauseContent: { fontSize: 9, color: COLORS.gray, fontStyle: "italic", marginBottom: 3, lineHeight: 1.4 },
  clauseAssessment: { fontSize: 9, color: COLORS.dark, lineHeight: 1.5 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: COLORS.gray },
});

interface PDFDocumentProps {
  review: Omit<DocumentReview, "id" | "userId" | "fileUrl" | "createdAt" | "updatedAt">;
  generatedAt: string;
}

function scoreBarColor(score: number) {
  if (score >= 75) return COLORS.green;
  if (score >= 50) return COLORS.amber;
  return COLORS.red;
}

const ReviewPdfDocument = ({ review, generatedAt }: PDFDocumentProps) => (
  <Document title={`Legal Review — ${review.fileName}`} author="LegalAdviser Uganda">
    {/* ─── Cover Page ─────────────────────────────────────── */}
    <Page size="A4" style={styles.page}>
      <View style={styles.cover}>
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>LEGAL ADVISER UGANDA · DOCUMENT REVIEW REPORT</Text>
        </View>
        <Text style={styles.coverTitle}>{review.fileName}</Text>
        <Text style={styles.coverSub}>{review.documentType}</Text>

        <View style={styles.scoreBox}>
          <View>
            <Text style={styles.scoreNumber}>{review.overallScore}</Text>
            <Text style={{ ...styles.scoreLabel, fontSize: 8 }}>/100</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 700, fontSize: 11, color: COLORS.dark, marginBottom: 2 }}>
              Overall Compliance Score
            </Text>
            <Text style={styles.scoreLabel}>
              Based on {review.scoreBreakdown.length} legal compliance categories
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Document Type</Text>
            <Text style={styles.metaValue}>{review.documentType}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Pages Reviewed</Text>
            <Text style={styles.metaValue}>{review.pageCount}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Generated</Text>
            <Text style={styles.metaValue}>{generatedAt}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>LegalAdviser Uganda · Confidential</Text>
        <Text style={styles.footerText}>Page 1</Text>
      </View>
    </Page>

    {/* ─── Summary & Score Breakdown ─────────────────────── */}
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Document Summary</Text>
        <Text style={styles.summaryText}>{review.summary}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Score Breakdown</Text>
        {review.scoreBreakdown.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{item.category}</Text>
            <View style={[styles.tableCell, { flex: 3, justifyContent: "center" }]}>
              <View style={[styles.scoreBar, { width: `${item.score}%`, backgroundColor: scoreBarColor(item.score) }]} />
            </View>
            <Text style={[styles.tableCell, { textAlign: "right", fontWeight: 700, color: scoreBarColor(item.score) }]}>
              {item.score}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Highlights</Text>
        {review.highlights.map((h, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 4, gap: 6 }}>
            <Text style={{ color: COLORS.primary, fontWeight: 700 }}>✓</Text>
            <Text style={{ fontSize: 10, color: COLORS.dark, lineHeight: 1.5, flex: 1 }}>{h}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>LegalAdviser Uganda · Confidential</Text>
        <Text style={styles.footerText}>Page 2</Text>
      </View>
    </Page>

    {/* ─── Key Clauses ───────────────────────────────────── */}
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Clauses ({review.keyClauses.length})</Text>
        {review.keyClauses.map((clause, i) => {
          const borderColor = clause.riskLevel === "HIGH" ? COLORS.red : clause.riskLevel === "MEDIUM" ? COLORS.amber : COLORS.green;
          return (
            <View key={i} style={[styles.clauseItem, { borderLeftColor: borderColor }]}>
              <Text style={styles.clauseTitle}>{clause.title}</Text>
              <Text style={styles.clauseContent}>&ldquo;{clause.content}&rdquo;</Text>
              <Text style={styles.clauseAssessment}>{clause.assessment}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>LegalAdviser Uganda · Confidential</Text>
        <Text style={styles.footerText}>Page 3</Text>
      </View>
    </Page>

    {/* ─── Risks ─────────────────────────────────────────── */}
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Risk Assessment ({review.risks.length})</Text>
        {review.risks.map((risk, i) => {
          const cardStyle = risk.severity === "HIGH" ? styles.riskHigh : risk.severity === "MEDIUM" ? styles.riskMedium : styles.riskLow;
          const textStyle = risk.severity === "HIGH" ? styles.riskHighText : risk.severity === "MEDIUM" ? styles.riskMedText : styles.riskLowText;
          return (
            <View key={i} style={[styles.riskCard, cardStyle]}>
              <Text style={[styles.riskTitle, textStyle]}>{risk.severity} — {risk.title}</Text>
              {risk.clause && <Text style={[styles.riskBody, { color: COLORS.gray }]}>Ref: {risk.clause}</Text>}
              <Text style={styles.riskBody}>{risk.description}</Text>
              <Text style={styles.riskRec}>→ {risk.recommendation}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>LegalAdviser Uganda · Confidential</Text>
        <Text style={styles.footerText}>Page 4</Text>
      </View>
    </Page>

    {/* ─── Recommendations ───────────────────────────────── */}
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommendations ({review.recommendations.length})</Text>
        {review.recommendations.map((rec, i) => (
          <View key={i} style={styles.recItem}>
            <Text style={styles.recNum}>{i + 1}</Text>
            <View style={styles.recBody}>
              <Text style={styles.recTitle}>{rec.title}</Text>
              <Text style={styles.recDesc}>{rec.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 24, padding: 12, backgroundColor: COLORS.lightGray, borderRadius: 8 }}>
        <Text style={{ fontSize: 8, color: COLORS.gray, lineHeight: 1.6, textAlign: "center" }}>
          This report is generated by LegalAdviser Uganda (AI-assisted analysis). It does not constitute formal legal advice.
          Always consult a qualified advocate before taking legal action. Generated: {generatedAt}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>LegalAdviser Uganda · Confidential</Text>
        <Text style={styles.footerText}>Page 5</Text>
      </View>
    </Page>
  </Document>
);

interface ReviewPdfExportProps {
  review: Omit<DocumentReview, "id" | "userId" | "fileUrl" | "createdAt" | "updatedAt">;
}

export function ReviewPdfExport({ review }: ReviewPdfExportProps) {
  const handleExport = useCallback(async () => {
    const generatedAt = formatDate(new Date().toISOString());
    const blob = await pdf(<ReviewPdfDocument review={review} generatedAt={generatedAt} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Legal_Review_${review.fileName.replace(/\.pdf$/i, "")}_${new Date().toISOString().split("T")[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [review]);

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-semibold text-sm hover:bg-slate-900 dark:hover:bg-slate-600 transition-all duration-200 shadow-lg hover:-translate-y-0.5 active:scale-95"
    >
      <Download className="w-4 h-4" />
      Export PDF Report
    </button>
  );
}
