"use server";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { db } from "@/firebase/admin";
import { generateOTP, hashOTP, verifyOTP } from "@/utils/helpers";
import { OTPEmail } from "@/components/global";
import { TransactionReceiptEmail } from "@/components/emails/TransactionReceiptEmail";
import { COLLECTIONS } from "@/constants";
import { Timestamp } from "firebase-admin/firestore";
import { formatUSD, formatUgx } from "@/utils";

const SMTP_HOST = process.env.SMTP_HOST!;
const SMTP_PORT = process.env.SMTP_PORT!;
const SMTP_USER = process.env.SMTP_USER!;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD!;
const transporter = nodemailer.createTransport({
  // @ts-ignore
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: true,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

type Props = {
  id: number | string;
  email: string;
  name: string;
  type?: "verify" | "reset";
};

export const sendOtp = async ({ id, email, name, type = "verify" }: Props) => {
  const otp = await generateOTP();
  const otpHash = await hashOTP(otp);
  // 15 minutes expiry
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000));
  try {
    const otpData: Otp = {
      email,
      otpHash,
      expiresAt,
      attempts: 0,
    };
    await db.collection(COLLECTIONS.OTP).doc(id.toString()).set(otpData);
    // Render React component to HTML
    const emailHtml = await render(
      OTPEmail({ otp, userName: name, expiryMinutes: 15, type }),
    );
    const mailOptions = {
      from: '"Legal Adviser" <info@netbritz.com>',
      to: email,
      subject: "Legal Adviser",
      html: emailHtml,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.accepted);
    return true;
  } catch (error) {
    console.log("error", error);
    return false;
  }
};

export const verifyOtp = async (email: string, otpInput: string) => {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.OTP)
      .where("email", "==", email)
      .get();

    if (snapshot.empty) {
      return {
        success: false,
        message: "No OTP request found. Please request a new code.",
      };
    }

    const docSnap = snapshot.docs[0];
    const docRef = docSnap.ref;

    const data = docSnap.data() as Otp & { verified?: boolean };

    if (data.attempts >= 3) {
      await docRef.delete();
      return {
        success: false,
        message: "Too many failed attempts. Please request a new code.",
      };
    }

    const expiresAt = data.expiresAt.toDate();

    if (expiresAt < new Date()) {
      await docRef.delete();
      return {
        success: false,
        message: "OTP has expired. Please request a new code.",
      };
    }

    const isMatch = await verifyOTP(otpInput, data.otpHash);

    if (!isMatch) {
      await docRef.update({ attempts: data.attempts + 1 });
      return { success: false, message: "Invalid verification code." };
    }

    await docRef.update({ verified: true });
    return { success: true, message: "OTP verified successfully." };
  } catch (error) {
    console.error("verifyOtp error", error);
    return {
      success: false,
      message: "An unexpected error occurred while verifying the code.",
    };
  }
};

// ── Transaction Receipt Email ────────────────────────────────────────────────

export interface SendReceiptParams {
  userId: string;
  amountInCents: number;       // e.g. 2000 = $20.00
  paymentMethod: string;       // e.g. "MTN Mobile Money" | "Airtel Money" | "Stripe Card"
  reference: string;
  receiptUrl?: string;         // Stripe receipt URL — only for card payments
  newBalanceInCents: number;
}

export const sendTransactionReceiptEmail = async ({
  userId,
  amountInCents,
  paymentMethod,
  reference,
  receiptUrl,
  newBalanceInCents,
}: SendReceiptParams): Promise<void> => {
  try {
    // Fetch user details from Firestore
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
    if (!userDoc.exists) {
      console.error(`sendTransactionReceiptEmail: user ${userId} not found`);
      return;
    }
    const userData = userDoc.data() as { name: string; email: string };

    const amountDollars = amountInCents / 100;
    const newBalanceDollars = newBalanceInCents / 100;

    const date = new Date().toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Africa/Nairobi",
    });

    const emailHtml = await render(
      TransactionReceiptEmail({
        userName: userData.name,
        userEmail: userData.email,
        amountUSD: formatUSD(amountDollars),
        amountUGX: formatUgx(amountDollars),
        paymentMethod,
        reference,
        date,
        newBalanceUSD: formatUSD(newBalanceDollars),
        receiptUrl,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://legaladviser.app"}/dashboard/user/billing`,
      })
    );

    await transporter.sendMail({
      from: '"Legal Adviser" <info@netbritz.com>',
      to: userData.email,
      subject: `Deposit Confirmed — ${formatUSD(amountDollars)} credited to your wallet`,
      html: emailHtml,
    });

    console.log(`Receipt email sent to ${userData.email} for ref ${reference}`);
  } catch (error) {
    // Non-fatal — log but do not throw so payment flow is not disrupted
    console.error("sendTransactionReceiptEmail error:", error);
  }
};
