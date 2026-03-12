import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { BASE_SYSTEM_INSTRUCTION } from "@/constants";
import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";
import { PRICE_PER_TOKEN } from "@/constants";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * Extracts the authenticated user ID from the session cookie.
 */
async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) return null;
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId: bodySessionId }: { messages: UIMessage[]; sessionId?: string } =
      await req.json();
    
    // Parse URL for query params
    const { searchParams } = new URL(req.url);
    const urlSessionId = searchParams.get("sessionId");

    const sessionId = bodySessionId || req.headers.get("x-chat-session-id") || urlSessionId || undefined;

    // 1. Authenticate the user
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Check if user can send (free messages/tokens/balance)
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return new Response(
        JSON.stringify({ error: "User not found." }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const user = userDoc.data() as Omit<User, "id">;

    if (user.role !== "ADMIN") {
      const hasFreeMessages = (user.freeMessagesRemaining ?? 0) > 0;
      const hasFreeTokens = (user.freeTextTokens ?? 0) > 0;
      const hasWelcomeTokens = (user.welcomeTextTokens ?? 0) > 0;
      const hasPaidBalance = (user.balance ?? 0) > 0.01;

      if (!(hasFreeMessages && (hasFreeTokens || hasWelcomeTokens)) && !hasPaidBalance) {
        return new Response(
          JSON.stringify({
            error: "Insufficient funds or free tokens. Please add funds to continue.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // 3. Stream the AI response
    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: BASE_SYSTEM_INSTRUCTION,
      messages: await convertToModelMessages(messages),
      temperature: 0.2,
      onFinish: async ({ text, usage }) => {
        // 4. Record usage after completion
        const totalTokens = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);

        if (totalTokens > 0 && user.role !== "ADMIN") {
          try {
            await db.runTransaction(async (transaction) => {
              const userRef = db.collection("users").doc(userId);
              const freshUserDoc = await transaction.get(userRef);
              const freshUser = freshUserDoc.data() as Omit<User, "id">;

              let remaining = totalTokens;
              let totalCost = 0;
              let source: "free" | "welcome" | "paid" = "free";

              let newWelcomeTokens = freshUser.welcomeTextTokens || 0;
              let newFreeTokens = freshUser.freeTextTokens || 0;
              let newBalance = freshUser.balance || 0;
              let newFreeMessages = freshUser.freeMessagesRemaining ?? 0;

              // Deduct from Welcome → Free → Paid
              if (newWelcomeTokens > 0 && remaining > 0) {
                const d = Math.min(newWelcomeTokens, remaining);
                newWelcomeTokens -= d;
                remaining -= d;
                source = "welcome";
              }

              if (newFreeTokens > 0 && remaining > 0) {
                const d = Math.min(newFreeTokens, remaining);
                newFreeTokens -= d;
                remaining -= d;
                source = "free";
              }

              if (remaining > 0) {
                totalCost = remaining * PRICE_PER_TOKEN;
                newBalance -= totalCost;
                source = "paid";
              }

              // Decrement free messages for this exchange
              if (newFreeMessages > 0 && totalCost === 0) {
                newFreeMessages -= 1;
              }

              newBalance = Math.max(0, newBalance);

              transaction.update(userRef, {
                welcomeTextTokens: newWelcomeTokens,
                freeTextTokens: newFreeTokens,
                freeMessagesRemaining: newFreeMessages,
                balance: newBalance,
                totalSpent: (freshUser.totalSpent || 0) + totalCost,
              });

              // Record usage
              const usageRef = db.collection("usage").doc();
              transaction.set(usageRef, {
                userId,
                type: "TEXT_RESPONSE",
                tokens: totalTokens,
                cost: totalCost,
                source,
                sessionId: sessionId || "",
                createdAt: new Date().toISOString(),
              });
            });
          } catch (err) {
            console.error("Error recording usage in onFinish:", err);
          }
        }

        // 5. Save assistant message to chat session
        if (sessionId && text) {
          try {
            const msgRef = db
              .collection("chatSessions")
              .doc(sessionId)
              .collection("messages")
              .doc();

            await msgRef.set({
              sessionId,
              role: "assistant",
              text,
              createdAt: new Date().toISOString(),
              tokenCount: usage?.outputTokens ?? 0,
            });

            const { FieldValue } = await import("firebase-admin/firestore");
            await db.collection("chatSessions").doc(sessionId).update({
              updatedAt: new Date().toISOString(),
              messageCount: FieldValue.increment(1),
            });
          } catch (err) {
            console.error("Error saving assistant message:", err);
          }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error in /api/chat:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred during chat generation." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
