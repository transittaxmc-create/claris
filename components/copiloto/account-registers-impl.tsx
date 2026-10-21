"use client"

// Placeholder - will be replaced with full implementation
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

export function RegistersHome(props: any) {
  return (
    <div className="p-4 text-[13px] text-neutral-300">
      Restaurando registro… refresca en un momento.
    </div>
  )
}

export function RegisterDetail(props: any) {
  return null
}

export function AddAccountModal(props: any) {
  return null
}

export function TransfersReport(props: any) {
  return null
}
