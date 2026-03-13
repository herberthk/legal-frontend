import ChatContainer from "@/components/global/ChatContainer";
import { getChatMessages, getChatSessions } from "@/lib/actions/chat";
import { getCurrentUser } from "@/lib/actions/auth";

export default async function ChatPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const chatId = searchParams.chatId as string | undefined;

  const user = await getCurrentUser();
  if (!user) return null;

  let initialMessages = null;
  if (chatId) {
    const result = await getChatMessages(chatId);
    if (result.success && result.messages) {
      initialMessages = result.messages;
    }
  }

  let initialSessions: ChatSession[] = [];
  const sessionsResult = await getChatSessions(user.id);
  if (sessionsResult.success && sessionsResult.sessions) {
    initialSessions = sessionsResult.sessions;
  }

  return (
    <ChatContainer
      serverChatId={chatId || null}
      serverMessages={initialMessages}
      serverSessions={initialSessions}
    />
  );
}
