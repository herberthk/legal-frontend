import {
  COST_PER_THOUSAND_TOKENS,
  COST_PER_VOICE_MINUTE,
  FREE_TEXT_TOKENS,
  USD_TO_UGX_EXCHANGE_RATE,
} from "@/constants";
import { AlertCircle } from "lucide-react";

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
          <span className="font-mono font-bold">
            ${COST_PER_THOUSAND_TOKENS} (UGX{" "}
            {COST_PER_THOUSAND_TOKENS * USD_TO_UGX_EXCHANGE_RATE}) / 1k tokens
          </span>
        </li>
        <li className="flex justify-between">
          <span>Voice Minutes</span>
          <span className="font-mono font-bold">
            ${COST_PER_VOICE_MINUTE} (UGX{" "}
            {COST_PER_VOICE_MINUTE * USD_TO_UGX_EXCHANGE_RATE}) / min
          </span>
        </li>
        <li className="flex justify-between">
          <span>Free</span>
          <span className="font-mono font-bold">
            {FREE_TEXT_TOKENS.toLocaleString()} Tokens every 5 days
          </span>
        </li>
      </ul>
    </div>
  );
};

export default PricingGuide;
