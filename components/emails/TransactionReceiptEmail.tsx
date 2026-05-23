import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
  Link,
} from "@react-email/components";
import * as React from "react";

interface TransactionReceiptEmailProps {
  userName: string;
  userEmail: string;
  amountUSD: string;       // e.g. "$20.00"
  amountUGX: string;       // e.g. "UGX 72,000"
  paymentMethod: string;   // e.g. "MTN Mobile Money" | "Airtel Money" | "Stripe Card"
  reference: string;       // Transaction reference
  date: string;            // Human readable date string
  newBalanceUSD: string;   // e.g. "$120.00"
  receiptUrl?: string;     // Only for Stripe card payments
  dashboardUrl: string;
}

export const TransactionReceiptEmail = ({
  userName,
  amountUSD,
  amountUGX,
  paymentMethod,
  reference,
  date,
  newBalanceUSD,
  receiptUrl,
  dashboardUrl,
}: TransactionReceiptEmailProps) => {
  const isCard = !!receiptUrl;

  return (
    <Html>
      <Head />
      <Preview>
        Your deposit of {amountUSD} was successful — Legal Adviser
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* ── Header ── */}
          <Section style={header}>
            <Row>
              <Column>
                <Heading style={headerTitle}>Legal Adviser</Heading>
                <Text style={headerSubtitle}>Secure Payment Receipt</Text>
              </Column>
              <Column align="right">
                <div style={successBadge}>✓ Paid</div>
              </Column>
            </Row>
          </Section>

          {/* ── Amount Hero ── */}
          <Section style={amountSection}>
            <Text style={amountLabel}>Amount Deposited</Text>
            <Text style={amountValue}>{amountUSD}</Text>
            <Text style={amountUGXLabel}>{amountUGX}</Text>
          </Section>

          <Hr style={divider} />

          {/* ── Greeting ── */}
          <Section style={content}>
            <Text style={greeting}>Hi {userName},</Text>
            <Text style={body}>
              Great news! Your wallet top-up was processed successfully. The
              funds have been instantly credited to your Legal Adviser
              consultation wallet and are ready to use.
            </Text>
          </Section>

          {/* ── Transaction Details Table ── */}
          <Section style={detailsCard}>
            <Heading as="h3" style={detailsTitle}>
              Transaction Details
            </Heading>
            <Hr style={innerDivider} />

            <Row style={detailRow}>
              <Column style={detailLabel}>Reference</Column>
              <Column style={detailValue}>{reference}</Column>
            </Row>
            <Hr style={innerDivider} />

            <Row style={detailRow}>
              <Column style={detailLabel}>Date &amp; Time</Column>
              <Column style={detailValue}>{date}</Column>
            </Row>
            <Hr style={innerDivider} />

            <Row style={detailRow}>
              <Column style={detailLabel}>Payment Method</Column>
              <Column style={detailValue}>{paymentMethod}</Column>
            </Row>
            <Hr style={innerDivider} />

            <Row style={detailRow}>
              <Column style={detailLabel}>Amount</Column>
              <Column style={detailValue}>{amountUSD}</Column>
            </Row>
            <Hr style={innerDivider} />

            <Row style={detailRow}>
              <Column style={detailLabel}>New Balance</Column>
              <Column style={{ ...detailValue, color: "#6366f1", fontWeight: "700" }}>
                {newBalanceUSD}
              </Column>
            </Row>
          </Section>

          {/* ── Stripe Receipt Link (card only) ── */}
          {isCard && receiptUrl && (
            <Section style={{ textAlign: "center", marginBottom: "24px" }}>
              <Text style={{ ...body, textAlign: "center", marginBottom: "12px" }}>
                View your official Stripe payment receipt:
              </Text>
              <Link href={receiptUrl} style={receiptLink}>
                View Stripe Receipt →
              </Link>
            </Section>
          )}

          {/* ── CTA ── */}
          <Section style={{ textAlign: "center", marginBottom: "32px" }}>
            <Button href={dashboardUrl} style={ctaButton}>
              View Transaction
            </Button>
          </Section>

          {/* ── Security Note ── */}
          <Section style={securityNote}>
            <Text style={securityText}>
              🔒 This transaction was processed with 256-bit SSL encryption.
              Legal Adviser never stores your card details. If you did not
              initiate this deposit,{" "}
              <Link href="mailto:info@netbritz.com" style={supportLink}>
                contact support immediately
              </Link>
              .
            </Text>
          </Section>

          <Hr style={divider} />

          {/* ── Footer ── */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Legal Adviser — Powered by Netbritz
            </Text>
            <Text style={footerText}>
              <Link href="mailto:info@netbritz.com" style={footerLink}>
                info@netbritz.com
              </Link>{" "}
              &bull;{" "}
              <Link href={dashboardUrl} style={footerLink}>
                Dashboard
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default TransactionReceiptEmail;

// ── Styles ──────────────────────────────────────────────────────────────────
const main: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: "700px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  // overflow: "hidden",
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  padding: "10px",
};

const header: React.CSSProperties = {
  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ea580c 100%)",
  padding: "32px 40px",
};

