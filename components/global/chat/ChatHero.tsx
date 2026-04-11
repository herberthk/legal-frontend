import { memo } from "react";
import { Scale, FileText, AlertTriangle, User as UserIcon } from "lucide-react";
import Logo from "@/components/global/Logo";

interface ChatHeroProps {
  user: User | null;
  onSuggestionClick: (prompt: string, isFileUpload?: boolean) => void;
}

export const ChatHero = memo(({ user, onSuggestionClick }: ChatHeroProps) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500 pb-10 mt-auto mb-auto">
      <Logo
        size="lg"
        shape="rounded"
        showText={false}
        className="mb-8"
        iconClass="drop-shadow-md"
        strokeWidth={1.5}
      />
      <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
        Good{" "}
        {new Date().getHours() < 12
          ? "morning"
          : new Date().getHours() < 18
            ? "afternoon"
            : "evening"}
        , {user?.name?.split(" ")[0] || "there"}
      </h1>
      <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mb-12">
        I am your Legal Adviser specifically trained on Ugandan Law. How can I
        help you today?
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
        {[
          {
            icon: <FileText size={20} className="text-blue-500" />,
            title: "Review a document",
            subtitle: "Upload a contract or agreement for analysis",
            prompt:
              "Please review this document and summarize the key clauses, potential risks, and obligations.",
            isFileUpload: true,
          },
          {
            icon: <Scale size={20} className="text-orange-500" />,
            title: "Constitutional Law",
            subtitle: "Questions about rights and governance",
            prompt:
              "Explain the fundamental human rights guaranteed under Chapter Four of the Constitution of Uganda.",
          },
          {
            icon: <AlertTriangle size={20} className="text-amber-500" />,
            title: "Tax Administration",
            subtitle: "Compliance and URA regulations",
            prompt:
              "What are the penalties for late filing of income tax returns under the Tax Procedures Code Act?",
          },
          {
            icon: <UserIcon size={20} className="text-emerald-500" />,
            title: "Employment Law",
            subtitle: "Worker rights and termination",
            prompt:
              "What is the legally required notice period for terminating an employee who has worked for 5 years?",
          },
        ].map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() =>
              onSuggestionClick(suggestion.prompt, suggestion.isFileUpload)
            }
            className="p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:border-orange-500/50 dark:hover:border-orange-500/50 hover:shadow-md transition-all text-left group flex items-start gap-4"
          >
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 group-hover:scale-110 transition-transform">
              {suggestion.icon}
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                {suggestion.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {suggestion.subtitle}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});
ChatHero.displayName = "ChatHero";
