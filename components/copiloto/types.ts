export type Platform = "Uber" | "Lyft" | "Aventus Ride" | "Cash" | "Other"

export type TripStatus = "pending" | "matched"

export type Trip = {
  id: string
  platform: Platform
  isVoucher: boolean
  earnings: number
  extraCash: number
  tips: number
  toll: number
  platformFee: number
  pickup: string
  dropoff: string
  time: string // "14:46"
  ref: string
  status: TripStatus
}

export const PLATFORMS: Platform[] = ["Uber", "Lyft", "Aventus Ride", "Cash", "Other"]

export function grossOf(t: Trip): number {
  return t.earnings + t.extraCash + t.tips + t.toll
}

export function netOf(t: Trip): number {
  return grossOf(t) - t.platformFee
}

export function money(n: number): string {
  return `$${n.toFixed(2)}`
}

export function newTrip(): Trip {
  return {
    id: crypto.randomUUID(),
    platform: "Uber",
    isVoucher: false,
    earnings: 0,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "",
    dropoff: "",
    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
    ref: "",
    status: "pending",
  }
}

export const SEED_TRIPS: Trip[] = [
  {
    id: "t1",
    platform: "Uber",
    isVoucher: false,
    earnings: 85.66,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "Queensboro Plaza, Court Square",
    dropoff: "Long Island City, Queens",
    time: "14:46",
    ref: "",
    status: "pending",
  },
  {
    id: "t2",
    platform: "Uber",
    isVoucher: false,
    earnings: 38.04,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "",
    dropoff: "JFK Access Road, Queens, NY 114...",
    time: "13:00",
    ref: "",
    status: "pending",
  },
  {
    id: "t3",
    platform: "Aventus Ride",
    isVoucher: true,
    earnings: 54.0,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "4B, Mineola Avenue, Roslyn Estates",
    dropoff: "Roslyn Heights, Town of N...",
    time: "18:33",
    ref: "",
    status: "pending",
  },
  {
    id: "t4",
    platform: "Aventus Ride",
    isVoucher: true,
    earnings: 38.0,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "109-50, 142nd Street, Queens",
    dropoff: "Queens County, NY 11435...",
    time: "16:49",
    ref: "",
    status: "pending",
  },
  {
    id: "t5",
    platform: "Uber",
    isVoucher: false,
    earnings: 1.0,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "",
    dropoff: "",
    time: "15:59",
    ref: "",
    status: "pending",
  },
]
