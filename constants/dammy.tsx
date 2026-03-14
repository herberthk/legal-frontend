export const notifications = (): Notifications[] => {
  const baseNotifications: Notifications[] = [
    {
      id: 1,
      text: "System maintenance scheduled for midnight.",
      time: "1d ago",
      unread: false,
      type: "info",
    },
    {
      id: 2,
      text: "Your voice chat transcript is ready.",
      time: "1h ago",
      unread: true,
      type: "success",
    },
    {
      id: 3,
      text: "Low balance alert: $5.50 remaining.",
      time: "3h ago",
      unread: true,
      type: "alert",
    },
    {
      id: 4,
      text: "New user registration spike detected.",
      time: "30m ago",
      unread: true,
      type: "info",
    },
    {
      id: 5,
      text: "Revenue report for Oct available.",
      time: "2h ago",
      unread: true,
      type: "success",
    },
  ];
  // Add dummy notifications to fill pagination
  for (let i = 0; i < 15; i++) {
    baseNotifications.push({
      id: 100 + i,
      text: `System update patch #${202400 + i} applied successfully.`,
      time: `${i + 2}d ago`,
      unread: false,
      type: "info",
    });
  }
  return baseNotifications;
};

// Helper for deterministic date formatting (YYYY-MM-DD) to prevent locale-based hydration errors
const formatDate = (date: Date) => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

export const generateUserTransactions = (count = 15): Transaction[] => {
  const types: ("TEXT_CHAT" | "VOICE_SESSION" | "DEPOSIT")[] = [
    "TEXT_CHAT",
    "VOICE_SESSION",
    "DEPOSIT",
  ];
  // Use a fixed reference timestamp for deterministic dates during SSR
  const referenceTimestamp = new Date("2024-01-01T00:00:00Z").getTime();

  return Array.from({ length: count }).map((_, i) => ({
    id: `tx_${i}`,
    type: types[i % types.length],
    description: `Transaction #${i + 100}`,
    amount: (i % 2 === 0 ? 1 : -1) * (((i * 1.5) % 5) + 1),
    date: formatDate(new Date(referenceTimestamp - i * 86400000)),
    details: i % 2 === 0 ? "Success" : "Completed",
  }));
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

// Mock Data Generator for Voice Sessions
export const generateMockVoiceSessions = (count = 8): VoiceSession[] => {
  // Use a fixed reference timestamp for deterministic dates during SSR
  const referenceTimestamp = new Date("2024-01-01T00:00:00Z").getTime();

  return Array.from({ length: count }).map((_, i) => ({
    id: `vs_${i}`,
    userId: "user-01",
    date: new Date(
      referenceTimestamp - i * 1000 * 60 * 60 * 24 * 2,
    ).toISOString(), // Every 2 days
    duration: 60 + ((i * 50) % 400),
    audioUrl: undefined, // Mock entries won't play audio, but UI will render
    previewText: [
      "Inquiry regarding land title transfer procedures under the Registration of Titles Act.",
      "Question about VAT registration threshold for small businesses in Kampala.",
      "Clarification on employee termination notice periods according to the Employment Act.",
      "Dispute resolution mechanisms for commercial tenancy agreements.",
      "Inheritance rights and succession planning advice.",
      "Customary land ownership certificates and verification.",
      "URA tax clearance certificate requirements for government tenders.",
      "Intellectual property rights for software developers in Uganda.",
    ][i % 8],
  }));
};

// --- Mock Data Generators ---
export const generateMockTransactions = (count = 20): Transaction[] => {
  const descs = [
    "Funds Added (Visa ...4242)",
    "Legal Consultation: Land Title",
    "Doc Analysis: Employment Contract",
    "Quick Query: VAT Rates",
    "Funds Added (Mobile Money)",
    "Consultation: Family Law",
  ];
  // Use a fixed reference timestamp for deterministic dates during SSR
  const referenceTimestamp = new Date("2024-01-01T00:00:00Z").getTime();

  return Array.from({ length: count }).map((_, i) => ({
    id: `t${i}`,
    type: i % 5 === 0 ? "DEPOSIT" : i % 3 === 0 ? "VOICE_SESSION" : "TEXT_CHAT",
    description: descs[i % descs.length],
    amount:
      i % 5 === 0
        ? 50.0
        : -parseFloat(((i % 5) + 1 + (i % 3) * 0.5).toFixed(2)),
    date: formatDate(new Date(referenceTimestamp - i * 86400000)),
    details: i % 5 === 0 ? "Success" : i % 3 === 0 ? "12m 45s" : "1.2k tokens",
  }));
};

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

export const generateUsageData = () => [
  { name: "Mon", cost: 1.2 },
  { name: "Tue", cost: 3.5 },
  { name: "Wed", cost: 0.8 },
  { name: "Thu", cost: 2.1 },
  { name: "Fri", cost: 4.0 },
  { name: "Sat", cost: 0.5 },
  { name: "Sun", cost: 1.2 },
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
