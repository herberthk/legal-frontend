"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Scale,
  ArrowRight,
  X,
  Loader2,
  Mic,
  Shield,
  Gavel,
  Home,
  Briefcase,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePopStore } from "@/store";
import { useLockBodyScroll } from "@uidotdev/usehooks";

// ---------- Types ----------
type Message =
  | { role: "user"; content: string }
  | { role: "ai"; content: ScriptStep };
type SimStatus = "idle" | "typing" | "processing" | "responding" | "done";

// ---------- Citation Chip ----------
const CitationChip = ({
  label,
  type = "act",
}: {
  label: string;
  type?: "act" | "article" | "section";
}) => {
  const colors = {
    act: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700",
    article:
      "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700",
    section:
      "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide ${colors[type]}`}
    >
      <ExternalLink size={9} />
      {label}
    </span>
  );
};

// ---------- Confidence Bar ----------
const ConfidenceBar = ({ score }: { score: number }) => (
  <div className="flex items-center gap-2 mt-2">
    <span className="text-[10px] text-slate-400 font-medium w-16 shrink-0">
      Confidence
    </span>
    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
        className={`h-full rounded-full ${
          score >= 90
            ? "bg-linear-to-r from-emerald-400 to-emerald-500"
            : score >= 75
            ? "bg-linear-to-r from-amber-400 to-amber-500"
            : "bg-linear-to-r from-red-400 to-red-500"
        }`}
      />
    </div>
    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 w-7 text-right">
      {score}%
    </span>
  </div>
);

// ---------- Topic Scenarios ----------
interface ScriptStep {
  question: string;
  answer: React.ReactNode;
  voiceDuration: number;
  citations: string[];
  confidence: number;
}

interface Topic {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  intro: string;
  script: ScriptStep[];
}

