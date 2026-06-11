type MetadataItem = 
| { baseAmount: number, fee?: number }
| Record<string, string | boolean>;

// Response body
type DepositPayLoad = {
  amount: string,
  country: string,
  created: string,
  currency: string,
  customerMessage: string,
  depositId: string,
  payer: {
    accountDetails: {
      phoneNumber: string,
      provider: string
    },
    type: string
  },
  providerTransactionId: string,
  status: "COMPLETED" | "PENDING" | "FAILED"
  metadata?: MetadataItem[];
}

type PayoutPayLoad = {
  amount: string,
  country: string,
  created: string,
  currency: string,
  customerMessage: string,
  payoutId: string,
  providerTransactionId: string,
  recipient: {
    accountDetails: { phoneNumber: string, provider: string },
    type: string
  },
  status: 'COMPLETED' | "FAILED" | "PENDING"
}


type RefundPayLoad = {
  amount: string,
  country: string,
  created: string, 
  currency: string,
  customerMessage: string,
  providerTransactionId: string,
  recipient: {
    accountDetails: { phoneNumber: string, provider: string },
    type: string
  },
  refundId: string,
  status: 'COMPLETED' | "FAILED" | "PENDING"
}