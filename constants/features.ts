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
    desc: "Upload complex legal documents, contracts, or court summons. Our AI instantly analyzes the text, highlights key clauses, identifies potential risks, and provides a clear, plain-English summary.",
    icon: FileText,
    color: "indigo",
    href: "/login?redirect=/dashboard/review",
    buttonText: "Review Document",
    imageDesktop: "/features/legal document review desktop.jpg",
    imageMobile: "/features/legal document review mobile.jpg",
  },
  {
    title: "Document Transcription",
    desc: "Have handwritten legal notes, financial ledgers, or meeting minutes in a PDF or screenshot? Upload them and get pristine, perfectly formatted digital text ready for analysis.",
    icon: AudioLines, // Or we could change this to something like Scanner or FileCode, but AudioLines is imported. Let's keep it or I can change it later if needed.
    color: "orange",
    href: "/login?redirect=/dashboard/transcribe",
    buttonText: "Transcribe Document",
    imageDesktop: "/features/legal document transcription desktop.jpg",
    imageMobile: "/features/legal document transcription mobile.jpg",
  },
  {
    title: "Interactive Legal Chat",
    desc: "Chat with an AI trained on Ugandan law. Ask specific questions, explore legal scenarios, and get instant, referenced answers to help you navigate your legal matters effectively.",
    icon: MessageCircle,
    color: "blue",
    href: "/login?redirect=/dashboard/chat",
    buttonText: "Start Chat",
    imageDesktop: "/features/text chat desktop.jpg",
    imageMobile: "/features/text chat mobile.jpg",
  },
  {
    title: "Real-time Voice Consultation",
    desc: "Experience a natural, spoken conversation with our AI legal assistant. Perfect for when you need hands-free advice or prefer speaking over typing. It listens and replies instantly.",
    icon: Mic,
    color: "purple",
    href: "/login?redirect=/dashboard/voice",
    buttonText: "Voice Consult",
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
    q: "What are 'Tokens'?",
    a: "Tokens are units used to measure the length of text. 1,000 tokens equal roughly 750 words. Simple questions cost fewer tokens, while asking the AI to draft complex contracts or analyze long documents uses more.",
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
    a: "You can easily top up your balance at any time. Your account includes 5 free daily messages even with a zero balance.",
  },
];