const TOPICS: Topic[] = [
  {
    id: "rights",
    label: "Constitutional Rights",
    icon: <Shield size={13} />,
    color: "orange",
    intro:
      "Hello! I can help you understand your constitutional rights under the 1995 Constitution of Uganda. Ask me anything — I will cite the exact article and clause.",
    script: [
      {
        question: "What are my fundamental rights as a Ugandan citizen?",
        confidence: 98,
        citations: ["Article 20", "Article 21", "Article 44"],
        voiceDuration: 4500,
        answer: (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Under{" "}
              <span className="font-bold text-orange-600 dark:text-orange-400">
                Chapter Four
              </span>{" "}
              of the 1995 Constitution, you are guaranteed a broad set of
              fundamental rights and freedoms that are inherent and cannot be
              taken away by the State.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { right: "Right to Life", art: "Art. 22" },
                { right: "Personal Liberty", art: "Art. 23" },
                { right: "Equal Protection", art: "Art. 21" },
                { right: "Freedom of Expression", art: "Art. 29" },
              ].map((item) => (
                <div
                  key={item.art}
                  className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-700"
                >
                  <CheckCircle2
                    size={12}
                    className="text-emerald-500 shrink-0"
                  />
                  <span className="text-slate-700 dark:text-slate-300">
                    {item.right}
                  </span>
                  <span className="ml-auto text-[10px] text-indigo-500 font-mono">
                    {item.art}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              These rights apply to all persons in Uganda regardless of
              citizenship status — per Article 20(2).
            </p>
          </div>
        ),
      },
      {
        question: "Can the government limit these rights?",
        confidence: 94,
        citations: ["Article 43", "Article 44"],
        voiceDuration: 4000,
        answer: (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Yes, but only within strict constitutional limits.{" "}
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                Article 43
              </span>{" "}
              allows limitations only if they are:
            </p>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              {[
                "Necessary and demonstrably justifiable in a free society",
                "Imposed for a legitimate public interest",
                "Not exceeding what is reasonably required",
              ].map((point, i) => (
                <li key={i} className="flex gap-2 items-start">
                  <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800/50">
              <AlertCircle
                size={13}
                className="text-red-500 shrink-0 mt-0.5"
              />
              <p className="text-xs text-red-700 dark:text-red-300">
                <strong>Article 44</strong> lists non-derogable rights (e.g.
                freedom from torture, slavery) that can never be limited — even
                during a state of emergency.
              </p>
            </div>
          </div>
        ),
      },
      {
        question: "What can I do if my rights are violated?",
        confidence: 96,
        citations: ["Article 50", "Article 137", "Human Rights Commission Act"],
        voiceDuration: 4500,
        answer: (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              You have multiple enforcement pathways available:
            </p>
            <div className="space-y-2">
              {[
                {
                  step: "High Court Petition",
                  desc: "Apply directly to the High Court under Art. 50 for enforcement of your rights — no filing fee required for human rights matters.",
                },
                {
                  step: "Constitutional Court",
                  desc: "If a law itself violates the Constitution, petition the Constitutional Court under Art. 137 for its interpretation.",
                },
                {
                  step: "Uganda Human Rights Commission",
                  desc: "File a free complaint at any UHRC office. They can award compensation and make binding orders.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700"
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white mb-0.5">
                      {item.step}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "employment",
    label: "Employment Law",
    icon: <Briefcase size={13} />,
    color: "indigo",
    intro:
      "Hi! I specialise in Ugandan employment law. I can help you understand your rights as an employee or employer under the Employment Act, 2006 and related legislation.",
    script: [
      {
        question: "Can my employer terminate me without notice?",
        confidence: 97,
        citations: ["Employment Act 2006, s.58", "s.65"],
        voiceDuration: 4000,
        answer: (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Generally,{" "}
              <span className="font-bold text-red-500">No</span>. Under{" "}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                Section 58 of the Employment Act 2006
              </span>
              , an employer must give written notice before termination.
            </p>
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Minimum Notice Periods
              </p>
              <div className="space-y-1.5">
                {[
                  { period: "Less than 6 months", notice: "1 week" },
                  { period: "6 months – 1 year", notice: "2 weeks" },
                  { period: "1 – 5 years", notice: "1 month" },
                  { period: "Over 5 years", notice: "2 months" },
                ].map((row) => (
                  <div
                    key={row.period}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="text-slate-600 dark:text-slate-300">
                      {row.period}
                    </span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800 text-[11px]">
                      {row.notice}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              An employer may pay wages in lieu of notice (s.58(4)), but summary
              dismissal without notice requires proof of gross misconduct.
            </p>
          </div>
        ),
      },
      {
        question: "What counts as unfair dismissal?",
        confidence: 95,
        citations: ["Employment Act 2006, s.68", "s.69"],
        voiceDuration: 4000,
        answer: (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Under{" "}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                Section 68
              </span>
              , a dismissal is <strong>unfair</strong> if the employer did not
              have a valid reason relating to the worker&apos;s conduct,
              capacity, or operational requirements — or if fair procedure was
              not followed.
            </p>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-1">
              Automatically Unfair Reasons (s.69):
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                "Union membership",
                "Pregnancy / maternity",
                "Filing a complaint",
                "Race / religion / gender",
                "HIV/AIDS status",
                "Disability",
              ].map((reason) => (
                <div
                  key={reason}
                  className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300"
                >
                  <AlertCircle size={10} className="text-red-500 shrink-0" />
                  {reason}
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        question: "How do I claim compensation for unfair dismissal?",
        confidence: 93,
        citations: [
          "Employment Act 2006, s.71",
          "Industrial Court Act",
          "Labour Disputes Act",
        ],
        voiceDuration: 4500,
        answer: (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              You have a choice of three enforcement routes, each with distinct
              timelines:
            </p>
            <div className="space-y-2">
              {[
                {
                  route: "District Labour Officer",
                  timeline: "Within 3 months",
                  desc: "Free conciliation service. Fastest route for straightforward disputes.",
                },
                {
                  route: "Industrial Court",
                  timeline: "Within 6 months",
                  desc: "Can award reinstatement, back pay, or up to 24 months wages as compensation.",
                },
                {
                  route: "High Court",
                  timeline: "Within 6 years",
                  desc: "For contract-based claims including wrongful termination damages.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex gap-3 items-start p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700"
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-white">
                        {item.route}
                      </p>
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-700 font-semibold">
                        {item.timeline}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "land",
    label: "Land & Property",
    icon: <Home size={13} />,
    color: "emerald",
    intro:
      "Hello! I can guide you through Uganda land tenure systems and property rights under the Land Act (Cap. 227) and the Landlord and Tenant Act, 2022.",
    script: [
      {
        question: "What types of land tenure exist in Uganda?",
        confidence: 99,
        citations: ["Land Act Cap.227, s.3", "1995 Constitution, Art.237"],
        voiceDuration: 4500,
        answer: (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              The{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                1995 Constitution (Art.237)
              </span>{" "}
              and the Land Act recognise four distinct systems of land ownership
              in Uganda:
            </p>
            <div className="space-y-2">
              {[
                {
                  tenure: "Mailo",
                  desc: "Freehold-like ownership specific to Buganda Kingdom. Registered under the Registration of Titles Act.",
                  badge: "Central Uganda",
                },
                {
                  tenure: "Freehold",
                  desc: "Absolute ownership registered under the Registration of Titles Act. Transferable and inheritable.",
                  badge: "Nationwide",
                },
                {
                  tenure: "Leasehold",
                  desc: "Land leased from Government or Mailo owner for a defined period (typically 49 or 99 years).",
                  badge: "Urban Areas",
                },
                {
                  tenure: "Customary",
                  desc: "Communal ownership governed by local customs. Can be converted to Freehold via Certificate of Customary Ownership (CCO).",
                  badge: "Rural Areas",
                },
              ].map((item) => (
                <div
                  key={item.tenure}
                  className="flex items-start gap-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700"
                >
                  <CheckCircle2
                    size={13}
                    className="text-emerald-500 shrink-0 mt-0.5"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">
                        {item.tenure}
                      </span>
                      <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        question: "How do I get a Certificate of Customary Ownership?",
        confidence: 96,
        citations: ["Land Act Cap.227, s.4", "Land Regulations 2004"],
        voiceDuration: 4500,
        answer: (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              A CCO converts your customary land right into a documented, legally
              protected title. The process under{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Section 4 of the Land Act
              </span>
              :
            </p>
            <div className="space-y-2">
              {[
                "Apply to the Parish Land Committee with a sketch map, witnesses, and LC1 letter.",
                "Committee conducts on-ground inspection and public notice (14 days).",
                "Adjudication by the Area Land Committee — neighbours may object.",
                "Approved CCO issued by District Land Board and registered at Ministry of Lands.",
              ].map((step, i) => (
                <div key={i} className="flex gap-2 items-start text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {step}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 italic dark:text-slate-400">
              Tip: A CCO is free of stamp duty and can later be converted to a
              freehold title.
            </p>
          </div>
        ),
      },
      {
        question: "What protections do I have as a tenant?",
        confidence: 97,
        citations: ["Landlord & Tenant Act 2022", "s.12", "s.19"],
        voiceDuration: 4000,
        answer: (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              The{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Landlord and Tenant Act, 2022
              </span>{" "}
              gives you strong statutory protections:
            </p>
            <div className="grid gap-2">
              {[
                {
                  right: "No unlawful eviction",
                  detail:
                    "A landlord cannot evict you without a court order (s.19). Self-help evictions are illegal.",
                },
                {
                  right: "Written agreement required",
                  detail:
                    "Any lease over 1 month must be in writing and signed by both parties (s.5).",
                },
                {
                  right: "Receipt for rent",
                  detail:
                    "You are entitled to a written receipt for every rent payment (s.12).",
                },
                {
                  right: "Habitable premises",
                  detail:
                    "Landlord must maintain the property in a safe, habitable condition (s.15).",
                },
              ].map((item) => (
                <div
                  key={item.right}
                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700"
                >
                  <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Shield size={10} className="text-emerald-500" />
                    {item.right}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 pl-4">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },
];

// ---------- AI Avatar ----------
const AIAvatar = () => (
  <div className="w-9 h-9 rounded-xl bg-linear-to-br from-slate-800 to-slate-900 dark:from-white/10 dark:to-white/5 flex items-center justify-center shrink-0 shadow-lg border border-slate-700/50 dark:border-white/10">
    <Scale className="text-orange-400 w-4 h-4" />
  </div>
);

// ---------- User Avatar ----------
const UserAvatar = () => (
  <div className="w-9 h-9 rounded-xl bg-linear-to-br from-orange-500 to-amber-600 flex items-center justify-center shrink-0 shadow-lg">
    <span className="text-white text-xs font-black">U</span>
  </div>
);

// ---------- Audio Visualiser ----------
const AudioVisualiser = () => (
  <div className="flex items-end gap-[2px] h-3.5">
    {[0.4, 0.7, 1, 0.85, 0.5, 0.9, 0.6].map((scale, i) => (
      <motion.div
        key={i}
        animate={{ scaleY: [scale * 0.4, scale, scale * 0.4] }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          delay: i * 0.07,
          ease: "easeInOut",
        }}
        className="w-[3px] bg-linear-to-t from-orange-500 to-amber-400 rounded-full origin-bottom"
        style={{ height: `${scale * 14}px` }}
      />
    ))}
  </div>
);

// ---------- Main DemoModal ----------
const DemoModal = () => {
  useLockBodyScroll();
  const setShowDemo = usePopStore((state) => state.setShowDemo);

  const [activeTopic, setActiveTopic] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typedText, setTypedText] = useState("");
  const [status, setStatus] = useState<SimStatus>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const charIndexRef = useRef(0);
  const stepRef = useRef(0);
  const isRunningRef = useRef(false);

  const topic = useMemo(() => TOPICS[activeTopic], [activeTopic]);
  const script = useMemo(() => topic.script, [topic]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);


  // Reset when topic changes
  useEffect(() => {
    clearTimer();
    isRunningRef.current = false;
    setMessages([]);
    setTypedText("");
    setStatus("idle");
    setStepIndex(0);
    setIsComplete(false);
    stepRef.current = 0;
    charIndexRef.current = 0;
  }, [activeTopic, clearTimer]);

  // Simulation engine
  useEffect(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const runStep = () => {
      const idx = stepRef.current;
      if (idx >= script.length) {
        setIsComplete(true);
        setStatus("done");
        isRunningRef.current = false;
        return;
      }

      const step = script[idx];
      charIndexRef.current = 0;
      setStatus("typing");

      const typeChar = () => {
        if (charIndexRef.current < step.question.length) {
          setTypedText(step.question.substring(0, charIndexRef.current + 1));
          charIndexRef.current++;
          timeoutRef.current = setTimeout(typeChar, 28 + Math.random() * 28);
        } else {
          timeoutRef.current = setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              { role: "user", content: step.question },
            ]);
            setTypedText("");
            setStatus("processing");

            timeoutRef.current = setTimeout(() => {
              setMessages((prev) => [
                ...prev,
                { role: "ai", content: step },
              ]);
              setStatus("responding");
              setStepIndex(idx + 1);

              timeoutRef.current = setTimeout(() => {
                setStatus("idle");
                stepRef.current = idx + 1;
                timeoutRef.current = setTimeout(runStep, 1200);
              }, step.voiceDuration);
            }, 1400);
          }, 380);
        }
      };

      typeChar();
    };

    const initTimer = setTimeout(runStep, 900);
    return () => {
      clearTimeout(initTimer);
      clearTimer();
      isRunningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopic]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, status, typedText]);

  const handleRestart = useCallback(() => {
    clearTimer();
    isRunningRef.current = false;
    setMessages([]);
    setTypedText("");
    setStatus("idle");
    setStepIndex(0);
    setIsComplete(false);
    stepRef.current = 0;
    charIndexRef.current = 0;

    const initTimer = setTimeout(() => {
      isRunningRef.current = true;

      const runStep = () => {
        const idx = stepRef.current;
        if (idx >= script.length) {
          setIsComplete(true);
          setStatus("done");
          isRunningRef.current = false;
          return;
        }
        const step = script[idx];
        charIndexRef.current = 0;
        setStatus("typing");

        const typeChar = () => {
          if (charIndexRef.current < step.question.length) {
            setTypedText(step.question.substring(0, charIndexRef.current + 1));
            charIndexRef.current++;
            timeoutRef.current = setTimeout(typeChar, 28 + Math.random() * 28);
          } else {
            timeoutRef.current = setTimeout(() => {
              setMessages((prev) => [
                ...prev,
                { role: "user", content: step.question },
              ]);
              setTypedText("");
              setStatus("processing");
              timeoutRef.current = setTimeout(() => {
                setMessages((prev) => [
                  ...prev,
                  { role: "ai", content: step },
                ]);
                setStatus("responding");
                setStepIndex(idx + 1);
                timeoutRef.current = setTimeout(() => {
                  setStatus("idle");
                  stepRef.current = idx + 1;
                  timeoutRef.current = setTimeout(runStep, 1200);
                }, step.voiceDuration);
              }, 1400);
            }, 380);
          }
        };
        typeChar();
      };
      runStep();
    }, 300);

    return () => clearTimeout(initTimer);
  }, [clearTimer, script]);

  const topicColorMap: Record<string, string> = {
    orange:
      "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
    indigo:
      "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800",
    emerald:
      "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-100 flex items-center justify-center p-2 md:p-4"
        style={{ background: "rgba(8,14,28,0.85)" }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 backdrop-blur-md"
          onClick={() => setShowDemo(false)}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-2xl bg-white dark:bg-[#0C1221] rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.5)] border border-slate-200/80 dark:border-white/8 overflow-hidden flex flex-col max-h-[90vh] z-10"
        >
          {/* ---- Header ---- */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/8 bg-slate-50/80 dark:bg-white/3 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
              </div>
              <div className="flex items-center gap-1.5">
                <Scale size={13} className="text-orange-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">
                  LegalAdviser AI
                </span>
                <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 text-[9px] font-black rounded-full border border-orange-200 dark:border-orange-800 uppercase tracking-widest">
                  Live Demo
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRestart}
                title="Restart demo"
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setShowDemo(false)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ---- Topic Tabs ---- */}
          <div className="flex gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-white/8 bg-white dark:bg-[#0C1221] shrink-0 overflow-x-auto scrollbar-none">
            {TOPICS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setActiveTopic(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap border ${
                  activeTopic === i
                    ? topicColorMap[t.color]
                    : "text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* ---- Progress Steps ---- */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50/50 dark:bg-white/[0.02] shrink-0">
            {script.map((_, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                    i < stepIndex
                      ? "bg-orange-500"
                      : i === stepIndex && status !== "done"
                      ? "bg-orange-300 dark:bg-orange-700"
                      : "bg-slate-200 dark:bg-white/10"
                  }`}
                />
                {i < script.length - 1 && (
                  <ChevronRight
                    size={10}
                    className={`shrink-0 ${
                      i < stepIndex - 1
                        ? "text-orange-500"
                        : "text-slate-300 dark:text-white/20"
                    }`}
                  />
                )}
              </div>
            ))}
            <span className="text-[10px] text-slate-400 font-medium ml-1 whitespace-nowrap">
              {Math.min(stepIndex, script.length)}/{script.length}
            </span>
          </div>

          {/* ---- Chat Area ---- */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10"
          >
            {/* Greeting */}
            <motion.div
              key={`greeting-${activeTopic}`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-start gap-3 max-w-[92%]"
            >
              <AIAvatar />
              <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl rounded-tl-sm p-3 shadow-sm">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={11} className="text-orange-400" />
                  <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                    LegalAdviser AI
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {topic.intro}
                </p>
              </div>
            </motion.div>

            {/* Messages */}
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                const isLastAI = !isUser && idx === messages.length - 1;
                // TypeScript narrows via the discriminated union:
                const aiStep = msg.role === "ai" ? msg.content : null;

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 28,
                    }}
                    className={`flex items-start gap-3 ${
                      isUser
                        ? "flex-row-reverse ml-auto max-w-[85%]"
                        : "max-w-[92%]"
                    }`}
                  >
                    {isUser ? <UserAvatar /> : <AIAvatar />}

                    {isUser ? (
                      <div className="bg-linear-to-br from-orange-500 to-amber-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm font-medium shadow-lg shadow-orange-500/20">
                        {msg.content}
                      </div>
                    ) : aiStep ? (
                      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl rounded-tl-sm p-3 shadow-sm space-y-2.5 flex-1 min-w-0">
                        {/* Citations */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {aiStep.citations.map((c) => (
                            <CitationChip
                              key={c}
                              label={c}
                              type={
                                c.toLowerCase().includes("article")
                                  ? "article"
                                  : c.toLowerCase().includes("s.")
                                  ? "section"
                                  : "act"
                              }
                            />
                          ))}
                        </div>

                        {/* Body */}
                        <div>{aiStep.answer}</div>

                        {/* Confidence */}
                        <ConfidenceBar score={aiStep.confidence} />

                        {/* Speaking indicator */}
                        {isLastAI && status === "responding" && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 pt-1"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Reading aloud
                            </span>
                            <AudioVisualiser />
                          </motion.div>
                        )}
                      </div>
                    ) : null}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Processing state */}
            <AnimatePresence>
              {status === "processing" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 ml-12"
                >
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2">
                    <Loader2
                      size={13}
                      className="animate-spin text-orange-500"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Searching Uganda Law Database...
                    </span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                          className="w-1 h-1 rounded-full bg-orange-400"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Completion banner */}
            <AnimatePresence>
              {isComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-2 py-3"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 w-full">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                    <span className="flex items-center gap-1.5 px-3">
                      <Gavel size={11} className="text-orange-500" />
                      Demo complete
                    </span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                  </div>
                  <button
                    onClick={handleRestart}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                  >
                    <RefreshCw size={11} />
                    Replay this scenario
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ---- Input Bar ---- */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-white/8 bg-white dark:bg-[#0C1221] shrink-0">
            <div className="h-12 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center px-3 gap-3 shadow-sm">
              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  status === "responding"
                    ? "bg-orange-100 dark:bg-orange-900/30"
                    : "bg-slate-100 dark:bg-white/10"
                }`}
              >
                <Mic
                  size={15}
                  className={
                    status === "responding"
                      ? "text-orange-500"
                      : "text-slate-400"
                  }
                />
              </div>
              <div className="flex-1 text-sm min-w-0">
                {status === "typing" && typedText ? (
                  <span className="text-slate-800 dark:text-white font-medium">
                    {typedText}
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="inline-block w-0.5 h-4 bg-orange-500 rounded-full ml-0.5 align-middle"
                    />
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 text-sm">
                    {status === "processing"
                      ? "Processing your question..."
                      : status === "responding"
                      ? "AI is responding..."
                      : "Ask about Ugandan Law..."}
                  </span>
                )}
              </div>
              <motion.div
                animate={{
                  backgroundColor: typedText
                    ? "rgb(249,115,22)"
                    : "rgb(226,232,240)",
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0"
              >
                <ArrowRight
                  size={15}
                  className={typedText ? "text-white" : "text-slate-400"}
                />
              </motion.div>
            </div>
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-2">
              Simulated demo — no data sent. Try the real thing after sign-up.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DemoModal;
