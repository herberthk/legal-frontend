"use client";

import { useCallback } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Svg,
  Path,
  Circle,
  Polygon,
  Line,
} from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

const COLORS = {
  primary: "#059669",
  dark: "#0f172a",
  gray: "#64748b",
  lightGray: "#f1f5f9",
  border: "#e2e8f0",
  red: "#dc2626",
  amber: "#d97706",
  blue: "#2563eb",
  green: "#059669",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.dark,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    backgroundColor: COLORS.white,
  },
  // Cover page
  cover: { alignItems: "stretch", paddingBottom: 24 },
  coverBadge: {
    backgroundColor: "#ecfdf5",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  coverBadgeText: { color: COLORS.primary, fontSize: 9, fontWeight: 700 },
  coverTitle: { fontSize: 26, fontWeight: 700, color: COLORS.dark, marginBottom: 8, lineHeight: 1.3, width: "100%" },
  coverSub: { fontSize: 11, color: COLORS.gray, marginBottom: 28, lineHeight: 1.5, width: "100%" },
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
    width: "100%",
  },
  scoreNumber: { fontSize: 36, fontWeight: 700, color: COLORS.primary },
  scoreLabel: { fontSize: 10, color: COLORS.gray },
  metaRow: { flexDirection: "row", gap: 24, width: "100%" },
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
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 6, alignItems: "center" },
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
    width: 20, height: 20, borderRadius: 10,
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
  highlightNum: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#ecfdf5",
    color: COLORS.primary,
    textAlign: "center",
    lineHeight: 1.5,
    fontSize: 8,
    fontWeight: 700,
  },
  inlineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 7,
    fontWeight: 700,
    marginLeft: 6,
    textTransform: "uppercase",
  },
  badgeHigh: { backgroundColor: "#fef2f2", color: COLORS.red },
  badgeMedium: { backgroundColor: "#fffbeb", color: COLORS.amber },
  badgeLow: { backgroundColor: "#f0fdf4", color: COLORS.green },
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
  // Score Details
  detailItem: {
    padding: 10,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    marginBottom: 8,
  },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  detailTitle: { fontWeight: 700, fontSize: 10, color: COLORS.dark },
  detailScore: { fontWeight: 700, fontSize: 10 },
  detailBlock: { marginBottom: 6 },
  detailSubtitle: { fontSize: 8, fontWeight: 700, color: COLORS.gray, marginBottom: 2, textTransform: "uppercase" },
  detailText: { fontSize: 9, color: COLORS.dark, lineHeight: 1.5 },
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
  review: Omit<DocumentReview, "id" | "userId" | "fileUrl" | "updatedAt">;
  generatedAt: string;
}

function scoreBarColor(score: number) {
  if (score >= 85) return COLORS.green;
  if (score >= 75) return COLORS.blue;
  if (score >= 50) return COLORS.amber;
  return COLORS.red;
}

function formatCategoryName(cat: string): string {
  const map: Record<string, string> = {
    legalCompliance: "Legal Compliance",
    riskManagement: "Risk Management",
    clarityDrafting: "Clarity & Drafting",
    partyProtection: "Party Protection",
    enforceability: "Enforceability",
    "Legal Compliance": "Legal Compliance",
    "Risk Management": "Risk Management",
    "Clarity & Drafting": "Clarity & Drafting",
    "Party Protection": "Party Protection",
    Enforceability: "Enforceability",
  };
  return map[cat] ?? cat;
}

const getRiskWeight = (level: string) => (level === "HIGH" ? 3 : level === "MEDIUM" ? 2 : 1);

function getDonutPath(x: number, y: number, radius: number, score: number) {
  const percentage = Math.max(0, Math.min(100, score)) / 100;
  if (percentage === 1) return "";
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + percentage * 2 * Math.PI;
  const startX = x + radius * Math.cos(startAngle);
  const startY = y + radius * Math.sin(startAngle);
  const endX = x + radius * Math.cos(endAngle);
  const endY = y + radius * Math.sin(endAngle);
  const largeArcFlag = percentage > 0.5 ? 1 : 0;
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
}

