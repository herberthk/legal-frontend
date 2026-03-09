declare global {
  interface Otp {
    id?: string;
    email: string;
    otpHash: string;
    expiresAt: Date;
    attempts: number;
  }
}
export {};
