"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";

interface HelpFAQProps {
  articles: HelpArticle[];
}

export const HelpFAQ: React.FC<HelpFAQProps> = ({ articles }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  if (articles.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="text-orange-500" size={20} />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Frequently Asked Questions</h2>
      </div>

      <div className="space-y-3">
        {articles.map((article) => (
          <div 
            key={article.id}
            className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden transition-all"
          >
            <button
              onClick={() => setOpenId(openId === article.id ? null : article.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
            >
              <span className="font-medium text-slate-800 dark:text-slate-200">{article.title}</span>
              {openId === article.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            
            {openId === article.id && (
              <div className="px-4 pb-4 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {article.content}
                </p>
                <div className="mt-3 flex">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-500">
                    {article.category}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
