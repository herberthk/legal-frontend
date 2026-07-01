// Topic scenario data — all JSX-heavy content lives here
// keeping it in a separate file keeps the main modal thin and fast to parse.

import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Home,
  Shield,
} from "lucide-react";
import type { ScriptStep } from "./types";

export const DEMO_INTRO = "Hello! I am LegalAdviser AI. I can guide you through Constitutional Rights, Employment Law, and Land & Property matters in Uganda. Ask me anything!";

export const DEMO_SCRIPT: ScriptStep[] = [
  /* ------------------------------------------------------------------ */
  /*  1. Constitutional Rights                                            */
  /* ------------------------------------------------------------------ */
      {
        id: "rights-1",
        topicColor: "orange",
        topicLabel: "Constitutional Rights",
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
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
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
        id: "rights-2",
        topicColor: "orange",
        topicLabel: "Constitutional Rights",
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
              <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
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
        id: "rights-3",
        topicColor: "orange",
        topicLabel: "Constitutional Rights",
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
                  desc: "Apply directly to the High Court under Art. 50 — no filing fee required for human rights matters.",
                },
                {
                  step: "Constitutional Court",
                  desc: "If a law itself violates the Constitution, petition the Constitutional Court under Art. 137.",
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
  /* ------------------------------------------------------------------ */
  /*  2. Employment Law                                                   */
  /* ------------------------------------------------------------------ */
      {
        id: "emp-1",
        topicColor: "indigo",
        topicLabel: "Employment Law",
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
        id: "emp-2",
        topicColor: "indigo",
        topicLabel: "Employment Law",
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
        id: "emp-3",
        topicColor: "indigo",
        topicLabel: "Employment Law",
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
                  desc: "Can award reinstatement, back pay, or up to 24 months wages.",
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
  /* ------------------------------------------------------------------ */
  /*  3. Land & Property                                                  */
  /* ------------------------------------------------------------------ */
      {
        id: "land-1",
        topicColor: "emerald",
        topicLabel: "Land & Property",
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
                  desc: "Communal ownership governed by local customs. Can be converted to Freehold via CCO.",
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
        id: "land-2",
        topicColor: "emerald",
        topicLabel: "Land & Property",
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
        id: "land-3",
        topicColor: "emerald",
        topicLabel: "Land & Property",
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
];
