const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CHARS_LEN = CHARS.length; // 62
const MAX_UNBIASED = 256 - (256 % CHARS_LEN); // 256 - (256 % 62) = 256 - 8 = 248

export const generateTxRef = (length = 14): string => {
  let result = "";

  while (result.length < length) {
    const bytes = globalThis.crypto.getRandomValues(
      new Uint8Array(length * 2)
    );
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      if (bytes[i] < MAX_UNBIASED) {
        result += CHARS[bytes[i] % CHARS_LEN];
      }
    }
  }

  return `TX_${result.toUpperCase()}`;
};