"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { revalidatePath } from "next/cache";

/**
 * Creates a new support ticket in Firestore.
 */
export const createSupportTicket = async (data: Omit<Complaint, "id" | "createdAt" | "updatedAt" | "status">) => {
  try {
    const ticketRef = db.collection(COLLECTIONS.SUPPORT_TICKETS).doc();
    const now = new Date().toISOString();
    
    const newTicket = {
      ...data,
      id: ticketRef.id,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    };

    await ticketRef.set(newTicket);
    revalidatePath("/dashboard/user/help");
    return { success: true, ticketId: ticketRef.id };
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return { success: false, error: "Failed to create ticket" };
  }
};

/**
 * Fetches all support tickets for a specific user.
 */
export const getUserSupportTickets = async (userId: string): Promise<Complaint[]> => {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.SUPPORT_TICKETS)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Complaint[];
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    return [];
  }
};

/**
 * Fetches help articles (FAQs) from Firestore.
 */
export const getHelpArticles = async (category?: string): Promise<HelpArticle[]> => {
  try {
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.HELP_ARTICLES);
    
    if (category) {
      query = query.where("category", "==", category);
    }

    const snapshot = await query.orderBy("order", "asc").get();
    
    // If no articles exist, return some default ones (we can seed the DB later)
    if (snapshot.empty) {
      return [
        {
          id: "default-1",
          title: "How do I add funds?",
          category: "Billing",
          content: "You can add funds via Mobile Money or Credit Card in the Billing dashboard.",
          order: 1,
          createdAt: new Date().toISOString()
        },
        {
           id: "default-2",
           title: "Is my data secure?",
           category: "Privacy",
           content: "All chat sessions are encrypted and stored securely in our private cloud.",
           order: 2,
           createdAt: new Date().toISOString()
        }
      ];
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HelpArticle[];
  } catch (error) {
    console.error("Error fetching help articles:", error);
    return [];
  }
};
