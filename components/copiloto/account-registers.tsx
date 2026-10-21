"use client"

// TEMP: file restored in next commit with full content via push_files
export interface BankTx {
  date: string
  bank_account: string
  detail: string
  category: string | null
  amount: number
  daily_balance: number | null
  pending?: boolean
  transaction_id?: string
  pending_transaction_id?: string | null
}

export function RegistersHome() {
  return null
}

export function RegisterDetail() {
  return null
}

export function AddAccountModal() {
  return null
}

export function TransfersReport() {
  return null
}
