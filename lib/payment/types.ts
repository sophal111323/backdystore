// lib/payment/types.ts
//
// Shared payment provider types. Provider-specific details live in
// lib/payment/providers/* — the rest of the app only uses these shapes.

export type PaymentMethod = "TOLASAINT" | "MANUAL" | "ABA" | "ACLEDA" | "WING";

export interface InitiatePaymentArgs {
  orderNumber: string;
  amountUsd: number;
  /** Order currency — server-loaded from the DB, never from the browser. */
  currency?: string;
  method: PaymentMethod;
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  note?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface PaymentInitResult {
  paymentRef: string;
  redirectUrl: string;
  qrString?: string;
  expiresAt: Date;
}

export type PaymentStatusResult = {
  status: string;
  paid: boolean;
  transactionId?: string;
  orderNumber?: string;
  amount?: string;
  currency?: string;
};
