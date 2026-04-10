import { useThemeStore } from "@/store";
import { motion } from "framer-motion";
import { Moon, Sparkles, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomButton } from "../ui/custom-button";
import Logo from "../global/Logo";

const HomeNavBar = () => {
  const router = useRouter();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 50, damping: 20 }}
      className="fixed top-0 w-full z-50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/20 dark:border-white/5 transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center space-x-2 group cursor-pointer"
          onClick={() => router.push("/login")}
        >
          <Logo />
        </motion.div>

        <div className="hidden md:flex items-center space-x-8">
          {["Features", "Pricing", "FAQ"].map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors relative group"
            >
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-linear-to-r from-amber-500 to-orange-600 transition-all duration-300 group-hover:w-full"></span>
            </Link>
          ))}
        </div>

        <div className="flex items-center space-x-4">
          <motion.button
            whileHover={{ rotate: 180, scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.3 }}
            onClick={toggleTheme}
            className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-white/10"
          >
            {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
          </motion.button>

          <CustomButton
            component={Link}
            href="/login"
            variant="transparent"
            shape="pill"
            borderLeftWidth="4px"
            borderLeftColor="#4f46e5"
            borderRightWidth="4px"
            borderRightColor="#ea580c"
            className="bg-slate-100/50 dark:bg-slate-800/50"
            leftIcon={<Sparkles />}
            hoverEffect="glow"
          >
            Get started
          </CustomButton>
        </div>
      </div>
    </motion.nav>
  );
};

export default HomeNavBar;
