"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS, USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { sendTransactionReceiptEmail } from "./email";
import { createNotification } from "./notifications";

const MAX_ATTEMPTS = 5;

/**
 * Process a single outbox task by ID.
 * Implements optimistic locking / idempotency checks so tasks are never executed twice.
 */
export async function processOutboxTask(taskId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const taskRef = db.collection(COLLECTIONS.OUTBOX).doc(taskId);

    // Acquire the task and mark as PROCESSING atomically
    const taskToProcess = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(taskRef);
      if (!snap.exists) {
        return null;
      }
      const data = snap.data() as OutboxTask;

      // Already completed - idempotent early return
      if (data.status === "COMPLETED") {
        return { isDone: true, task: data };
      }

      // If currently processing and was updated less than 2 minutes ago, avoid duplicate run
      if (data.status === "PROCESSING" && data.updatedAt) {
        const lastUpdated =
          typeof data.updatedAt === "string"
            ? new Date(data.updatedAt).getTime()
            : (data.updatedAt as unknown as Timestamp)?.toMillis?.() ?? 0;
        if (Date.now() - lastUpdated < 2 * 60 * 1000) {
          return { isDone: true, task: data };
        }
      }

      transaction.update(taskRef, {
        status: "PROCESSING",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { isDone: false, task: data };
    });

    if (!taskToProcess) {
      return { success: false, message: `Outbox task ${taskId} not found` };
    }

    if (taskToProcess.isDone) {
      return { success: true, message: `Outbox task ${taskId} already completed or processing` };
    }

    const { task } = taskToProcess;
    const { type, payload } = task;

    try {
      if (type === "DEPOSIT_COMPLETED") {
        const rate = payload.exchangeRate || USD_TO_UGX_EXCHANGE_RATE;
        const amountUgxFormatted = Math.round((payload.amountInCents / 100) * rate).toLocaleString("en-UG");

        await Promise.all([
          sendTransactionReceiptEmail({
            userId: payload.userId,
            amountInCents: payload.amountInCents,
            paymentMethod: payload.paymentMethod,
            reference: payload.reference,
            receiptUrl: payload.receiptUrl,
            newBalanceInCents: payload.newBalanceInCents,
            transactionId: payload.transactionId,
          }),
          createNotification(payload.userId, {
            title: "Deposit Successful",
            message: `Your Mobile Money deposit of UGX ${amountUgxFormatted} was successful.`,
            type: "SUCCESS",
            url: "/dashboard/billing",
          }),
        ]);
      } else if (type === "DEPOSIT_FAILED") {
        await createNotification(payload.userId, {
          title: "Deposit Failed",
          message: "Your Mobile Money deposit could not be completed. Please try again.",
          type: "ERROR",
          url: "/dashboard/billing/checkout",
        });
      }

      // Mark task as COMPLETED
      await taskRef.update({
        status: "COMPLETED",
        processedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const nextAttempts = (task.attempts || 0) + 1;
      const isTerminal = nextAttempts >= (task.maxAttempts || MAX_ATTEMPTS);

      // Exponential backoff: 30s, 60s, 120s, 240s...
      const backoffSeconds = Math.min(30 * Math.pow(2, nextAttempts - 1), 3600);
      const nextRetryDate = new Date(Date.now() + backoffSeconds * 1000);

      await taskRef.update({
        status: isTerminal ? "FAILED" : "PENDING",
        attempts: nextAttempts,
        lastError: errorMessage,
        nextRetryAt: Timestamp.fromDate(nextRetryDate),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.error(`[Outbox] Task ${taskId} failed (attempt ${nextAttempts}):`, errorMessage);
      return { success: false, message: errorMessage };
    }
  } catch (outerErr: unknown) {
    console.error(`[Outbox] Critical error processing task ${taskId}:`, outerErr);
    return { success: false, message: outerErr instanceof Error ? outerErr.message : String(outerErr) };
  }
}

/**
 * Process all pending outbox tasks that are due for execution.
 * Can be invoked by a cron job, worker, or scheduler.
 */
export async function processPendingOutboxTasks(limitCount: number = 20): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  try {
    const now = Timestamp.now();
    const [retrySnapshot, initialPendingSnapshot] = await Promise.all([
      db
        .collection(COLLECTIONS.OUTBOX)
        .where("status", "==", "PENDING")
        .where("nextRetryAt", "<=", now)
        .limit(limitCount)
        .get(),
      db
        .collection(COLLECTIONS.OUTBOX)
        .where("status", "==", "PENDING")
        .where("attempts", "==", 0)
        .limit(limitCount)
        .get(),
    ]);

    const docIds = new Set<string>();
    retrySnapshot.docs.forEach((doc) => docIds.add(doc.id));
    initialPendingSnapshot.docs.forEach((doc) => docIds.add(doc.id));

    let succeeded = 0;
    let failed = 0;

    const promises = Array.from(docIds).map(async (id) => {
      const res = await processOutboxTask(id);
      if (res.success) {
        succeeded++;
      } else {
        failed++;
      }
    });

    await Promise.allSettled(promises);

    return {
      processed: docIds.size,
      succeeded,
      failed,
    };
  } catch (error) {
    console.error("[Outbox] processPendingOutboxTasks error:", error);
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
    };
  }
}
