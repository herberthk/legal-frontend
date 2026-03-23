"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

export async function processDeposit(
  userId: string,
  amount: number,
  method: string,
  details: string,
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
    revalidatePath("/dashboard/user/billing");
    return {
      success: true,
      message: "Deposit successful",
      transaction,
      newBalance,
    };
  } catch (error) {
    console.error("Error processing deposit:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to process deposit",
    };
  }
}

export async function getUserTransactions(
  userId: string,
  page: number = 1,
  pageSize: number = 10,
  type: string = "ALL",
) {
  try {
    let query = db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("userId", "==", userId);

    if (type !== "ALL") {
      query = query.where("type", "==", type);
    }

    // Get total count for pagination metadata
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    const snapshot = await query
      .orderBy("date", "desc")
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const transactions = snapshot.docs.map((doc) => doc.data());

    return {
      success: true,
      transactions,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return {
      success: false,
      transactions: [],
      totalCount: 0,
      totalPages: 0,
    };
  }
}