const headerTitle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "800",
  margin: "0 0 4px 0",
  letterSpacing: "-0.5px",
};

const headerSubtitle: React.CSSProperties = {
  color: "rgba(255,255,255,0.8)",
  fontSize: "13px",
  margin: "0",
  fontWeight: "500",
};

const successBadge: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "rgba(255,255,255,0.2)",
  color: "#ffffff",
  padding: "6px 16px",
  borderRadius: "999px",
  fontSize: "14px",
  fontWeight: "700",
  border: "1px solid rgba(255,255,255,0.3)",
};

const amountSection: React.CSSProperties = {
  textAlign: "center",
  padding: "40px 40px 24px",
};

const amountLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "1px",
  margin: "0 0 8px 0",
};

const amountValue: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "52px",
  fontWeight: "900",
  margin: "0 0 4px 0",
  letterSpacing: "-2px",
  lineHeight: "1",
};

const amountUGXLabel: React.CSSProperties = {
  color: "#ea580c",
  fontSize: "16px",
  fontWeight: "600",
  margin: "0",
  backgroundColor: "#fff7ed",
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: "999px",
};

const divider: React.CSSProperties = {
  borderColor: "#e2e8f0",
  margin: "0",
};

const innerDivider: React.CSSProperties = {
  borderColor: "#f1f5f9",
  margin: "0",
};

const content: React.CSSProperties = {
  padding: "32px 40px 0",
};

const greeting: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "18px",
  fontWeight: "700",
  margin: "0 0 12px 0",
};

const body: React.CSSProperties = {
  color: "#475569",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0",
};

const detailsCard: React.CSSProperties = {
  margin: "14px 20px",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  // overflow: "hidden",
  padding: "0",
};

const detailsTitle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: "700",
  margin: "0",
  padding: "16px 20px",
  backgroundColor: "#f8fafc",
  letterSpacing: "0.3px",
};

const detailRow: React.CSSProperties = {
  padding: "12px 20px",
};

const detailLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: "500",
  width: "45%",
};

const detailValue: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: "600",
  textAlign: "right",
};

const receiptLink: React.CSSProperties = {
  color: "#4f46e5",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "underline",
};

const ctaButton: React.CSSProperties = {
  background: "linear-gradient(135deg, #4f46e5, #ea580c)",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  padding: "14px 40px",
  borderRadius: "999px",
  textDecoration: "none",
  display: "inline-block",
  letterSpacing: "0.3px",
};

const securityNote: React.CSSProperties = {
  backgroundColor: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: "12px",
  margin: "0 40px 32px",
  padding: "16px 20px",
};

const securityText: React.CSSProperties = {
  color: "#166534",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0",
};

const supportLink: React.CSSProperties = {
  color: "#166534",
  fontWeight: "600",
};

const footer: React.CSSProperties = {
  padding: "24px 40px",
  backgroundColor: "#f8fafc",
  textAlign: "center",
};

const footerText: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
  margin: "4px 0",
};

const footerLink: React.CSSProperties = {
  color: "#6366f1",
  textDecoration: "none",
};
