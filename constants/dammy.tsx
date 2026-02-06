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
    date: new Date(referenceTimestamp - i * 86400000).toLocaleDateString(),
    details: i % 2 === 0 ? "Success" : "Completed",
  }));
};

export const voices = [
  {
    id: "Kore",
    name: "Kore",
    gender: "Female",
    desc: "Balanced & Professional",
  },
  {
    id: "Zephyr",
    name: "Zephyr",
    gender: "Female",
    desc: "Bright & Helpful",
  },
  { id: "Puck", name: "Puck", gender: "Male", desc: "Calm & Reassuring" },
  {
    id: "Charon",
    name: "Charon",
    gender: "Male",
    desc: "Deep & Authoritative",
  },
  { id: "Fenrir", name: "Fenrir", gender: "Male", desc: "Strong & Direct" },
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
