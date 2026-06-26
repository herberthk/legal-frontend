'use client'
import { motion } from 'framer-motion'
import { Star } from "lucide-react";
import Image from "next/image";
import { cardEntrance, fadeInUp, staggerContainer } from "@/constants";

const Proof = () => {
  return (
    <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={staggerContainer}
          style={{ willChange: "transform, opacity" }}
          className="border-y border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/5 backdrop-blur-sm py-10 z-10 relative"
          aria-label="Social Proof"
        >
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-around items-center gap-8 md:gap-12">
            <motion.div
              variants={fadeInUp}
              style={{ willChange: "transform, opacity" }}
              className="text-center group cursor-default"
            >
              <motion.p className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white mb-1 transition-all group-hover:text-orange-500 dark:group-hover:text-orange-400 group-hover:scale-110 duration-300">
                5,000+
              </motion.p>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold group-hover:text-orange-600/70 transition-colors">
                Cases Analyzed
              </p>
            </motion.div>
            <motion.div
              variants={fadeInUp}
              style={{ willChange: "transform, opacity" }}
              className="text-center group cursor-default"
            >
              <motion.p className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white mb-1 transition-all group-hover:text-orange-500 dark:group-hover:text-orange-400 group-hover:scale-110 duration-300">
                98%
              </motion.p>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold group-hover:text-orange-600/70 transition-colors">
                Accuracy Rate
              </p>
            </motion.div>
            <motion.div
              variants={fadeInUp}
              style={{ willChange: "transform, opacity" }}
              className="text-center group cursor-default"
            >
              <motion.p className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white mb-1 transition-all group-hover:text-orange-500 dark:group-hover:text-orange-400 group-hover:scale-110 duration-300">
                24/7
              </motion.p>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold group-hover:text-orange-600/70 transition-colors">
                Availability
              </p>
            </motion.div>
            <div
              className="hidden md:block h-10 w-px bg-slate-200 dark:bg-white/10"
              aria-hidden="true"
            ></div>
            <motion.div
              variants={cardEntrance}
              style={{ willChange: "transform, opacity" }}
              className="flex items-center space-x-2"
            >
              <div className="flex -space-x-2" aria-label="User testimonials">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 overflow-hidden shadow-md"
                  >
                    <Image
                      src={`https://ui-avatars.com/api/?name=User+${i}&background=random`}
                      alt={`User avatar ${i}`}
                      width={40}
                      height={40}
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
              <div className="text-left ml-2">
                <div
                  className="flex text-amber-400 drop-shadow-sm"
                  aria-label="5 out of 5 stars"
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={14}
                      fill="currentColor"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Rated 4.9/5 by Ugandans
                </p>
              </div>
            </motion.div>
          </div>
        </motion.section>
  )
}

export default Proof