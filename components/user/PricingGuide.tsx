import { AlertCircle } from "lucide-react";
import React from "react";

const PricingGuide = () => {
  return (
    <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
      <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity duration-300 group-hover:rotate-12">
        <AlertCircle size={120} />
      </div>
      <h4 className="font-bold text-lg mb-2">Pricing Guide</h4>
      <ul className="space-y-2 text-sm text-indigo-100">
        <li className="flex justify-between">
          <span>Text Queries</span>
          <span className="font-mono font-bold">$0.03 / 1k tokens</span>
        </li>
        <li className="flex justify-between">
          <span>Voice Minutes</span>
          <span className="font-mono font-bold">$0.05 / min</span>
        </li>
        <li className="flex justify-between">
          <span>Daily Free</span>
          <span className="font-mono font-bold">1,000 Tokens</span>
        </li>
      </ul>
    </div>
  );
};

export default PricingGuide;
