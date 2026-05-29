const MTN_PREFIXES = ["77", "78", "76", "39", "31"];
const AIRTEL_PREFIXES = ["70", "75", "74", "20"];
const ALL_PREFIXES = [...MTN_PREFIXES, ...AIRTEL_PREFIXES];

// Builds: ^256(77|78|76|39|31|70|75|74|20)[0-9]{7}$
const VALID_MSISDN_REGEX = new RegExp(
  `^256(${ALL_PREFIXES.join("|")})[0-9]{7}$`
);

type NetworkProvider = "MTN" | "Airtel";

interface MSISDNResult {
  isValid: boolean;
  formattedNumber: string | null;
  provider: NetworkProvider | null;
  error?: string;
}

const invalid = (error: string): MSISDNResult => ({
  isValid: false,
  formattedNumber: null,
  provider: null,
  error,
});

const detectProvider = (formattedNumber: string): NetworkProvider | null => {
  const prefix = formattedNumber.slice(3, 5); // digits after "256"
  if (MTN_PREFIXES.includes(prefix)) return "MTN";
  if (AIRTEL_PREFIXES.includes(prefix)) return "Airtel";
  return null;
};

export const parseUgandanNumber = (msisdn: string): MSISDNResult => {
  if (!msisdn || typeof msisdn !== "string") {
    return invalid("Phone number is required.");
  }

  const digitsOnly = msisdn.trim().replace(/^\+/, "").replace(/\D/g, "");

  let formattedNumber: string;

  if (digitsOnly.startsWith("256")) {
    formattedNumber = digitsOnly;
  } else if (digitsOnly.startsWith("0")) {
    formattedNumber = "256" + digitsOnly.slice(1);
  } else if (digitsOnly.length === 9) {
    formattedNumber = "256" + digitsOnly;
  } else {
    return invalid("Unrecognised phone number format.");
  }

  if (!VALID_MSISDN_REGEX.test(formattedNumber)) {
    return invalid("Only MTN or Airtel Uganda numbers are accepted.");
  }

  return {
    isValid: true,
    formattedNumber,
    provider: detectProvider(formattedNumber),
  };
};

interface AmountResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate that amount is a number and greater than 1000 and should be numbers only also return message error
 */ 
export const isValidAmount = (amount: string): AmountResult => {
  if (!amount || typeof amount !== "string") {
    return { isValid: false, error: "Amount is required." };
  }

  // 1) check if it's made of digits only (and is not empty)
  if (!/^[0-9]+$/.test(amount)) {
    return { isValid: false, error: "Amount must contain only digits." };
  }

  // 2) convert and check the numeric value
  const num = Number(amount);
  if (isNaN(num) || num < 1000) {
    return {
      isValid: false,
      error: "Amount must be a number greater than or equal to 1000.",
    };
  }

  return { isValid: true };
};