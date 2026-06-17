"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Creates a new support ticket in Firestore.
 */
export const createSupportTicket = async (
  data: Omit<Complaint, "id" | "createdAt" | "updatedAt" | "status">,
) => {
  try {
    const ticketRef = db.collection(COLLECTIONS.SUPPORT_TICKETS).doc();
    const newTicket = {
      ...data,
      id: ticketRef.id,
      status: "OPEN",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await ticketRef.set(newTicket);
    revalidatePath("/dashboard/help");
    return { success: true, ticketId: ticketRef.id };
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return { success: false, error: "Failed to create ticket" };
  }
};

/**
 * Fetches all support tickets for a specific user.
 */
export const getUserSupportTickets = async (
  userId: string,
): Promise<Complaint[]> => {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.SUPPORT_TICKETS)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data().createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
      updatedAt:
        doc.data().updatedAt?.toDate().toISOString() ||
        new Date().toISOString(),
    })) as Complaint[];
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    return [];
  }
};

/**
 * Fetches help articles (FAQs) from Firestore.
 */
export const getHelpArticles = async (
  category?: string,
): Promise<HelpArticle[]> => {
  try {
    let query: FirebaseFirestore.Query = db.collection(
      COLLECTIONS.HELP_ARTICLES,
    );

    if (category) {
      query = query.where("category", "==", category);
    }

    const snapshot = await query.orderBy("order", "asc").get();
    console.log("snapshot.docs.length", snapshot.docs.length);
    // If no articles exist, return some default ones (we can seed the DB later)
    if (snapshot.empty) {
      return [
        {
          id: "default-1",
          title: "How do I add funds?",
          category: "Billing",
          content:
            "You can add funds via Mobile Money or Credit Card in the Billing dashboard.",
          order: 1,
          createdAt: new Date().toISOString(),
        },
        {
          id: "default-2",
          title: "Is my data secure?",
          category: "Privacy",
          content:
            "All chat sessions are encrypted and stored securely in our private cloud.",
          order: 2,
          createdAt: new Date().toISOString(),
        },
      ] as HelpArticle[];
    }

    return snapshot.docs?.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data().createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
    })) as HelpArticle[];
  } catch (error) {
    console.error("Error fetching help articles:", error);
    return [];
  }
};

/**
 * Adds a new message to a support ticket thread.
 */
export const addTicketMessage = async (
  ticketId: string,
  senderId: string,
  senderRole: Role,
  text: string,
  attachments: string[] = []
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const messageRef = db.collection(COLLECTIONS.SUPPORT_MESSAGES).doc();
    const newMessage = {
      id: messageRef.id,
      ticketId,
      senderId,
      senderRole,
      text,
      attachments,
      createdAt: FieldValue.serverTimestamp(),
    };

    await messageRef.set(newMessage);

    // Update the ticket's updatedAt timestamp
    await db.collection(COLLECTIONS.SUPPORT_TICKETS).doc(ticketId).update({
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/dashboard/help");
    revalidatePath("/admin/complaints");

    // Trigger email notification if ADMIN replies
    if (senderRole === "ADMIN" || senderRole === "SUPER_ADMIN") {
      const ticketDoc = await db.collection(COLLECTIONS.SUPPORT_TICKETS).doc(ticketId).get();
      if (ticketDoc.exists) {
        const ticketData = ticketDoc.data() as Complaint;
        // Import inline to avoid circular dependencies if any
        const { sendTicketNotificationEmail } = await import("@/lib/actions/email");
        await sendTicketNotificationEmail({
          userId: ticketData.userId,
          ticketId: ticketId,
          ticketSubject: ticketData.subject,
          messageSnippet: text.length > 100 ? text.substring(0, 100) + "..." : text,
        });
      }
    }

    return { success: true, messageId: messageRef.id };
  } catch (error) {
    console.error("Error adding ticket message:", error);
    return { success: false, error: "Failed to add message" };
  }
};

/**
 * Fetches the message thread for a specific ticket.
 */
export const getTicketMessages = async (
  ticketId: string
): Promise<TicketMessage[]> => {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.SUPPORT_MESSAGES)
      .where("ticketId", "==", ticketId)
      .orderBy("createdAt", "asc")
      .get();

    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data().createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
    })) as TicketMessage[];
  } catch (error) {
    console.error("Error fetching ticket messages:", error);
    return [];
  }
};

/**
 * Fetches all support tickets for admin view.
 */
export const getAllSupportTickets = async (
  status?: string
): Promise<Complaint[]> => {
  try {
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.SUPPORT_TICKETS);
    
    if (status) {
      query = query.where("status", "==", status);
    }
    
    const snapshot = await query.orderBy("createdAt", "desc").get();

    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data().createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
      updatedAt:
        doc.data().updatedAt?.toDate().toISOString() ||
        new Date().toISOString(),
    })) as Complaint[];
  } catch (error) {
    console.error("Error fetching all tickets:", error);
    return [];
  }
};

/**
 * Updates the status of a support ticket.
 */
export const updateTicketStatus = async (
  ticketId: string,
  status: ComplaintStatus,
  resolutionNote?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData:any = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (resolutionNote !== undefined) {
      updateData.resolutionNote = resolutionNote;
    }

    await db.collection(COLLECTIONS.SUPPORT_TICKETS).doc(ticketId).update(updateData);

    revalidatePath("/dashboard/help");
    revalidatePath("/admin/complaints");

    return { success: true };
  } catch (error) {
    console.error("Error updating ticket status:", error);
    return { success: false, error: "Failed to update status" };
  }
};

