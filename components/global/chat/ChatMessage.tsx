import React, { memo } from "react";
import {
  User as UserIcon,
  Scale,
  Image as ImageIcon,
  FileText,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import type { UIMessage } from "ai";
import MakdownFormater from "@/components/global/chat/MakdownFormater";
import {
  getMessageFile,
  getMessageReasoning,
  getMessageText,
  isMessageStreaming,
  isReasoningStreaming,
  ThinkingBlock,
} from "./chat-hepers";
import { formatUniversalDate } from "@/utils/helpers";

interface ChatMessageProps {
  msg: UIMessage;
  isLast: boolean;
  isLoading: boolean;
  chatError?: Error;
  connectionStatus: string;
  onRetry: () => void;
}

export const ChatMessage = memo(
  ({
    msg,
    isLast,
    isLoading,
    chatError,
    connectionStatus,
    onRetry,
  }: ChatMessageProps) => {
    const msgText = getMessageText(msg);
    const msgReasoning = getMessageReasoning(msg);
    const msgFile = getMessageFile(msg);
    const msgIsStreaming = isMessageStreaming(msg);
    const msgReasoningStreaming = isReasoningStreaming(msg);
    const isAssistant = msg.role === "assistant";

    return (
      <div
        key={msg.id}
        className={`flex items-start max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300 ${
          msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
        }`}
      >
        <div
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-105 ${
            msg.role === "user"
              ? "bg-linear-to-br from-amber-500 to-orange-700 ml-3 shadow-md"
              : chatError
                ? "bg-red-100 dark:bg-red-900/30 mr-3"
                : "bg-orange-100 dark:bg-orange-900/30 mr-3"
          }`}
        >
          {msg.role === "user" ? (
            <UserIcon size={20} className="text-white" />
          ) : chatError ? (
            <AlertTriangle
              size={20}
              className="text-red-600 dark:text-red-500"
            />
          ) : (
            <Scale size={20} className="text-orange-600 dark:text-orange-500" />
          )}
        </div>

        <div
          className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-full overflow-hidden`}
        >
          {/* Reasoning / Thinking Block — only for assistant messages */}
          {isAssistant && msgReasoning && (
            <ThinkingBlock
              reasoning={msgReasoning}
              isStreaming={msgReasoningStreaming}
            />
          )}

          {/* Message container */}
          {(msg.role === "user" ||
            msgText.length > 0 ||
            !!msgFile ||
            !msgReasoning ||
            !msgReasoningStreaming) && (
            <div
              className={`px-2 md:px-4 py-2 md:py-4 shadow-sm rounded-b-lg text-sm leading-relaxed w-full transition-all hover:shadow-md ${
                msg.role === "user"
                  ? "bg-linear-to-br from-orange-900 to-amber-600  text-white rounded-tr-none shadow-orange-500/20"
                  : chatError
                    ? "bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-slate-800 dark:text-slate-200 rounded-tl-none"
                    : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none"
              } ${isAssistant && msgReasoning ? "rounded-tl-none mt-2" : ""}`}
            >
              {/* File attachment display */}
              {msgFile && (
                <div
                  className={`mb-3 p-3 rounded-lg flex items-center space-x-3 ${
                    msg.role === "user"
                      ? "bg-white/10"
                      : "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div
                    className={`p-2 rounded flex items-center justify-center ${msg.role === "user" ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}
                  >
                    {msgFile.type.includes("image") ? (
                      <ImageIcon
                        size={18}
                        className={
                          msg.role === "user" ? "text-white" : "text-slate-500"
                        }
                      />
                    ) : (
                      <FileText
                        size={18}
                        className={
                          msg.role === "user" ? "text-white" : "text-slate-500"
                        }
                      />
                    )}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-medium truncate text-xs opacity-90 max-w-[200px]">
                      {msgFile.name}
                    </span>
                    <span className="text-[10px] opacity-70">
                      Attached Document
                    </span>
                  </div>
                </div>
              )}

              <div
                className={`prose prose-sm max-w-none wrap-break-word ${msg.role === "user" ? "prose-invert" : "dark:prose-invert"}`}
              >
                <MakdownFormater
                  content={msgText}
                  role={msg.role as "user" | "assistant" | "system" | "data"}
                  isStreaming={msgIsStreaming}
                />
              </div>

              {chatError && !isLoading && isLast && (
                <button
                  onClick={onRetry}
                  disabled={connectionStatus === "offline"}
                  className="mt-3 flex items-center space-x-2 text-xs font-medium text-red-600 dark:text-slate-100 hover:text-red-700 dark:hover:text-red-300 transition-colors bg-white/50 dark:bg-black/10 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={12} />
                  <span>
                    {connectionStatus === "offline"
                      ? "Connect to retry"
                      : "Retry Request"}
                  </span>
                </button>
              )}
            </div>
          )}
          <span
            className="text-xs text-slate-400 dark:text-slate-500 mt-2 mx-1"
            suppressHydrationWarning
          >
            {formatUniversalDate(
              ((msg.metadata as { createdAt?: unknown } | undefined)
                ?.createdAt ??
                (msg as { createdAt?: unknown }).createdAt) as Parameters<
                typeof formatUniversalDate
              >[0],
            )}
          </span>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // If a message was not the last message, and is still not the last message,
    // its rendering depends solely on its content ('msg'). Other props (isLoading,
    // chatError, connectionStatus, onRetry) only affect the last message's retry UI.
    if (!prevProps.isLast && !nextProps.isLast) {
      return prevProps.msg === nextProps.msg;
    }
    
    // For the last message, or when a message transitions to/from being the last,
    // do a full comparison of all props.
    return (
      prevProps.msg === nextProps.msg &&
      prevProps.isLast === nextProps.isLast &&
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.chatError === nextProps.chatError &&
      prevProps.connectionStatus === nextProps.connectionStatus &&
      prevProps.onRetry === nextProps.onRetry
    );
  }
);
ChatMessage.displayName = "ChatMessage";
