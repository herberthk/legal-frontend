import crypto from "crypto";

export const generateOTP = async (length = 6): Promise<string> =>
  Math.floor(Math.random() * 10 ** length)
    .toString()
    .padStart(length, "0");

export const hashOTP = async (otp: string): Promise<string> =>
  crypto.createHash("sha256").update(otp).digest("hex");

export const verifyOTP = async (
  inputOTP: string,
  storedHashedOTP: string,
): Promise<boolean> => {
  const hashedInput = crypto
    .createHash("sha256")
    .update(inputOTP)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hashedInput),
    Buffer.from(storedHashedOTP),
  );
};

export const isOTPExpired = async (expiresAt: Date): Promise<boolean> =>
  new Date() > expiresAt;

export const generateToken = async (length = 64): Promise<string> =>
  crypto.randomBytes(length).toString("hex");

export const hashOTPWithSalt = async (
  otp: string,
  salt: string,
): Promise<string> =>
  crypto.createHmac("sha256", salt).update(otp).digest("hex");

export const verifyOTPWithSalt = async (
  inputOTP: string,
  storedHashedOTP: string,
  salt: string,
): Promise<boolean> => {
  const hashedInput = crypto
    .createHmac("sha256", salt)
    .update(inputOTP)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hashedInput),
    Buffer.from(storedHashedOTP),
  );
};

//generate random transaction reference of 8 characters alphanumeric it should be prefixed with TX_
export const generateTransactionReference = (length = 8) =>
  crypto.randomBytes(length).toString("hex").toUpperCase();
