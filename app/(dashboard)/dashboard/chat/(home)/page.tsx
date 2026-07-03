import ChatInterfaceWrapper from "@/components/global/chat/ChatInterfaceWrapper";
import DirectionalTransition from "@/components/global/DirectionalTransition";

export default function ChatPage() {
  return (
    <DirectionalTransition>
      <ChatInterfaceWrapper
        chatId={null}
        serverChatId={null}
        serverMessages={undefined}
      />
    </DirectionalTransition>
  );
}
