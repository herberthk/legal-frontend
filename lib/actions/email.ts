"use server";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { db } from "@/firebase/admin";
import { generateOTP, hashOTP, verifyOTP } from "@/utils/helpers";
import { OTPEmail } from "@/components/global";
import { COLLECTIONS } from "@/constants";

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
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
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

    const expiresAt =
      data.expiresAt instanceof Date
        ? data.expiresAt
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.expiresAt as any).toDate
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (data.expiresAt as any).toDate()
          : new Date(data.expiresAt);

    if (new Date() > expiresAt) {
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
