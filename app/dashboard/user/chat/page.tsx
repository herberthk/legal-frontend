import ChatContainer from "@/components/global/ChatContainer";
import { getChatSessions } from "@/lib/actions/chat";
import { getCurrentUser } from "@/lib/actions/auth";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let initialSessions: ChatSession[] = [];
  const sessionsResult = await getChatSessions(user.id);
  if (sessionsResult.success && sessionsResult.sessions) {
    initialSessions = sessionsResult.sessions;
  }

  return (
    <ChatContainer
      serverChatId={null}
      serverMessages={undefined}
      serverSessions={initialSessions}
    />
  );
}
