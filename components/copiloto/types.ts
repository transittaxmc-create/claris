import type { LocationPoint } from "./geo"

export type Platform = "Uber" | "Lyft" | "Aventus Ride" | "Cash" | "Other"

export type TripStatus = "pending" | "matched"

export type { LocationPoint }

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
  // Structured GPS location captured with PICKUP NOW / DROPOFF NOW
  pickupLoc?: LocationPoint
  dropoffLoc?: LocationPoint
  time: string // "14:46"
  ref: string
  status: TripStatus
  // Original entry object from ic_tip_tracker, preserved so GPS/coords survive a round-trip
  raw?: Record<string, unknown>
}

export const PLATFORMS: Platform[] = ["Uber", "Lyft", "Aventus Ride", "Cash", "Other"]

export function grossOf(t: Trip): number {
  // Gross income is calculated before platform fees:
  // EARNINGS + EXTRA CASH + TIPS + TOLLS.
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
    id: "e-1789570007383",
    platform: "Uber",
    isVoucher: false,
    earnings: 85.66,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "Queensboro Plaza, Court Square, Long Island City, Queens, NY 11101",
    dropoff: "2 East 60th Street, Manhattan, NY 10022",
    time: "14:46",
    ref: "JH",
    status: "pending",
  },
  {
    id: "e-1789563651326",
    platform: "Uber",
    isVoucher: false,
    earnings: 38.04,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "",
    dropoff: "JFK Access Road, Queens, NY 11430",
    time: "13:00",
    ref: "",
    status: "pending",
  },
  {
    id: "e-1789410838473",
    platform: "Aventus Ride",
    isVoucher: true,
    earnings: 54.0,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "4B, Mineola Avenue, Roslyn Estates, Roslyn Heights, NY 11577",
    dropoff: "42 East 96th Street, Brooklyn, NY 11212",
    time: "18:33",
    ref: "",
    status: "pending",
  },
  {
    id: "e-1789404575549",
    platform: "Aventus Ride",
    isVoucher: true,
    earnings: 38.0,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "109-50, 142nd Street, Queens, NY 11435",
    dropoff: "1574 Hillside Avenue, New Hyde Park, NY 11040",
    time: "16:49",
    ref: "",
    status: "pending",
  },
  {
    id: "e-1789401593758",
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
