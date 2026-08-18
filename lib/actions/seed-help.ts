import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Seeds initial help articles if the collection is empty.
 * This is a helper for local development/setup.
 */
export const seedHelpArticles = async () => {
  const articles = [
    {
      title: "Getting Started with Voice Consultation",
      category: "Technical",
      content:
        "To start a voice consultation, click on the 'Voice' menu item and ensure your microphone permissions are granted. We support both Native and AssemblyAI engines for maximum compatibility.",
      order: 1,
    },
    {
      title: "How to Request a Refund?",
      category: "Billing",
      content:
        "If you were double-charged or encountered a technical error during a session, you can request a refund by creating a support ticket and attaching the Transaction ID.",
      order: 2,
    },
    {
      title: "Daily Free Message Limits",
      category: "Usage",
      content:
        "Every user receives 1,000 free tokens daily. These reset every 24 hours at midnight. Once exhausted, you'll need to use your paid balance.",
      order: 3,
    },
    {
      title: "Model Capabilities (Gemini 2.5)",
      category: "General",
      content:
        "Our legal adviser uses Gemini 2.5 Flash for rapid, accurate responses. It excels at analyzing statutes, case law summaries, and drafting legal documents.",
      order: 4,
    },
  ];

  const colRef = db.collection(COLLECTIONS.HELP_ARTICLES);
  const snapshot = await colRef.limit(1).get();

  if (snapshot.empty) {
    console.log("Seeding help articles...");
    const batch = db.batch();
    articles.forEach((article) => {
      const docId = `help_seed_${article.order}`;
      const docRef = colRef.doc(docId);
      batch.set(
        docRef,
        {
          ...article,
          id: docId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
    console.log("Seeding complete.");
  }
};
