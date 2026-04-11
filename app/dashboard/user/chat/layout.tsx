import { getCurrentUser } from "@/lib/actions/auth";
import { getChatSessions } from "@/lib/actions/chat";
import ChatLayoutClient from "@/components/global/ChatLayoutClient";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  let initialSessions: ChatSession[] = [];
  const sessionsResult = await getChatSessions(user.id);
  if (sessionsResult.success && sessionsResult.sessions) {
    initialSessions = sessionsResult.sessions;
  }

  return (
    <ChatLayoutClient serverSessions={initialSessions}>
      {children}
    </ChatLayoutClient>
  );
}
