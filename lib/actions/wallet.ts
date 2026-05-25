"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { generateTxRef } from "@/utils";
import { createNotification } from "./notifications";
import { stripe } from "@/lib/stripe";
import { sendTransactionReceiptEmail } from "@/lib/actions/email";

export async function processDeposit(
  userId: string,
  amount: number,
  method: TransactionMethod,
  details: string,
) {
  try {
    const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
    const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();

    const transaction: FirestoreWrite<Omit<Transaction, "id">, "createdAt"> = {
      userId,
      type: "DEPOSIT",
      description: `Funds Deposit via ${method}`,
      amount: amount * 100,
      createdAt: FieldValue.serverTimestamp(),
      details: details,
      reference: generateTxRef(),
      status: "pending",
      method
    };

    // We use a batch to ensure both updates happen atomically
    const batch = db.batch();

    batch.update(userRef, {
      balance: FieldValue.increment(amount * 100),
    });

    batch.set(transactionRef, transaction);

    await batch.commit();

    // Create a notification for the deposit
    await createNotification(userId, {
      title: "Deposit Successful",
      message: `Your deposit of $${amount.toLocaleString()} was successful.`,
      type: "SUCCESS",
      url: "/dashboard/billing",
    });

    // Fetch the latest balance
    const userDoc = await userRef.get();
    const newBalance = (userDoc.data()?.balance as number) || 0;
    revalidatePath("/dashboard/billing");
    return {
      success: true,
      message: "Deposit successful",
      transaction: {
        ...transaction,
        id: transactionRef.id,
        createdAt: new Date().toISOString(),
      },
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
          query = query.where("createdAt", "<=", Timestamp.fromDate(end));
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

      query = query.where("createdAt", ">=", Timestamp.fromDate(start));
    }

    // Get total count for pagination metadata
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    const snapshot = await query
      .orderBy("createdAt", "desc")
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const transactions = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data().createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
    })) as Transaction[];

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

export async function initiateStripePayment(userId: string, amountInDollars: number) {
  try {
    const reference = generateTxRef();
    const amountInCents = Math.round(amountInDollars * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      metadata: {
        userId,
        reference,
      },
    });

    const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(paymentIntent.id);
    const transaction: FirestoreWrite<Omit<Transaction, "id">, "createdAt"> = {
      userId,
      type: "DEPOSIT",
      description: "Funds Deposit via Credit Card (Stripe)",
      amount: amountInCents,
      createdAt: FieldValue.serverTimestamp(),
      details: "Card Payment Initiated",
      reference,
      status: "pending",
      method: "STRIPE"
    };

    await transactionRef.set(transaction);

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      transactionId: transactionRef.id,
      reference: transaction.reference,
    };
  } catch (error) {
    console.error("Error initiating Stripe payment:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to initiate Card payment",
    };
  }
}

export async function initiateMobileMoneyPayment(
  userId: string,
  amountInDollars: number,
  phoneNumber: string,
  network: "MTN" | "AIRTEL",
) {
  try {
    const amountInCents = Math.round(amountInDollars * 100);
    const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();

    const transaction: FirestoreWrite<Omit<Transaction, "id">, "createdAt"> = {
      userId,
      type: "DEPOSIT",
      description: `Funds Deposit via Mobile Money (${network})`,
      amount: amountInCents,
      createdAt: FieldValue.serverTimestamp(),
      details: `Phone: ${phoneNumber}`,
      reference: generateTxRef(),
      method: network,
      status: "pending",
    };

    await transactionRef.set(transaction);

    // Simulate direct MTN / Airtel USSD push payment completion process
    // In a real setup, their gateway triggers a PIN prompt and alerts our webhook.
    // Here we wait 4 seconds (time for user PIN entry) and update the balance/transaction.
    setTimeout(async () => {
      try {
        const batch = db.batch();
        const tDocRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(transactionRef.id);
        const userRef = db.collection(COLLECTIONS.USERS).doc(userId);

        batch.update(tDocRef, {
          status: "completed",
        });

        batch.update(userRef, {
          balance: FieldValue.increment(amountInCents),
        });

        await batch.commit();

        // Fetch updated balance for email
        const updatedUserDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
        const newBalanceInCents = (updatedUserDoc.data()?.balance as number) ?? 0;

        // Send receipt email (non-blocking)
        await sendTransactionReceiptEmail({
          userId,
          amountInCents,
          paymentMethod: network === "MTN" ? "MTN Mobile Money" : "Airtel Money",
          reference: transaction.reference as string,
          newBalanceInCents,
          transactionId: transactionRef.id,
        });

        // Create a notification for successful deposit
        await createNotification(userId, {
          title: "Deposit Successful",
          message: `Your Mobile Money deposit of $${amountInDollars.toLocaleString()} was successful.`,
          type: "SUCCESS",
          url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/transactions/${transactionRef.id}`,
        });
      } catch (err) {
        console.error("Error in Mobile Money simulated completion:", err);
      }
    }, 4000);

    return {
      success: true,
      transactionId: transactionRef.id,
      message: "USSD PIN prompt sent. Please check your phone.",
      reference: transaction.reference,
    };
  } catch (error) {
    console.error("Error initiating Mobile Money payment:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to initiate Mobile Money payment",
    };
  }
}

export async function getTransactionStatus(transactionId: string) {
  try {
    const doc = await db.collection(COLLECTIONS.TRANSACTIONS).doc(transactionId).get();
    if (!doc.exists) {
      return { success: false, message: "Transaction not found" };
    }
    const data = doc.data();
    return {
      success: true,
      status: data?.status || "pending",
      transaction: {
        ...data,
        id: doc.id,
        createdAt: (data?.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      },
    };
  } catch (error) { 
    console.error("Error getting transaction status:", error);
    return { success: false, message: "Failed to fetch status" };
  }
}

export async function getTransactionStatusByReference(reference: string) {
  try {
    const snapshot = await db.collection(COLLECTIONS.TRANSACTIONS).where("reference", "==", reference).limit(1).get();
    if (snapshot.empty) {
      return { success: false, message: "Transaction not found by reference" };
    }
    const data = snapshot.docs[0].data()
    return {
      success: true,
      status: data.status,
      transaction: {
        ...data,
        id: snapshot.docs[0].id,
        createdAt: (data?.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Transaction,
    };
  } catch (error) { 
    console.error("Error getting transaction status:", error);
    return { success: false, message: "Failed to fetch transaction status" };
  }
}

export async function getTransactionByReference({ref}: {ref: string}) {
  try {
    const snapshot = await db.collection(COLLECTIONS.TRANSACTIONS).where("reference", "==", ref).limit(1).get();
    if (snapshot.empty) {
      return { success: false, message: "Transaction not found" };
    }
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      success: true,
      message: "Transaction found",
      transaction: {
        ...data,
        id: doc.id,
        createdAt: (data?.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      },
    };
  } catch (error) { 
    console.error("Error getting transaction by reference:", error);
    return { success: false, message: "Failed to fetch transaction by reference" };
  }
}

export async function getTransaction(transactionId: string) {
  try {
    const doc = await db.collection(COLLECTIONS.TRANSACTIONS).doc(transactionId).get();
    if (!doc.exists) {
      return { success: false, message: "Transaction not found" };
    }
    const data = doc.data();
    return {
      success: true,
      transaction: {
        ...data,
        id: doc.id,
        createdAt: (data?.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Transaction,
    };
  } catch (error) {
    console.error("Error getting transaction by ID:", error);
    return { success: false, message: "Failed to fetch transaction details" };
  }
}

