"use client";

import { useRouter } from "nextjs-toploader/app";
import ChatInterface from "./ChatInterface";

interface ChatInterfaceWrapperProps {
  chatId: string | null;
  serverChatId?: string | null;
  serverMessages?: ChatMessageRecord[];
  serverHasMore?: boolean;
}

export default function ChatInterfaceWrapper({
  chatId,
  serverChatId,
  serverMessages,
  serverHasMore,
}: ChatInterfaceWrapperProps) {
  const router = useRouter();

  return (
    <ChatInterface
      chatId={chatId}
      onChatCreated={(newId) => {
        router.push(`/dashboard/user/chat/${newId}`);
      }}
      serverChatId={serverChatId}
      serverMessages={serverMessages}
      serverHasMore={serverHasMore}
    />
  );
}
