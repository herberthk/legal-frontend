// tests/phone.test.ts
import { describe, it, expect } from "vitest";
import {
  normalizeUgandaPhone,
  detectUgandaNetwork,
  validateUgandaPhone,
} from "../";

// ─────────────────────────────────────────────────────────────────────────────
// normalizeUgandaPhone
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeUgandaPhone", () => {
  describe("valid formats → 9-digit local form", () => {
    it("strips leading 0 from 10-digit local number", () => {
      expect(normalizeUgandaPhone("0772123456")).toBe("772123456");
    });

    it("strips +256 country code", () => {
      expect(normalizeUgandaPhone("+256772123456")).toBe("772123456");
    });

    it("strips 256 country code (no +)", () => {
      expect(normalizeUgandaPhone("256772123456")).toBe("772123456");
    });

    it("returns 9-digit input unchanged", () => {
      expect(normalizeUgandaPhone("772123456")).toBe("772123456");
    });

    it("strips spaces and dashes", () => {
      expect(normalizeUgandaPhone("+256 772 123 456")).toBe("772123456");
      expect(normalizeUgandaPhone("0772-123-456")).toBe("772123456");
    });

    it("strips parentheses", () => {
      expect(normalizeUgandaPhone("(0772) 123456")).toBe("772123456");
    });
  });

  describe("invalid formats → null", () => {
    it("returns null for too-short number", () => {
      expect(normalizeUgandaPhone("07721234")).toBeNull();
    });

    it("returns null for too-long number", () => {
      expect(normalizeUgandaPhone("077212345678")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(normalizeUgandaPhone("")).toBeNull();
    });

    it("returns null for letters only", () => {
      expect(normalizeUgandaPhone("abcdefghi")).toBeNull();
    });

    it("returns null for ambiguous 11-digit starting with 256", () => {
      // 256 + 8 digits = 11, not 12 → invalid
      expect(normalizeUgandaPhone("25677212345")).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// detectUgandaNetwork
// ─────────────────────────────────────────────────────────────────────────────

describe("detectUgandaNetwork", () => {
  describe("MTN prefixes", () => {
    const mtnNumbers = [
      ["077x", "0772123456"],
      ["078x", "0782123456"],
      ["076x", "0762123456"],
      ["031x", "0312123456"],
      ["039x", "0392123456"],
    ];

    it.each(mtnNumbers)("detects MTN for %s prefix (%s)", (_, phone) => {
      expect(detectUgandaNetwork(phone)).toBe("MTN");
    });

    it("detects MTN from E.164 format", () => {
      expect(detectUgandaNetwork("+256772123456")).toBe("MTN");
    });

    it("detects MTN from country code without +", () => {
      expect(detectUgandaNetwork("256782000000")).toBe("MTN");
    });
  });

  describe("Airtel prefixes", () => {
    const airtelNumbers = [
      ["070x", "0702123456"],
      ["075x", "0752123456"],
      ["074x", "0742123456"],
      ["020x", "0202123456"],
    ];

    it.each(airtelNumbers)("detects Airtel for %s prefix (%s)", (_, phone) => {
      expect(detectUgandaNetwork(phone)).toBe("AIRTEL");
    });

    it("detects Airtel from E.164 format", () => {
      expect(detectUgandaNetwork("+256702000000")).toBe("AIRTEL");
    });
  });

  describe("unknown / invalid", () => {
    it("returns null for unknown prefix (e.g. 071x)", () => {
      expect(detectUgandaNetwork("0712000000")).toBeNull();
    });

    it("returns null for invalid phone", () => {
      expect(detectUgandaNetwork("123")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(detectUgandaNetwork("")).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateUgandaPhone
// ─────────────────────────────────────────────────────────────────────────────

describe("validateUgandaPhone", () => {
  describe("valid MTN numbers", () => {
    it("returns correct shape for local 077x format", () => {
      const result = validateUgandaPhone("0772123456");
      expect(result).toEqual({
        valid: true,
        normalized: "772123456",
        network: "MTN",
        e164: "+256772123456",
      });
    });

    it("returns correct shape for +256 E.164 format", () => {
      const result = validateUgandaPhone("+256782000000");
      expect(result).toMatchObject({
        valid: true,
        network: "MTN",
        e164: "+256782000000",
      });
    });

    it("returns correct shape for 9-digit local", () => {
      const result = validateUgandaPhone("772123456");
      expect(result).toMatchObject({ valid: true, network: "MTN" });
    });
  });

  describe("valid Airtel numbers", () => {
    it("returns correct shape for 075x", () => {
      const result = validateUgandaPhone("0752000000");
      expect(result).toEqual({
        valid: true,
        normalized: "752000000",
        network: "AIRTEL",
        e164: "+256752000000",
      });
    });
  });

  describe("invalid — format errors", () => {
    it("sets valid=false and includes error for too-short number", () => {
      const result = validateUgandaPhone("077212");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Invalid Uganda phone format/);
      expect(result.network).toBeUndefined();
    });

    it("sets valid=false for empty string", () => {
      const result = validateUgandaPhone("");
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("invalid — unknown prefix", () => {
    it("sets valid=false and includes prefix in error for known-length unknown-prefix", () => {
      const result = validateUgandaPhone("0712000000"); // 071x not registered
      expect(result.valid).toBe(false);
      expect(result.normalized).toBe("712000000");
      expect(result.error).toMatch(/Unrecognised Uganda prefix/);
      expect(result.error).toMatch(/071x/);
    });
  });

  describe("e164 format", () => {
    it("always prefixes +256 regardless of input format", () => {
      const fromLocal  = validateUgandaPhone("0772000000");
      const fromE164   = validateUgandaPhone("+256772000000");
      const from9digit = validateUgandaPhone("772000000");

      expect(fromLocal.e164).toBe("+256772000000");
      expect(fromE164.e164).toBe("+256772000000");
      expect(from9digit.e164).toBe("+256772000000");
    });
  });
});
