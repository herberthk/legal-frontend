import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";
import { createNotification } from "@/lib/actions/notifications";
import { stripe } from "@/lib/stripe";
import { sendTransactionReceiptEmail } from "@/lib/actions/email";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get("stripe-signature");

    if (!sig) {
      console.log('Missing stripe-signature header', sig);
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    // console.log(`Received Stripe webhook event: ${event}`);

    if (event.type === "charge.succeeded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
      
      const userId = charge.metadata?.userId as string;
      const reference = charge.metadata?.reference as string;
      const amountInCents = charge.amount;
      const receiptUrl = charge.receipt_url;

      if (!userId || !reference || !paymentIntentId) {
        console.error("Missing userId, reference, or paymentIntentId in charge webhook");
        return NextResponse.json({ received: true });
      }

      console.log('Receipt_url:', receiptUrl);
      const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(paymentIntentId);
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);

      // Perform transaction atomically in a Firestore transaction and compute new balance directly
      const newBalanceInCents = await db.runTransaction(async (dbTransaction) => {
        const txDoc = await dbTransaction.get(transactionRef);
        const userDoc = await dbTransaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        const previousBalance = (userDoc.data()?.balance as number) ?? 0;
        const targetBalance = previousBalance + amountInCents;

        if (txDoc.exists) {
          const currentStatus = txDoc.data()?.status;
          if (currentStatus === "completed") {
            // Already processed
            console.log(`Stripe payment transaction ${paymentIntentId} already marked completed.`);
            return targetBalance;
          }

          // If pending, mark as completed and credit user balance
          dbTransaction.update(transactionRef, {
            status: "completed",
            details: "Stripe Card Payment Succeeded",
          });
        } else {
          // If transaction didn't exist in Firestore yet (race condition), create it completed
          const transaction: FirestoreWrite<Omit<Transaction, "id">, "createdAt"> = {
            userId,
            type: "DEPOSIT",
            description: "Funds Deposit via Credit Card (Stripe)",
            amount: amountInCents,
            createdAt: FieldValue.serverTimestamp(),
            details: "Stripe Card Payment Succeeded",
            reference,
            status: "completed",
            method: "STRIPE"
          };
          dbTransaction.set(transactionRef, transaction);
        }

        dbTransaction.update(userRef, {
          balance: FieldValue.increment(amountInCents),
        });

        return targetBalance;
      });

      console.log(`Successfully processed completed payment intent: ${paymentIntentId}`);

      // Perform post-processing notification and email tasks concurrently to maximize performance
      try {
        await Promise.all([
          createNotification(userId, {
            title: "Deposit Successful",
            message: `Your Stripe Card deposit of $${(amountInCents / 100).toFixed(2)} was successful.`,
            type: "SUCCESS",
            url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/user/transactions/${paymentIntentId}`,
          }).catch(err => console.error("Error creating successful deposit notification:", err)),
          sendTransactionReceiptEmail({
            userId,
            amountInCents,
            paymentMethod: "Stripe Credit/Debit Card",
            reference,
            receiptUrl: receiptUrl ?? undefined,
            newBalanceInCents,
            transactionId: paymentIntentId,
          }).catch(err => console.error("Error sending transaction receipt email:", err))
        ]);
      } catch (postProcessErr) {
        console.error("Error in webhook post-processing tasks:", postProcessErr);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata?.userId;

      if (userId) {
        const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(paymentIntent.id);
        const txDoc = await transactionRef.get();

        if (txDoc.exists && txDoc.data()?.status === "pending") {
          await Promise.all([
            transactionRef.update({
              status: "failed",
              details: paymentIntent.last_payment_error?.message || "Stripe Payment Failed",
            }),
            createNotification(userId, {
              title: "Deposit Failed",
              message: `Your credit card deposit of $${(paymentIntent.amount / 100).toFixed(2)} failed.`,
              type: "ERROR",
              url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/user/transactions/${paymentIntent.id}`,
            })
          ]).catch(err => console.error("Error updating failed payment state in Firestore:", err));
        }
      }
    }

    return NextResponse.json({ received: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error handling Stripe webhook:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
