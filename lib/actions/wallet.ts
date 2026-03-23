"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";

export async function processDeposit(
  userId: string,
  amount: number,
  method: string,
  details: string
) {
  try {
    const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
    const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();

    const transaction = {
      id: transactionRef.id,
      userId,
      type: "DEPOSIT",
      description: `Funds Deposit via ${method}`,
      amount: amount,
      date: new Date().toISOString(),
      details: details,
    };

    // We use a batch to ensure both updates happen atomically
    const batch = db.batch();
    
    batch.update(userRef, {
      balance: FieldValue.increment(amount),
    });
    
    batch.set(transactionRef, transaction);
    
    await batch.commit();

    // Fetch the latest balance
    const userDoc = await userRef.get();
    const newBalance = userDoc.data()?.balance || 0;

    return {
      success: true,
      message: "Deposit successful",
      transaction,
      newBalance
    };
  } catch (error) {
    console.error("Error processing deposit:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to process deposit",
    };
  }
}

export async function getUserTransactions(userId: string) {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("userId", "==", userId)
      .orderBy("date", "desc")
      .limit(50)
      .get();

    const transactions = snapshot.docs.map((doc) => doc.data());

    return {
      success: true,
      transactions,
    };
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return {
      success: false,
      transactions: [],
    };
  }
}
