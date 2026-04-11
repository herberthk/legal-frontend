import React, { memo } from "react";
import { WifiOff, RefreshCw, Wifi } from "lucide-react";
import BillingError from "../modal/BillingError";
import ChatError from "../modal/ChatError";

interface ChatStatusBannersProps {
  connectionStatus: string;
  showOnlineBadge: boolean;
  billingBannerVisible: boolean;
  billingError: string | null;
  dismissBillingBanner: () => void;
  chatErrorBannerVisible: boolean;

  chatError?: Error;
  dismissChatErrorBanner: () => void;
  handleRetry: () => void;
}

export const ChatStatusBanners = memo(
  ({
    connectionStatus,
    showOnlineBadge,
    billingBannerVisible,
    billingError,
    dismissBillingBanner,
    chatErrorBannerVisible,
    chatError,
    dismissChatErrorBanner,
    handleRetry,
  }: ChatStatusBannersProps) => {
    return (
      <div className="absolute w-full top-0 z-50 transition-all duration-300">
        {connectionStatus === "offline" && (
          <div className="bg-red-500 text-white text-xs font-bold py-1 px-4 text-center flex justify-center items-center gap-2 shadow-md">
            <WifiOff size={12} className="animate-pulse" />
            <span>No Internet Connection. Retrying...</span>
          </div>
        )}
        {connectionStatus === "reconnecting" && (
          <div className="bg-amber-500 text-white text-xs font-bold py-1 px-4 text-center flex justify-center items-center gap-2 shadow-md">
            <RefreshCw size={12} className="animate-spin" />
            <span>Restoring Connection...</span>
          </div>
        )}
        {connectionStatus === "connected" && showOnlineBadge && (
          <div className="bg-green-500 text-white text-xs font-bold py-1 px-4 text-center flex justify-center items-center gap-2 shadow-md animate-in slide-in-from-top-0 fade-in duration-300">
            <Wifi size={12} />
            <span>Back Online</span>
          </div>
        )}
        {/* ── Billing Insufficient-Funds Banner ─────────────────────────── */}
        {billingBannerVisible && billingError && (
          <BillingError
            billingError={billingError}
            dismissBillingBanner={dismissBillingBanner}
          />
        )}
        {/* ── Chat Error Banner ─────────────────────────────────────────── */}
        {chatErrorBannerVisible && chatError && !billingError && (
          <ChatError
            chatError={chatError}
            dismissChatErrorBanner={dismissChatErrorBanner}
            handleRetry={handleRetry}
          />
        )}
      </div>
    );
  },
);
ChatStatusBanners.displayName = "ChatStatusBanners";
