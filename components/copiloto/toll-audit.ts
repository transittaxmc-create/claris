/**
 * E-ZPass toll audit: match scanned statement charges against the GPS toll log.
 *
 * GPS log = the "[HH:MM] Plaza - $X.XX" notes auto-written by toll-detect.ts
 * into each trip. Statement = charges extracted by /api/scan-toll-statement.
 *
 * Match rules:
 *  - same date AND same plaza (fuzzy) AND amount within $0.60 → MATCHED
 *  - statement charge with no GPS match → UNMATCHED_STATEMENT (review: double
 *    charge? someone else's tag? plate misread?)
 *  - GPS crossing with no statement charge → UNMATCHED_GPS (not yet billed)
 *  - two statement charges, same plaza, same amount, within 40 min → DUPLICATE
 */
import type { Trip } from "./types"
import { tripDateOf } from "./types"
import type { TollCharge } from "@/app/api/scan-toll-statement/route"

export interface GpsToll {
  id: string // tripId#index
  tripId: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  plaza: string
  amount: number | null // null = "check statement" notes
  platform: string
}

const NOTE_RE = /\[(\d{2}:\d{2})\]\s*(.+?)\s*-\s*\$?([\d,]+\.\d{2})/

/** Extract GPS toll crossings from trip notes. */
export function gpsTollsFromTrips(trips: Trip[]): GpsToll[] {
  const out: GpsToll[] = []
  for (const t of trips) {
    const notes = t.notes || ""
    if (!notes.includes("[")) continue
    const date = tripDateOf(t)
    if (!date) continue
    const parts = notes.split("|")
    parts.forEach((part, i) => {
      const m = part.match(NOTE_RE)
      if (m) {
        out.push({
          id: `${t.id}#${i}`,
          tripId: t.id,
          date,
          time: m[1],
          plaza: m[2].trim(),
          amount: Number(m[3].replace(/,/g, "")),
          platform: String(t.platform || ""),
        })
      } else if (/check E-ZPass statement/i.test(part)) {
        const tm = part.match(/\[(\d{2}:\d{2})\]/)
        const nm = part.match(/\[\d{2}:\d{2}\]\s*(.+?)\s*—/)
        out.push({
          id: `${t.id}#${i}`,
          tripId: t.id,
          date,
          time: tm ? tm[1] : "",
          plaza: nm ? nm[1].trim() : part.trim().slice(0, 60),
          amount: null,
          platform: String(t.platform || ""),
        })
      }
    })
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}

/** Normalize plaza names for fuzzy matching ("GWB" = "George Washington Bridge"). */
export function normPlaza(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bgeorge washington bridge\b/, "gwb")
    .replace(/\brobert f kennedy bridge\b/, "rfk")
    .replace(/\btriboro\b/, "rfk")
    .replace(/\bqueens midtown tunnel\b/, "midtown tunnel")
    .replace(/\bhugh l carey tunnel\b/, "carey tunnel")
    .replace(/\bbrooklyn battery\b/, "carey tunnel")
    .replace(/\bverrazzano narrows bridge\b/, "verrazzano")
    .replace(/\bverrazano\b/, "verrazzano")
    .replace(/\bbronx whitestone\b/, "whitestone")
    .replace(/\bthrogs neck\b/, "throgs neck")
    .replace(/\bhenry hudson\b/, "henry hudson")
    .replace(/\bcross bay\b/, "cross bay")
    .replace(/\bmarine parkway\b/, "marine parkway")
    .replace(/\bgov mario m cuomo bridge\b/, "cuomo bridge")
    .replace(/\btappan zee\b/, "cuomo bridge")
}

