import {
  cardEntrance,
  fadeInUp,
  features,
  staggerContainer,
} from "@/constants";
import { motion } from "framer-motion";

const Features = () => {
  return (
    <section className="md:py-24 py-12 relative z-10" id="features">
      <div className="max-w-7xl mx-auto px-3 md:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeInUp}
          style={{ willChange: "transform, opacity" }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest mb-3 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/20 w-fit mx-auto border border-orange-200 dark:border-orange-800">
            Why LegalAdviser?
          </h2>
          <h3 className="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-4">
            Replace confusion with clarity.
          </h3>
          <p className="text-sm italic text-slate-600 dark:text-slate-400 md:text-lg">
            Traditional legal consultations are expensive, intimidating, and
            slow. We use advanced AI to provide immediate, affordable, and
            accurate legal guidance specific to Uganda.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid md:grid-cols-3 gap-8 perspective-1000"
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              variants={cardEntrance}
              style={{ willChange: "transform" }}
              whileHover={{
                y: -10,
                scale: 1.02,
                boxShadow:
                  "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                transition: { type: "spring", stiffness: 300, damping: 20 },
              }}
              className="relative group bg-white dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-lg dark:shadow-none transition-all duration-300 backdrop-blur-sm overflow-hidden"
            >
              {/* Gradient Border Overlay on Hover */}
              <div className="absolute inset-0 border-2 border-transparent group-hover:border-orange-500/30 rounded-3xl transition-colors duration-300 pointer-events-none"></div>
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-500 transform translate-x-4 -translate-y-4" aria-hidden="true">
                <feature.icon
                  size={100}
                  className={`text-${feature.color}-500`}
                />
              </div>

              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-6 bg-${feature.color}-100 dark:bg-${feature.color}-900/20 text-${feature.color}-600 dark:text-${feature.color}-400 shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.05)]`}
                aria-hidden="true"
              >
                <feature.icon size={28} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                {feature.title}
              </h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
