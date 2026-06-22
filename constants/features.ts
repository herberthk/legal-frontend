import {
  BookOpen,
  ShieldCheck,
  Zap,
  MessageSquare,
  Clock,
  History,
  FileText,
  AudioLines,
  MessageCircle,
  Mic,
} from "lucide-react";
export const features = [
  {
    icon: BookOpen,
    title: "Constitutional Expert",
    desc: "Instant interpretations of the 1995 Constitution. Understand your fundamental rights, duties, and citizenship laws without legal jargon.",
    color: "blue",
  },
  {
    icon: ShieldCheck,
    title: "URA Tax Compliance",
    desc: "Navigate the complexities of Income Tax, VAT, and EFRIS. Get step-by-step guides on filing returns and resolving disputes with URA.",
    color: "orange",
  },
  {
    icon: Zap,
    title: "Instant Land Checks",
    desc: "Avoid land fraud. Learn the procedures for title verification, land transfer forms, and caveats under the Registration of Titles Act.",
    color: "green",
  },
  {
    icon: MessageSquare,
    title: "Voice Consultation",
    desc: "Can't type? Speak to our AI in natural language. It listens, understands nuances, and replies with spoken legal advice.",
    color: "purple",
  },
  {
    icon: Clock,
    title: "Employment Rights",
    desc: "Unfair dismissal? Unpaid wages? Get instant references to the Employment Act, 2006 regarding severance, leave, and contracts.",
    color: "red",
  },
  {
    icon: History,
    title: "Smart Session Archives",
    desc: "Never lose track of advice. All voice consultations are recorded, transcribed, and stored securely in your dashboard for playback.",
    color: "pink",
  },
];

export const coreCapabilities = [
  {
    title: "AI Document Review",
    badge: "Contracts · Agreements · Court Documents",
    desc: "Upload any legal document — a contract, land agreement, or court summons — and receive a comprehensive legal analysis in seconds, not days.",
    highlights: [
      "Scores your document across 5 legal dimensions: Clarity, Compliance, Risk Management, Party Protection, and Enforceability — each out of 100%",
      "Generates an Overall Compliance Score so you immediately know how sound the document is",
      "Identifies hidden risks, one-sided clauses, and potential obligations you may have overlooked",
      "Gives specific suggestions backed by articles of the 1995 Constitution and relevant Ugandan laws",
      "Supports PDF, DOCX, and image file uploads up to 10MB",
    ],
    icon: FileText,
    color: "indigo",
    href: "/login?redirect=/dashboard/review",
    buttonText: "Review a Document",
    imageDesktop: "/features/legal document review desktop.jpg",
    imageMobile: "/features/legal document review mobile.jpg",
  },
  {
    title: "Document Transcription",
    badge: "Handwritten · PDFs · Screenshots",
    desc: "Have handwritten legal notes, financial ledgers, or meeting minutes in a PDF or screenshot? Upload them and get pristine, perfectly formatted digital text ready for analysis.",
    highlights: [
      "Converts handwritten notes, stamps, and signatures into clean, readable digital text",
      "Works with PDFs, scanned documents, and screenshots taken on any device",
      "Preserves the original structure — headings, lists, tables — in the transcribed output",
      "Output is ready to copy, share, search, or feed into the AI chat for further analysis",
    ],
    icon: AudioLines,
    color: "orange",
    href: "/login?redirect=/dashboard/transcribe",
    buttonText: "Transcribe a Document",
    imageDesktop: "/features/legal document transcription desktop.jpg",
    imageMobile: "/features/legal document transcription mobile.jpg",
  },
  {
    title: "Interactive Legal Chat",
    badge: "Questions · Document Summaries · Guidance",
    desc: "Ask legal questions in plain English or Luganda and get instant, referenced answers grounded in Ugandan law. Upload a document to get a full plain-English summary.",
    highlights: [
      "Ask any legal question — from tenant rights to employment contracts — and get a clear, cited answer",
      "Upload a PDF, screenshot, or DOCX of a legal document to get a summary that outlines key clauses, sections, potential risks, and your obligations",
      "Every answer references the specific article of the Constitution or relevant Ugandan Act it is based on",
      "Follow-up questions are supported — have a real back-and-forth conversation to fully understand your situation",
      "Full chat history is saved to your dashboard for future reference",
    ],
    icon: MessageCircle,
    color: "blue",
    href: "/login?redirect=/dashboard/chat",
    buttonText: "Start a Chat",
    imageDesktop: "/features/text chat desktop.jpg",
    imageMobile: "/features/text chat mobile.jpg",
  },
  {
    title: "Real-time Voice Consultation",
    badge: "Speak · Listen · Review",
    desc: "Have a real, spoken conversation with your AI legal assistant — just like calling a lawyer, but instant and available 24/7. Every session is recorded and transcribed automatically.",
    highlights: [
      "Live, two-way voice conversation with the AI — speak naturally, get spoken responses in real time",
      "Real-time transcription displayed on screen so you can follow along as you speak",
      "When the call ends, the full conversation is automatically saved: audio recording, written transcript, and an AI-generated summary",
      "Choose your preferred AI voice before starting — male or female, with different personalities from calm and authoritative to friendly and upbeat",
      "Preview any voice before using it so you always get the experience you prefer",
    ],
    icon: Mic,
    color: "purple",
    href: "/login?redirect=/dashboard/voice",
    buttonText: "Start a Voice Session",
    imageDesktop: "/features/voice chat desktop.jpg",
    imageMobile: "/features/voice chat mobile.jpg",
  },
];


export const faqs = [
  {
    q: "Is the legal advice binding in court?",
    a: "No. LegalAdviser UG provides information for educational and guidance purposes based on Ugandan law. It does not replace a qualified human advocate for court representation.",
  },
  {
    q: "What are 'Tokens' and what counts toward my bill?",
    a: "Tokens are units that measure text length — roughly 750 words per 1,000 tokens. For every AI interaction, three types of tokens are billed together: (1) Input tokens — the text of your message or uploaded document; (2) Thinking tokens — the AI's internal reasoning process before it responds; and (3) Output tokens — the AI's reply to you. All three are summed and charged at UGX 103 per 1,000 tokens.",
  },
  {
    q: "Which laws are covered?",
    a: "We cover the 1995 Constitution, Penal Code Act, Land Act, Employment Act, Tax procedures (URA), and general civil law. We regularly update our database with new amendments.",
  },
  {
    q: "Is my data private?",
    a: "Yes. We use enterprise-grade encryption. Your case details are anonymized and not used to train our public models without consent.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "If your credit balance reaches zero, you'll automatically receive 1,000 free tokens every 3 days to keep you going. These free tokens refill only when your current balance is fully used — they don't stack up. You can also top up your balance at any time via MTN or Airtel Mobile Money.",
  },
  {
    q: "Are my voice sessions saved?",
    a: "Yes. When a voice consultation ends, the full audio recording, a written transcript of the entire conversation, and an AI-generated summary are all automatically saved to your dashboard. You can review, search, or download them at any time.",
  },
];