function plazaMatch(a: string, b: string): boolean {
  const na = normPlaza(a)
  const nb = normPlaza(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

function minutesOf(t: string): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(t || "")
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export type AuditStatus = "matched" | "unmatched_statement" | "unmatched_gps" | "duplicate"

export interface AuditRow {
  key: string
  status: AuditStatus
  date: string
  time: string
  plaza: string
  amount: number | null
  ref?: string
  source: "statement" | "gps"
  matchInfo?: string
  tripId?: string
}

export interface AuditResult {
  rows: AuditRow[]
  matched: number
  unmatchedStatement: number
  unmatchedGps: number
  duplicates: number
  merged: number // same ref scanned twice — merged, not a duplicate payment
  statementTotal: number
  gpsTotal: number
}

/**
 * Remove exact re-scans: two charges with the same non-empty reference number
 * are the same charge scanned twice (e.g. daily screenshot + monthly statement).
 * Returns the deduped list and how many were merged.
 */
export function dedupeByRef(charges: TollCharge[]): { charges: TollCharge[]; merged: number } {
  const seen = new Map<string, TollCharge>()
  const out: TollCharge[] = []
  let merged = 0
  for (const c of charges) {
    const ref = (c.ref || "").trim()
    if (ref && seen.has(ref)) {
      merged++
      continue
    }
    if (ref) seen.set(ref, c)
    out.push(c)
  }
  return { charges: out, merged }
}

/**
 * Reconcile scanned statement charges against the GPS toll log.
 * amountTol: max |statement − gps| to still count as a match.
 * dupWindowMin: two statement charges same plaza+amount within this window = duplicate.
 */
export function auditTolls(
  rawCharges: TollCharge[],
  gpsTolls: GpsToll[],
  amountTol = 0.6,
  dupWindowMin = 40
): AuditResult {
  const { charges, merged } = dedupeByRef(rawCharges)
  const rows: AuditRow[] = []
  const gpsUsed = new Set<string>()
  const stmtMatched = new Set<number>()

  // 1. Match statement → GPS one-to-one (best match first)
  charges.forEach((c, i) => {
    let best: GpsToll | null = null
    let bestScore = Infinity
    for (const g of gpsTolls) {
      if (gpsUsed.has(g.id) || g.amount == null) continue
      if (g.date !== c.date) continue
      if (!plazaMatch(g.plaza, c.plaza)) continue
      const diff = Math.abs(g.amount - c.amount)
      if (diff > amountTol) continue
      const gt = minutesOf(g.time)
      const ct = minutesOf(c.time)
      const timeDiff = gt != null && ct != null ? Math.abs(gt - ct) : 30
      const score = diff * 10 + timeDiff
      if (score < bestScore) {
        bestScore = score
        best = g
      }
    }
    if (best) {
      gpsUsed.add(best.id)
      stmtMatched.add(i)
      rows.push({
        key: `stmt-${i}`,
        status: "matched",
        date: c.date,
        time: c.time || best.time,
        plaza: c.plaza,
        amount: c.amount,
        ref: c.ref,
        source: "statement",
        matchInfo: `GPS ${best.time} · ${best.plaza} $${best.amount!.toFixed(2)}`,
        tripId: best.tripId,
      })
    }
  })

  // 2. Duplicates: an UNMATCHED statement charge that mirrors an already-matched
  // one (same date/plaza/amount, close in time) is a likely double charge.
  const unmatchedIdx = charges.map((_, i) => i).filter((i) => !stmtMatched.has(i))
  const matchedCharges = charges.filter((_, i) => stmtMatched.has(i))
  const dupIdx = new Set<number>()
  unmatchedIdx.forEach((i) => {
    const c = charges[i]
    for (const m of matchedCharges) {
      if (c.date !== m.date) continue
      if (!plazaMatch(c.plaza, m.plaza)) continue
      if (Math.abs(c.amount - m.amount) > 0.01) continue
      const ti = minutesOf(c.time)
      const tm = minutesOf(m.time)
      if (ti == null || tm == null || Math.abs(ti - tm) <= dupWindowMin) {
        dupIdx.add(i)
        break
      }
    }
  })
  // Also catch duplicate pairs where NEITHER matched GPS (both unmatched)
  unmatchedIdx.forEach((i) => {
    if (dupIdx.has(i)) return
    unmatchedIdx.forEach((j) => {
      if (j <= i || dupIdx.has(j)) return
      const c = charges[i]
      const d = charges[j]
      if (c.date !== d.date) return
      if (!plazaMatch(c.plaza, d.plaza)) return
      if (Math.abs(c.amount - d.amount) > 0.01) return
      const ti = minutesOf(c.time)
      const tj = minutesOf(d.time)
      if (ti == null || tj == null || Math.abs(ti - tj) <= dupWindowMin) {
        dupIdx.add(i)
        dupIdx.add(j)
      }
    })
  })

  // 3. Rows for unmatched statement charges
  unmatchedIdx.forEach((i) => {
    const c = charges[i]
    if (dupIdx.has(i)) {
      rows.push({
        key: `stmt-${i}`,
        status: "duplicate",
        date: c.date,
        time: c.time,
        plaza: c.plaza,
        amount: c.amount,
        ref: c.ref,
        source: "statement",
        matchInfo: "Possible double charge on statement",
      })
    } else {
      rows.push({
        key: `stmt-${i}`,
        status: "unmatched_statement",
        date: c.date,
        time: c.time,
        plaza: c.plaza,
        amount: c.amount,
        ref: c.ref,
        source: "statement",
        matchInfo: "No GPS crossing found — review",
      })
    }
  })

  // 4. GPS crossings never billed (or not yet on this statement)
  for (const g of gpsTolls) {
    if (gpsUsed.has(g.id) || g.amount == null) continue
    rows.push({
      key: `gps-${g.id}`,
      status: "unmatched_gps",
      date: g.date,
      time: g.time,
      plaza: g.plaza,
      amount: g.amount,
      source: "gps",
      matchInfo: `Trip ${g.platform || ""} — not on statement`.trim(),
      tripId: g.tripId,
    })
  }

  rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  const statementTotal = charges.reduce((s, c) => s + c.amount, 0)
  const gpsTotal = gpsTolls.reduce((s, g) => s + (g.amount || 0), 0)

  return {
    rows,
    matched: rows.filter((r) => r.status === "matched").length,
    unmatchedStatement: rows.filter((r) => r.status === "unmatched_statement").length,
    unmatchedGps: rows.filter((r) => r.status === "unmatched_gps").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    merged,
    statementTotal: Math.round(statementTotal * 100) / 100,
    gpsTotal: Math.round(gpsTotal * 100) / 100,
  }
}

/** Plain-text audit report, ready to copy/share. */
export function auditReportText(audit: AuditResult): string {
  const lines: string[] = [
    "E-ZPASS TOLL AUDIT",
    `Statement total: $${audit.statementTotal.toFixed(2)} | GPS log total: $${audit.gpsTotal.toFixed(2)}`,
    `Matched: ${audit.matched} | Possible duplicates: ${audit.duplicates} | No GPS match: ${audit.unmatchedStatement} | Not on statement: ${audit.unmatchedGps}`,
    "",
  ]
  const section = (title: string, rows: typeof audit.rows) => {
    if (rows.length === 0) return
    lines.push(`--- ${title} ---`)
    for (const r of rows) {
      lines.push(
        `${r.date} ${r.time} | ${r.plaza} | $${r.amount != null ? r.amount.toFixed(2) : "?"}${r.ref ? ` | ref ${r.ref}` : ""}${r.matchInfo ? ` | ${r.matchInfo}` : ""}`
      )
    }
    lines.push("")
  }
  section("POSSIBLE DUPLICATES (review — paid twice?)", audit.rows.filter((r) => r.status === "duplicate"))
  section("ON STATEMENT, NO GPS MATCH", audit.rows.filter((r) => r.status === "unmatched_statement"))
  section("GPS CROSSING NOT ON STATEMENT", audit.rows.filter((r) => r.status === "unmatched_gps"))
  section("MATCHED", audit.rows.filter((r) => r.status === "matched"))
  return lines.join("\n")
}
