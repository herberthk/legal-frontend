"use client";

import { formatTime } from "@/lib/utils";
import { formatCost } from "@/utils";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  LinearGradient,
  Stop,
  Defs,
  G,
} from "@react-pdf/renderer";
import { format } from "date-fns";

// Brand Colors
const COLORS = {
  primary: "#4f46e5", // indigo-600
  secondary: "#ea580c", // orange-600
  accent: "#818cf8", // indigo-400
  text: "#1e293b", // slate-800
  muted: "#64748b", // slate-500
  bg: "#f8fafc", // slate-50
  white: "#ffffff",
  userBg: "#ea580c",
  aiBg: "#ffffff",
  aiBorder: "#e2e8f0",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    color: COLORS.text,
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 30,
    borderBottom: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  logoIcon: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "heavy",
  },
  title: {
    fontSize: 19,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#0f172a",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: "column",
  },
  metaLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    color: COLORS.muted,
    marginBottom: 2,
    letterSpacing: 1,
  },
  metaValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
    color: COLORS.secondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryContainer: {
    backgroundColor: "#f1f5f9",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: COLORS.text,
    fontStyle: "italic",
  },
  transcriptContainer: {
    marginTop: 10,
  },
  turn: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: "90%",
  },
  userTurn: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.userBg,
    borderBottomRightRadius: 0,
  },
  aiTurn: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.aiBg,
    borderWidth: 1,
    borderColor: COLORS.aiBorder,
    borderBottomLeftRadius: 0,
  },
  turnRole: {
    fontSize: 7,
    textTransform: "uppercase",
    fontWeight: "bold",
    marginBottom: 4,
    letterSpacing: 1,
  },
  userRole: {
    color: "#ffedd5",
  },
  aiRole: {
    color: COLORS.secondary,
  },
  turnContent: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  userContent: {
    color: "#ffffff",
  },
  aiContent: {
    color: COLORS.text,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: COLORS.muted,
  },
});

// const LogoIcon = () => (
//   <Svg viewBox="0 0 40 40" style={{ width: 32, height: 32, marginRight: 8 }}>
//     <Defs>
//       <LinearGradient id="iconBg" x1="0" y1="0" x2="1" y2="1">
//         <Stop offset="0%" stopColor="#9a3412" /> {/* orange-800 */}
//         <Stop offset="100%" stopColor="#818cf8" /> {/* indigo-400 */}
//       </LinearGradient>
//     </Defs>
//     <View>
//       <Path
//         d="M 20, 20 m -20, 0 a 20, 20 0 1, 0 40, 0 a 20, 20 0 1, 0 -40, 0"
//         fill="url(#iconBg)"
//       />
//       <G transform="translate(8, 8)">
//         <Path
//           d="M12 3v18"
//           stroke="#ffffff"
//           strokeWidth={2}
//           strokeLinecap="round"
//           strokeLinejoin="round"
//         />
//         <Path
//           d="m19 8 3 8a5 5 0 0 1-6 0zV7"
//           stroke="#ffffff"
//           strokeWidth={2}
//           strokeLinecap="round"
//           strokeLinejoin="round"
//         />
//         <Path
//           d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"
//           stroke="#ffffff"
//           strokeWidth={2}
//           strokeLinecap="round"
//           strokeLinejoin="round"
//         />
//         <Path
//           d="m5 8 3 8a5 5 0 0 1-6 0zV7"
//           stroke="#ffffff"
//           strokeWidth={2}
//           strokeLinecap="round"
//           strokeLinejoin="round"
//         />
//         <Path
//           d="M7 21h10"
//           stroke="#ffffff"
//           strokeWidth={2}
//           strokeLinecap="round"
//           strokeLinejoin="round"
//         />
//       </G>
//     </View>
//   </Svg>
// );

interface ExportPDFProps {
  session: VoiceSession;
}

const ExportPDF = ({ session }: ExportPDFProps) => {
  const formattedDate = format(new Date(session.createdAt), "MMMM dd, yyyy");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with Professional Gradient look (simulated with SVG) */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {/* <LogoIcon /> */}
            <View style={{ flexDirection: "row" }}>
              <Text style={[styles.logoText, { color: "#4f46e5" }]}>Legal</Text>
              <Text style={[styles.logoText, { color: "#ea580c" }]}>
                Adviser
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{session.title}</Text>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{formattedDate}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Duration</Text>
              <Text style={styles.metaValue}>
                {formatTime(session.duration)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Estimated Cost</Text>
              <Text style={styles.metaValue}>
                {formatCost(session.cost || 0)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Session ID</Text>
              <Text style={styles.metaValue}>{session.id.slice(0, 8)}...</Text>
            </View>
          </View>
        </View>

        {/* Executive Summary */}
        <Text style={styles.sectionTitle}>Executive Summary</Text>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            {session.summary || "No summary available for this session."}
          </Text>
        </View>

        {/* Full Transcript */}
        <Text style={styles.sectionTitle}>Full Transcript</Text>
        <View style={styles.transcriptContainer}>
          {session.transcripts && session.transcripts.length > 0 ? (
            session.transcripts.map((t, idx) => (
              <View
                key={idx}
                style={[
                  styles.turn,
                  t.role === "user" ? styles.userTurn : styles.aiTurn,
                ]}
              >
                <Text
                  style={[
                    styles.turnRole,
                    t.role === "user" ? styles.userRole : styles.aiRole,
                  ]}
                >
                  {t.role === "user" ? "You" : "Legal Assistant"}
                </Text>
                <Text
                  style={[
                    styles.turnContent,
                    t.role === "user" ? styles.userContent : styles.aiContent,
                  ]}
                >
                  {t.content.replace(/[#*`]/g, "")}{" "}
                  {/* Basic markdown stripping */}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.summaryText}>No transcript available.</Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Legal Adviser - Confidential Document
          </Text>
          <Text style={[styles.footerText, { textAlign: "right" }]}>
            Generated on {format(new Date(), "PPpp")}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default ExportPDF;
