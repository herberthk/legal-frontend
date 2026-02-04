import {
  BookOpen,
  ShieldCheck,
  Zap,
  MessageSquare,
  Clock,
  History,
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