function getRadarPolygon(scores: number[], centerX: number, centerY: number, maxRadius: number) {
  const points = scores.map((score, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(scores.length, 1);
    const r = (score / 100) * maxRadius;
    return `${centerX + r * Math.cos(angle)},${centerY + r * Math.sin(angle)}`;
  });
  return points.join(" ");
}

const radarAxes = [0, 1, 2, 3, 4].map(i => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return {
    x2: 50 + 30 * Math.cos(angle),
    y2: 50 + 30 * Math.sin(angle),
  };
});

const radarLabels = [
  { label: "Compliance", x: 50, y: 14, align: "middle" as const },
  { label: "Risk Mgmt", x: 83, y: 38, align: "start" as const },
  { label: "Clarity", x: 68, y: 86, align: "start" as const },
  { label: "Protection", x: 32, y: 86, align: "end" as const },
  { label: "Enforceable", x: 17, y: 38, align: "end" as const },
];

function getScoreLabel(score: number) {
  if (score >= 85) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 50) return "FAIR";
  return "POOR";
}

const ReviewPdfDocument = ({ review, generatedAt }: PDFDocumentProps) => {
  const sortedClauses = [...review.keyClauses].sort((a, b) => getRiskWeight(b.riskLevel) - getRiskWeight(a.riskLevel));
  const sortedRisks = [...review.risks].sort((a, b) => getRiskWeight(b.severity) - getRiskWeight(a.severity));
  const sortedRecs = [...review.recommendations].sort((a, b) => getRiskWeight(b.priority) - getRiskWeight(a.priority));

  return (
  <Document title={`Legal Review — ${review.fileName}`} author="LegalAdviser Uganda">
    {/* ─── Cover Page ─────────────────────────────────────── */}
    <Page size="A4" style={styles.page}>
      <View style={styles.cover}>
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>LEGAL ADVISER UGANDA · DOCUMENT REVIEW REPORT</Text>
        </View>
        <Text style={styles.coverTitle}>{review.fileName}</Text>
        <Text style={styles.coverSub}>{review.documentType}</Text>

        <View style={{ flexDirection: "row", gap: 16, marginBottom: 24 }}>
          {/* LEFT PANEL */}
          <View style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" }}>
            <Text style={{ fontWeight: 700, fontSize: 10, color: COLORS.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
              Overall Compliance Score
            </Text>
            <View style={{ position: "relative", width: 120, height: 120 }}>
               <Svg viewBox="0 0 100 100" width={120} height={120}>
                  <Circle cx="50" cy="50" r="40" stroke={COLORS.border} strokeWidth="8" fill="none" />
                  {review.overallScore < 100 ? (
                    <Path d={getDonutPath(50, 50, 40, review.overallScore)} stroke={scoreBarColor(review.overallScore)} strokeWidth="8" fill="none" strokeLinecap="round" />
                  ) : (
                    <Circle cx="50" cy="50" r="40" stroke={scoreBarColor(review.overallScore)} strokeWidth="8" fill="none" />
                  )}
               </Svg>
               <View style={{ position: "absolute", top: 0, left: 0, width: 120, height: 120, justifyContent: "center", alignItems: "center" }}>
                 <Text style={{ fontSize: 32, fontWeight: 700, color: COLORS.dark }}>{review.overallScore}</Text>
                 <Text style={{ fontSize: 10, color: COLORS.gray, marginTop: -4 }}>/ 100</Text>
               </View>
            </View>
            <View style={{ marginTop: 12, backgroundColor: scoreBarColor(review.overallScore) + "20", paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12 }}>
               <Text style={{ color: scoreBarColor(review.overallScore), fontWeight: 700, fontSize: 10 }}>{getScoreLabel(review.overallScore)}</Text>
            </View>
          </View>

          {/* RIGHT PANEL */}
          <View style={{ flex: 1.5, backgroundColor: "#f8fafc", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border }}>
             <Text style={{ fontWeight: 700, fontSize: 10, color: COLORS.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Score Breakdown
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 100, height: 100 }}>
                 <Svg viewBox="0 0 100 100" width={100} height={100}>
                    {[20, 40, 60, 80, 100].map(p => (
                       <Polygon key={p} points={getRadarPolygon([p,p,p,p,p], 50, 50, 30)} stroke={COLORS.border} strokeWidth="1" fill="none" />
                    ))}
                    {radarAxes.map((ax, i) => (
                       <Line key={i} x1="50" y1="50" x2={ax.x2} y2={ax.y2} stroke={COLORS.border} strokeWidth="1" />
                    ))}
                    <Polygon points={getRadarPolygon(
                        review.scoreBreakdown.map(s => s.score),
                        50, 50, 30
                      )} 
                      stroke={scoreBarColor(review.overallScore)} strokeWidth="1.5" fill={scoreBarColor(review.overallScore) + "33"} 
                    />
                    {radarLabels.map((lbl, i) => (
                       <Text key={i} x={lbl.x} y={lbl.y} textAnchor={lbl.align} style={{ fontSize: 5, fill: COLORS.gray }}>
                         {lbl.label}
                       </Text>
                    ))}
                 </Svg>
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                 {review.scoreBreakdown.map((item, i) => (
                   <View key={i} style={{ marginBottom: 6 }}>
                     <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                       <Text style={{ fontSize: 8, color: COLORS.dark }}>{formatCategoryName(item.category)}</Text>
                       <Text style={{ fontSize: 8, fontWeight: 700, color: scoreBarColor(item.score) }}>{item.score}</Text>
                     </View>
                     <View style={{ height: 4, borderRadius: 2, backgroundColor: COLORS.border, overflow: "hidden" }}>
                        <View style={{ width: `${item.score}%`, height: 4, backgroundColor: scoreBarColor(item.score) }} />
                     </View>
                   </View>
                 ))}
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.section, { marginBottom: 24 }]}>
          <Text style={styles.sectionTitle}>Document Summary</Text>
          <Text style={styles.summaryText}>{review.summary}</Text>
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
            <Text style={styles.metaLabel}>Tokens Used</Text>
            <Text style={styles.metaValue}>{review.tokensUsed?.toLocaleString() || "N/A"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Generated</Text>
            <Text style={styles.metaValue}>{generatedAt}</Text>
          </View>
        </View>
      </View>

    {/* ─── Score Improvement Plan ─────────────────────── */}
      {review.scoreBreakdown.some(s => s.reason || s.recommendation) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Score Improvement Plan</Text>
          {review.scoreBreakdown.filter(s => s.reason || s.recommendation).map((item, i) => (
            <View key={i} style={styles.detailItem} wrap={false}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>{formatCategoryName(item.category)}</Text>
                <Text style={[styles.detailScore, { color: scoreBarColor(item.score) }]}>{item.score} / 100</Text>
              </View>
              {item.reason && (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailSubtitle}>Current Assessment</Text>
                  <Text style={styles.detailText}>{item.reason}</Text>
                </View>
              )}
              {item.recommendation && (
                <View style={[styles.detailBlock, { marginBottom: 0 }]}>
                  <Text style={[styles.detailSubtitle, { color: COLORS.primary }]}>Recommendation for 100%</Text>
                  <Text style={styles.detailText}>{item.recommendation}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

    {/* ─── Highlights ─────────────────────── */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Highlights</Text>
        {review.highlights.map((h, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 6, gap: 8, alignItems: "flex-start" }}>
            <Text style={styles.highlightNum}>{i + 1}</Text>
            <Text style={{ fontSize: 10, color: COLORS.dark, lineHeight: 1.5, flex: 1 }}>{h}</Text>
          </View>
        ))}
      </View>

    {/* ─── Key Clauses ───────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Clauses ({review.keyClauses.length})</Text>
        {sortedClauses.map((clause, i) => {
          const borderColor = clause.riskLevel === "HIGH" ? COLORS.red : clause.riskLevel === "MEDIUM" ? COLORS.amber : COLORS.green;
          const badgeStyle = clause.riskLevel === "HIGH" ? styles.badgeHigh : clause.riskLevel === "MEDIUM" ? styles.badgeMedium : styles.badgeLow;
          return (
            <View key={i} style={[styles.clauseItem, { borderLeftColor: borderColor }]} wrap={false}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <Text style={[styles.clauseTitle, { marginBottom: 0 }]}>{clause.title}</Text>
                <Text style={[styles.inlineBadge, badgeStyle]}>{clause.riskLevel}</Text>
              </View>
              <Text style={styles.clauseContent}>&ldquo;{clause.content}&rdquo;</Text>
              <Text style={styles.clauseAssessment}>{clause.assessment}</Text>
            </View>
          );
        })}
      </View>

    {/* ─── Risks ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Risk Assessment ({review.risks.length})</Text>
        {sortedRisks.map((risk, i) => {
          const cardStyle = risk.severity === "HIGH" ? styles.riskHigh : risk.severity === "MEDIUM" ? styles.riskMedium : styles.riskLow;
          const textStyle = risk.severity === "HIGH" ? styles.riskHighText : risk.severity === "MEDIUM" ? styles.riskMedText : styles.riskLowText;
          const badgeStyle = risk.severity === "HIGH" ? styles.badgeHigh : risk.severity === "MEDIUM" ? styles.badgeMedium : styles.badgeLow;
          return (
            <View key={i} style={[styles.riskCard, cardStyle]} wrap={false}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Text style={[styles.riskTitle, textStyle, { marginBottom: 0 }]}>{risk.title}</Text>
                <Text style={[styles.inlineBadge, badgeStyle]}>{risk.severity}</Text>
              </View>
              {risk.clause && <Text style={[styles.riskBody, { color: COLORS.gray }]}>Ref: {risk.clause}</Text>}
              <Text style={styles.riskBody}>{risk.description}</Text>
              <Text style={styles.riskRec}>
                <Text style={{ fontWeight: 700 }}>Recommended Action: </Text>
                {risk.recommendation}
              </Text>
            </View>
          );
        })}
      </View>

    {/* ─── Recommendations ───────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommendations ({review.recommendations.length})</Text>
        {sortedRecs.map((rec, i) => {
          const badgeStyle = rec.priority === "HIGH" ? styles.badgeHigh : rec.priority === "MEDIUM" ? styles.badgeMedium : styles.badgeLow;
          return (
            <View key={i} style={styles.recItem} wrap={false}>
              <Text style={styles.recNum}>{i + 1}</Text>
              <View style={styles.recBody}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Text style={[styles.recTitle, { marginBottom: 0 }]}>{rec.title}</Text>
                  <Text style={[styles.inlineBadge, badgeStyle]}>{rec.priority}</Text>
                </View>
                <Text style={styles.recDesc}>{rec.description}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: 24, padding: 12, backgroundColor: COLORS.lightGray, borderRadius: 8 }}>
        <Text style={{ fontSize: 8, color: COLORS.gray, lineHeight: 1.6, textAlign: "center" }}>
          This report is generated by LegalAdviser Uganda (AI-assisted analysis). It does not constitute formal legal advice.
          Always consult a qualified advocate before taking legal action. Generated: {generatedAt}
        </Text>
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>LegalAdviser Uganda · Confidential</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>
  );
};

interface ReviewPdfExportProps {
  review: Omit<DocumentReview, "id" | "userId" | "fileUrl" | "updatedAt">;
}

// Standalone helper — call this from anywhere to trigger a PDF download
export async function downloadReviewPdf(
  review: Omit<DocumentReview, "id" | "userId" | "fileUrl" | "updatedAt">
) {
  const generatedAt = formatDate(review.createdAt || new Date().toISOString());
  const blob = await pdf(<ReviewPdfDocument review={review} generatedAt={generatedAt} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Legal_Review_${review.fileName.replace(/\.pdf$/i, "")}_${new Date().toISOString().split("T")[0]}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReviewPdfExport({ review }: ReviewPdfExportProps) {
  const handleExport = useCallback(async () => {
    await downloadReviewPdf(review);
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
