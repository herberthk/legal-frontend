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

    console.log(`Received Stripe webhook event: ${event}`);

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata?.userId;
      const amountInCents = paymentIntent.amount;

      if (!userId) {
        console.error("Missing userId in PaymentIntent metadata");
        return NextResponse.json({ received: true });
      }

      const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(paymentIntent.id);
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);

      // Perform transaction atomically in a Firestore transaction
      await db.runTransaction(async (dbTransaction) => {
        const txDoc = await dbTransaction.get(transactionRef);
        const userDoc = await dbTransaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        if (txDoc.exists) {
          const currentStatus = txDoc.data()?.status;
          if (currentStatus === "completed") {
            // Already processed
            console.log(`Stripe payment transaction ${paymentIntent.id} already marked completed.`);
            return;
          }

          // If pending, mark as completed and credit user balance
          dbTransaction.update(transactionRef, {
            status: "completed",
            details: "Stripe Card Payment Succeeded",
          });
        } else {
          // If transaction didn't exist in Firestore for some reason, create it completed
           const transaction: FirestoreWrite<Omit<Transaction, "id">, "createdAt"> = {
                userId,
            type: "DEPOSIT",
            description: "Funds Deposit via Card Payment (Stripe)",
            amount: amountInCents,
            createdAt: FieldValue.serverTimestamp(),
            details: "Stripe Card Payment Succeeded",
            reference: paymentIntent.id,
            status: "completed",method: "STRIPE"
              };
          dbTransaction.set(transactionRef, {
            ...transaction
          });
        }

        dbTransaction.update(userRef, {
          balance: FieldValue.increment(amountInCents),
        });
      });

      // Create a notification for successful deposit
      await createNotification(userId, {
        title: "Deposit Successful",
        message: `Your Stripe Card deposit of $${(amountInCents / 100).toFixed(2)} was successful.`,
        type: "SUCCESS",
        url: "/dashboard/user/billing",
      });

      console.log(`Successfully processed completed payment intent: ${paymentIntent.id}`);

      // Fetch updated user balance for the email
      const updatedUserDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
      const newBalanceInCents = (updatedUserDoc.data()?.balance as number) ?? 0;

      // Retrieve the charge to get the Stripe receipt URL
      let receiptUrl: string | undefined;
      try {
        if (paymentIntent.latest_charge) {
          const charge = await stripe.charges.retrieve(
            typeof paymentIntent.latest_charge === "string"
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge.id
          );
          receiptUrl = charge.receipt_url ?? undefined;
        }
      } catch (chargeErr) {
        console.error("Could not retrieve Stripe charge for receipt URL:", chargeErr);
      }

      // Send receipt email — non-blocking, errors are swallowed internally
      await sendTransactionReceiptEmail({
        userId,
        amountInCents,
        paymentMethod: "Stripe Credit/Debit Card",
        reference: paymentIntent.metadata?.reference ?? paymentIntent.id,
        receiptUrl,
        newBalanceInCents,
      });
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata?.userId;

      if (userId) {
        const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(paymentIntent.id);
        const txDoc = await transactionRef.get();

        if (txDoc.exists && txDoc.data()?.status === "pending") {
          await transactionRef.update({
            status: "failed",
            details: paymentIntent.last_payment_error?.message || "Stripe Payment Failed",
          });

          await createNotification(userId, {
            title: "Deposit Failed",
            message: `Your credit card deposit of $${(paymentIntent.amount / 100).toFixed(2)} failed.`,
            type: "ERROR",
            url: "/dashboard/user/billing",
          });
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
