import type { LocationPoint } from "./geo"
import { localDateKey } from "@/lib/dates"

export type Platform =
  | "Uber"
  | "Lyft"
  | "Limosys"
  | "Eco Ride"
  | "Throo"
  | "AKI Technology"
  | "Classic Ryde"
  | "Aventus Ride"
  | "Island City Transit"
  | "Cash"
  | "Other"

export type TripStatus = "pending" | "matched"

export type { LocationPoint }

export const EXPENSE_CATEGORIES = [
  "Fuel",
  "Vehicle maintenance",
  "Car leasing",
  "Rent",
  "Tolls",
  "Food",
  "Car wash",
  "Insurance",
  "Bank fees",
  "Phone",
  "Parking",
  "Supplies",
  "Other",
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const CUSTOM_CATEGORIES_KEY = "claris_custom_categories"
