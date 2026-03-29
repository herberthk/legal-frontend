import ChatContainer from "@/components/global/ChatContainer";
import { getChatMessages, getChatSessions } from "@/lib/actions/chat";
import { getCurrentUser } from "@/lib/actions/auth";

export default async function ChatPage(props: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await props.params;

  // Parallelize user fetch and message fetch (messages don't depend on user ID)
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

  // Load sidebar sessions (depends on user.id)
  let initialSessions: ChatSession[] = [];
  const sessionsResult = await getChatSessions(user.id);
  if (sessionsResult.success && sessionsResult.sessions) {
    initialSessions = sessionsResult.sessions;
  }

  return (
    <ChatContainer
      serverChatId={chatId}
      serverMessages={initialMessages}
      serverSessions={initialSessions}
      serverHasMore={serverHasMore}
    />
  );
}
