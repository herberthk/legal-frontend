"use client"
import { CustomButton } from '@/components/ui/custom-button'
import { formatUgx, formatUSD } from '@/utils';
import { Check, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import React from 'react'

type Props = {
    amount: number;
    method: TransactionMethod;
    user: User;
}

const Success = ({amount,method,user}: Props) => {
  const dollarAmount= amount/100
  return (
     <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="rounded-2xl p-8 md:p-12 shadow-2xl  relative overflow-hidden w-full max-w-lg text-center animate-in zoom-in-95 duration-500">
        {/* Background gradients */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex justify-center mb-6">
          <div className="p-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 animate-bounce duration-1000">
            <CheckCircle2 className="h-20 w-20" />
          </div>
        </div>

        <h1 className="font-bold text-3xl text-foreground mb-4">
          Deposit Successful!
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Awesome! A deposit of{" "}
          <span className="font-bold text-emerald-400">
            {formatUSD(dollarAmount)}
          </span>{" "}
          has been securely credited to your wallet balance.
        </p>

        <div className="bg-slate-500/5 rounded-xl p-5 divide-y divide-slate-400/50 mb-8 text-left text-sm">
          <div className="flex justify-between pb-3">
            <span className="text-muted-foreground">Amount Credited</span>
            <span className="font-semibold text-foreground">
              {formatUSD(dollarAmount)} ({formatUgx(dollarAmount)})
            </span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="font-semibold text-foreground uppercase">
              {method === "AIRTEL" || method === "MTN" ? "Mobile Money" : "Card"}
            </span>
          </div>
          <div className="flex justify-between pt-3">
            <span className="text-muted-foreground">New Balance</span>
            <span className="font-bold text-indigo-400">
              {formatUSD(user.balance / 100)} ({formatUgx(user.balance / 100)})
            </span>
          </div>
        </div>

        <CustomButton
                 component={Link}
                 href="/dashboard/user/billing"
                 variant="transparent"
                 shape="pill"
                 borderLeftWidth="4px"
                 borderLeftColor="#4f46e5"
                 borderRightWidth="4px"
                 borderRightColor="#ea580c"
                 className="bg-slate-100/50 dark:bg-slate-800/50 uppercase tracking-wider"
                 rightIcon={<Check size={20} />}
                 hoverEffect="glow"
                 fullWidth
               >
                 Done
               </CustomButton>
      </div>
    </div>
  )
}

export default Success