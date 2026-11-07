import ChatInterfaceWrapper from "@/components/global/chat/ChatInterfaceWrapper";
import { getChatMessages } from "@/lib/actions/chat";
import { getCurrentUser } from "@/lib/actions/auth";
import DirectionalTransition from "@/components/global/DirectionalTransition";

const ChatPage = async (props: { params: Promise<{ chatId: string }> }) => {
  const { chatId } = await props.params;

  // Parallelize user fetch and message fetch
  const [user, messagesResult] = await Promise.all([
    getCurrentUser(),
    getChatMessages(chatId),
  ]);

  if (!user) return null;

  // Load messages from the parallel result
  let initialMessages = undefined;
  let serverHasMore = false;
  if (messagesResult.success && messagesResult.messages) {
    initialMessages = messagesResult.messages;
    serverHasMore = messagesResult.hasMore ?? false;
  }
  return (
     <DirectionalTransition>
        {/* key={chatId} forces a full remount when switching chats via the sidebar,
            preventing stale chatSessionIdRef and useChat state from carrying over. */}
        <ChatInterfaceWrapper
          key={chatId}
          chatId={chatId}
          serverChatId={chatId}
          serverMessages={initialMessages}
          serverHasMore={serverHasMore}
        />
    </DirectionalTransition>
  );
};

export default ChatPage;
