import { fadeInUp, faqs } from "@/constants";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const Faq = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };
  return (
    <section className="py-24 relative z-10" id="faq">
      <div className="max-w-3xl mx-auto px-4">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.5 }}
          variants={fadeInUp}
          className="text-3xl font-extrabold text-center text-slate-900 dark:text-white mb-12"
        >
          Frequently Asked Questions
        </motion.h2>
        <div className="space-y-4">
          {faqs.map((item, i) => (
            <motion.div
              key={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: "-50px" }}
              variants={fadeInUp}
              className={`border rounded-2xl overflow-hidden transition-all duration-300 ${openFaq === i ? "border-orange-500/50 dark:border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]" : "border-slate-200 dark:border-white/10"}`}
            >
              <button
                id={`faq-question-${i}`}
                onClick={() => toggleFaq(i)}
                aria-expanded={openFaq === i}
                aria-controls={`faq-answer-${i}`}
                className="w-full px-6 py-4 flex justify-between items-center bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-2xl"
              >
                <span
                  className={`font-bold text-left transition-colors ${openFaq === i ? "text-orange-600 dark:text-orange-400" : "text-slate-800 dark:text-slate-200"}`}
                >
                  {item.q}
                </span>
                <motion.div
                  animate={{ rotate: openFaq === i ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  aria-hidden="true"
                >
                  {openFaq === i ? (
                    <ChevronUp size={20} className="text-orange-500" />
                  ) : (
                    <ChevronDown size={20} className="text-slate-400" />
                  )}
                </motion.div>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    id={`faq-answer-${i}`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 py-4 text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 border-l-4 border-l-orange-500">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Faq;
