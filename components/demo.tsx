import { useEffect, useRef, useState } from "react";
import {
  Scale,
  BookOpen,
  ArrowRight,
  Users,
  X,
  Loader2,
  Mic,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePopStore } from "@/store";

// --- Demo Video Component ---
const DemoModal = () => {
  const setShowDemo = usePopStore((state) => state.setShowDemo);
  const [messages, setMessages] = useState<
    { role: "user" | "ai"; content: React.ReactNode }[]
  >([]);
  const [typedText, setTypedText] = useState("");
  const [status, setStatus] = useState<
    "idle" | "typing" | "processing" | "speaking"
  >("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Script definition
  const script = [
    {
      question: "What does Article 21 say about discrimination?",
      answer: (
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-orange-500" />
            Article 21: Equality & Freedom
          </h4>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-2">
            Clause (1) states that all persons are equal before and under the
            law in all spheres of political, economic, social and cultural life
            and in every other respect and shall enjoy equal protection of the
            law.
          </p>
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              &quot;A person shall not be discriminated against on the ground of
              sex, race, colour, ethnic origin, tribe, birth, creed or
              religion...&quot;
            </p>
          </div>
        </div>
      ),
      voiceDuration: 3500,
    },
    {
      question: "So, can a company refuse to hire me because of my religion?",
      answer: (
        <div className="space-y-2">
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
            <span className="font-bold text-red-500">Absolutely not.</span>{" "}
            Based on <strong>Article 21(2)</strong> and the{" "}
            <strong>Employment Act, 2006</strong>, discrimination in employment
            based on religion (creed) is strictly prohibited.
          </p>
          <ul className="list-disc pl-4 space-y-1 text-xs text-slate-500 dark:text-slate-400 mt-2">
            <li>Employers must assess based on merit/ability.</li>
            <li>
              Religious discrimination is a violation of fundamental rights.
            </li>
          </ul>
        </div>
      ),
      voiceDuration: 3000,
    },
    {
      question: "What steps can I take if they do?",
      answer: (
        <div className="space-y-2">
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-2">
            You have legal remedies available:
          </p>
          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                1
              </div>
              <span>
                Complaint to <strong>District Labour Officer</strong>.
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                2
              </div>
              <span>
                Petition <strong>Equal Opportunities Commission</strong>.
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                3
              </div>
              <span>
                Suit in <strong>Industrial Court</strong>.
              </span>
            </div>
          </div>
        </div>
      ),
      voiceDuration: 4000,
    },
  ];

  useEffect(() => {
    let currentStep = 0;
    let charIndex = 0;
    let timeoutId: NodeJS.Timeout;

    const runSimulation = () => {
      if (currentStep >= script.length) return;

      const step = script[currentStep];

      // Phase 1: Typing
      setStatus("typing");
      const typeChar = () => {
        if (charIndex < step.question.length) {
          setTypedText(step.question.substring(0, charIndex + 1));
          charIndex++;
          timeoutId = setTimeout(typeChar, 30 + Math.random() * 30); // Random typing speed
        } else {
          // Finished typing
          timeoutId = setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              { role: "user", content: step.question },
            ]);
            setTypedText("");
            charIndex = 0;

            // Phase 2: Processing
            setStatus("processing");
            timeoutId = setTimeout(() => {
              // Phase 3: AI Responds
              setMessages((prev) => [
                ...prev,
                { role: "ai", content: step.answer },
              ]);
              setStatus("speaking");

              // Phase 4: Speaking Duration
              timeoutId = setTimeout(() => {
                setStatus("idle");
                currentStep++;
                timeoutId = setTimeout(runSimulation, 1000); // Pause before next Q
              }, step.voiceDuration);
            }, 1200); // Processing time
          }, 400); // Pause before sending
        }
      };

      typeChar();
    };

    // Initial delay
    timeoutId = setTimeout(runSimulation, 800);

    return () => clearTimeout(timeoutId);
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status, typedText]);

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#0B1120] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="ml-4 text-xs font-mono text-slate-400">
              LegalAdviser UG - Live Demo
            </span>
          </div>
          <button
            onClick={() => setShowDemo(false)}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-slate-50 dark:bg-[#0f172a] relative p-6 md:p-8 flex flex-col overflow-hidden">
          {/* Chat Area */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 pr-2"
          >
            {/* Initial Greeting */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start space-x-4 max-w-[90%]"
            >
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-slate-800 to-slate-900 flex items-center justify-center shrink-0 shadow-lg">
                <Scale className="text-white w-5 h-5" />
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-slate-700 dark:text-slate-200 text-sm">
                  Welcome. I am knowledgeable about the{" "}
                  <span className="font-bold text-orange-600">
                    1995 Constitution of Uganda
                  </span>
                  . Ask me anything.
                </p>
              </div>
            </motion.div>

            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start space-x-4 max-w-[90%] ${msg.role === "user" ? "ml-auto flex-row-reverse space-x-reverse" : ""}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg ${msg.role === "user" ? "bg-slate-200 dark:bg-slate-700" : "bg-linear-to-br from-slate-800 to-slate-900"}`}
                >
                  {msg.role === "user" ? (
                    <Users
                      size={20}
                      className="text-slate-500 dark:text-slate-400"
                    />
                  ) : (
                    <Scale className="text-white w-5 h-5" />
                  )}
                </div>
                <div
                  className={`p-4 rounded-2xl shadow-sm text-sm ${msg.role === "user" ? "bg-linear-to-r from-orange-500 to-amber-600 text-white rounded-tr-none" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-none relative overflow-hidden"}`}
                >
                  {msg.content}
                  {msg.role === "ai" &&
                    idx === messages.length - 1 &&
                    status === "speaking" && (
                      <div className="mt-3 flex items-center space-x-3 bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-full w-fit border border-slate-100 dark:border-slate-700/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Speaking...
                        </span>
                        <div className="flex space-x-0.5 items-end h-3">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ height: [3, 10, 3] }}
                              transition={{
                                duration: 0.4,
                                repeat: Infinity,
                                delay: i * 0.1,
                              }}
                              className="w-0.5 bg-orange-500 rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </motion.div>
            ))}

            {/* Processing State */}
            <AnimatePresence>
              {status === "processing" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center space-x-2 text-slate-400 text-xs ml-14"
                >
                  <Loader2 size={14} className="animate-spin" />
                  <span>Analyzing Constitution & Acts...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Bar */}
          <div className="mt-6 relative shrink-0">
            <div className="h-14 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center px-4 shadow-sm">
              <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-400 mr-3">
                <Mic size={20} />
              </div>
              <div className="flex-1 text-sm text-slate-800 dark:text-white font-medium">
                {status === "typing" && (
                  <span>
                    {typedText}
                    <span className="animate-pulse">|</span>
                  </span>
                )}
                {status !== "typing" && !typedText && (
                  <span className="text-slate-400 italic">
                    Type a message...
                  </span>
                )}
              </div>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-colors ${typedText ? "bg-orange-500 shadow-orange-500/30" : "bg-slate-200 dark:bg-slate-700 shadow-none"}`}
              >
                <ArrowRight
                  size={16}
                  className={typedText ? "text-white" : "text-slate-400"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoModal;
