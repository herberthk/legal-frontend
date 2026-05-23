import TransactionReceiptEmail from '@/components/emails/TransactionReceiptEmail'

import React from 'react'

const page = () => {
  return (    
    <TransactionReceiptEmail
      userName="Herbert"
      userEmail="herberthtk100@gmail.com"
      amountUSD="$20.00"
      amountUGX="UGX 78,000"
      paymentMethod="Stripe Card"
      reference="123456789"
      date="May 23, 2025 10:30 AM"
      newBalanceUSD="$20.00"
      receiptUrl="https://example.com"
      dashboardUrl="https://example.com"
    />
  )
}

export default page