"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { generateTxRef } from "@/utils";
import { createNotification } from "./notifications";

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
      reference: generateTxRef(),
      status: "pending",
    };

    // We use a batch to ensure both updates happen atomically
    const batch = db.batch();

    batch.update(userRef, {
      balance: FieldValue.increment(amount),
    });

    batch.set(transactionRef, transaction);

    await batch.commit();

    // Create a notification for the deposit
    await createNotification(userId, {
      title: "Deposit Successful",
      message: `Your deposit of UGX ${amount.toLocaleString()} was successful.`,
      type: "SUCCESS",
      url: "/dashboard/user/billing",
    });

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
  duration: string = "all",
) {
  try {
    let query = db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("userId", "==", userId);

    if (type !== "ALL") {
      query = query.where("type", "==", type);
    }

    // Filter by duration
    if (duration !== "all") {
      const start = new Date();

      switch (duration) {
        case "today":
          start.setHours(0, 0, 0, 0);
          break;
        case "yesterday":
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          const end = new Date();
          end.setDate(end.getDate() - 1);
          end.setHours(23, 59, 59, 999);
          query = query.where("date", "<=", end.toISOString());
          break;
        case "last_week":
          start.setDate(start.getDate() - 7);
          start.setHours(0, 0, 0, 0);
          break;
        case "month":
          start.setMonth(start.getMonth() - 1);
          start.setHours(0, 0, 0, 0);
          break;
      }

      query = query.where("date", ">=", start.toISOString());
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
