import ChatContainer from "@/components/global/ChatContainer";
import { getChatMessages, getChatSessions } from "@/lib/actions/chat";
import { getCurrentUser } from "@/lib/actions/auth";

export default async function ChatPage(props: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await props.params;
  const user = await getCurrentUser();
  if (!user) return null;

  // Load messages for this specific chat session
  let initialMessages = null;
  const result = await getChatMessages(chatId);
  if (result.success && result.messages) {
    initialMessages = result.messages;
  }

  // Load sidebar sessions
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
    />
  );
}
