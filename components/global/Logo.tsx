import { Scale } from "lucide-react";

export const LogoIcon = () => {
  return (
    <div className="bg-linear-to-br from-orange-800 to-indigo-500 p-2.5 rounded-xl shadow-lg shadow-orange-500/20 transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
      <Scale className="w-6 h-6 text-white" />
    </div>
  );
};
export const LogoText = () => {
  return (
    <span className="text-xl font-bold text-indigo-400 tracking-tight transition-all duration-300">
      Legal
      <span className="text-orange-400 dark:text-white">Adviser</span>
    </span>
  );
};
const Logo = () => {
  return (
    <div className="inline-flex items-center gap-3 cursor-pointer group">
      <LogoIcon />
      <LogoText />
    </div>
  );
};

export default Logo;
