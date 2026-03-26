// Helper for deterministic date formatting (YYYY-MM-DD) to prevent locale-based hydration errors
export const formatDate = (date: Date) => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

export const voices: VoicePasona[] = [
  {
    id: "Blake",
    name: "Blake",
    gender: "Male",
    desc: "Professional & Authoritative",
  },
  {
    id: "Luna",
    name: "Luna",
    gender: "Female",
    desc: "Calm & Relaxing",
  },
  { id: "Mark", name: "Mark", gender: "Male", desc: "Energetic & Expressive" },
  {
    id: "Wendy",
    name: "Wendy",
    gender: "Female",
    desc: "Warm & Friendly",
  },
  { id: "Theodore", name: "Theodore", gender: "Male", desc: "Strong & Direct" },
];

export const generateMockCards = (): PaymentMethod[] => [
  {
    id: "c1",
    type: "visa",
    last4: "4242",
    expiry: "12/25",
    isDefault: true,
    holderName: "John Doe",
  },
  {
    id: "c2",
    type: "mobile_money",
    last4: "077****89",
    isDefault: false,
    holderName: "John Doe",
  },
];

export const complaints: Complaint[] = [
  {
    id: "cmp_mock1",
    userId: "user_mock_01", // Some other user
    userName: "Sarah Jenk",
    email: "sarah.j@example.com",
    subject: "Voice session disconnected but charged",
    description:
      "I was on a call for 2 minutes but it dropped. I was charged for 10 minutes.",
    category: "OVERCHARGE",
    priority: "HIGH",
    status: "OPEN",
    createdAt: "2023-12-30T10:00:00.000Z",
    updatedAt: "2023-12-30T10:00:00.000Z",
  },
  {
    id: "cmp_mock2",
    userId: "user_mock_02",
    userName: "David K",
    email: "david.k@example.com",
    subject: "Request for refund on Deposit",
    description:
      "Accidentally deposited twice. Please refund transaction TX-9988.",
    category: "REFUND",
    priority: "MEDIUM",
    status: "RESOLVED",
    resolutionNote: "Refund processed to original payment method.",
    createdAt: "2023-12-25T14:30:00.000Z",
    updatedAt: "2023-12-31T09:15:00.000Z",
  },
];
