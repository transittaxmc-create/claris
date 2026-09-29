// Producción por hora y plan realista para cubrir pagos.
//
// Lógica pura (sin React ni localStorage) para poder probarla en Node. El
// objetivo son sugerencias HONESTAS: si a falta de 10 minutos para cerrar la
// hora faltan $40, no se dice "es posible" — se dice lo que realmente haría
// falta y se recomienda asegurar la hora siguiente.

export type HourlyTrip = {
  date: string // "YYYY-MM-DD"
  time: string // "HH:MM"
  net: number // neto del viaje
}

// Clave de fecha local. Se importa de lib/dates para que TODO el producto use el
// mismo criterio (el día del conductor, no el día UTC).
import { localDateKey } from "./dates"

// Redondeo a centavos, simétrico con los negativos.
function round2(n: number): number {
  const abs = Math.round(Math.abs(Number(n) || 0) * 100) / 100
  return Number(n) < 0 ? -abs : abs
}

export type HourWindow = {
  hour: number // 0..23 de la hora en curso
  label: string // "15:00 – 16:00"
  elapsedMin: number // minutos transcurridos de la hora
  elapsedSec: number // segundos transcurridos de la hora (para que el cronómetro avance)
  remainingMin: number // minutos que quedan de la hora
}

// Ventana de la hora en curso: el cronómetro se reinicia en cada hora en punto.
export function hourWindow(now: Date): HourWindow {
  const hour = now.getHours()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  const next = (hour + 1) % 24
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    hour,
    label: `${pad(hour)}:00 – ${pad(next)}:00`,
    elapsedMin: minutes,
    elapsedSec: minutes * 60 + seconds,
    // Minutos completos restantes: con 30 s por delante dice "queda 1 min",
    // que es más claro para el usuario que "quedan 0".
    remainingMin: Math.max(0, 60 - minutes),
  }
}

// Cronómetro por bloques de una hora.
//
// - Se enciende cuando el conductor empieza a trabajar y se apaga cuando termina.
// - APAGADO, el cronómetro vuelve a cero: se para y se limpia la pantalla.
// - Cada 60 minutos vuelve a cero solo: al caer la hora en punto arranca un bloque
//   nuevo, para que el número que se ve sea siempre "cuánto llevo en esta hora de
//   trabajo". El bloque anterior queda guardado en la estadística por hora.
// - Si se enciende a mitad de hora, el bloque arranca en ese momento (no se
//   inventa el tiempo de antes).
export type TimerReading = {
  elapsedSec: number // segundos del bloque en curso (0 si está apagado)
  remainingMin: number // minutos que le quedan al bloque de 60 minutos
  running: boolean // true si está contando ahora mismo
}

export function timerReading(input: { now: Date; on: boolean; startedAt?: number | null }): TimerReading {
  const win = hourWindow(input.now)
  if (!input.on) return { elapsedSec: 0, remainingMin: 60, running: false }
  const hourStart = startOfHourMs(input.now.getTime())
  // El bloque cuenta desde que se encendió, salvo que venga de una hora anterior:
  // en ese caso el bloque nuevo arranca en el minuto 0 de esta hora.
  const startedAt = Number(input.startedAt)
  const from = Number.isFinite(startedAt) && startedAt > hourStart ? startedAt : hourStart
  const nowMs = input.now.getTime()
  const elapsedSec = Math.max(0, Math.min(3600, Math.floor((nowMs - from) / 1000)))
  return { elapsedSec, remainingMin: Math.max(0, 60 - Math.floor(elapsedSec / 60)), running: true }
}

// ---------------------------------------------------------------------------
// Estadística por hora de trabajo
// ---------------------------------------------------------------------------

// Milisegundos del minuto 0 de la hora a la que pertenece `ms`.
export function startOfHourMs(ms: number): number {
  const d = new Date(ms)
  d.setMinutes(0, 0, 0)
  return d.getTime()
}

// Clave de una hora: "YYYY-MM-DDTHH". Es la unidad de la estadística.
export function hourKeyOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}`
}

// Clave a partir de la fecha y la hora de un viaje ("2026-09-27" + "08:35").
export function hourKeyOfTrip(date: string, time: string): string | null {
  const day = String(date ?? "").slice(0, 10)
  const hh = parseInt(String(time ?? "").split(":")[0] ?? "", 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(hh) || hh < 0 || hh > 23) return null
  return `${day}T${String(hh).padStart(2, "0")}`
}

// Minutos trabajados por hora: { "2026-09-27T08": 2700, ... } en segundos.
export type WorkedHours = Record<string, number>

// Suma segundos a una hora, sin pasar de 60 minutos ni aceptar valores basura.
export function addWorkedSeconds(worked: WorkedHours, key: string, seconds: number): WorkedHours {
  const secs = Math.floor(Number(seconds))
  if (!key || !Number.isFinite(secs) || secs <= 0) return worked
  const current = Number(worked[key]) || 0
  return { ...worked, [key]: Math.min(3600, current + secs) }
}

// Reparte un tramo trabajado (de `fromMs` a `toMs`) entre las horas que toca y lo
// suma. Así un bloque que cruza la hora en punto queda bien contado en cada hora.
export function commitWorkedRange(worked: WorkedHours, fromMs: number, toMs: number): WorkedHours {
  const from = Number(fromMs)
  const to = Number(toMs)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return worked
  let next = worked
  let cursor = from
  // Tope de seguridad: nunca más de 48 tramos (dos días) en una sola llamada.
  for (let i = 0; i < 48 && cursor < to; i++) {
    const hourStart = startOfHourMs(cursor)
    const hourEnd = hourStart + 3600_000
    const sliceEnd = Math.min(to, hourEnd)
    next = addWorkedSeconds(next, hourKeyOf(new Date(hourStart)), Math.floor((sliceEnd - cursor) / 1000))
    cursor = sliceEnd
  }
  return next
}

// Deja solo las horas de los últimos `keepDays` días (la estadística no crece sin fin).
export function trimWorked(worked: WorkedHours, now: Date, keepDays = 30): WorkedHours {
  const limit = new Date(now.getTime() - keepDays * 24 * 3600 * 1000)
  const limitKey = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, "0")}-${String(limit.getDate()).padStart(2, "0")}T00`
  const out: WorkedHours = {}
  for (const [key, value] of Object.entries(worked)) {
    if (key >= limitKey) out[key] = value
  }
  return out
}

export type HourStat = {
  key: string // "2026-09-27T08"
  day: string // "2026-09-27"
  hour: number // 8
  label: string // "08:00 – 09:00"
  produced: number // $ netos producidos en esa hora
  workedMin: number // minutos que el cronómetro contó en esa hora
  rate: number | null // $/hora real medido; null si no hay minutos medidos
}

// Estadística por hora: une lo producido (de los viajes) con lo trabajado (del
// cronómetro). Una hora entra si produjo algo o si se midió tiempo en ella.
export function hourlyStats(input: { trips: HourlyTrip[]; worked: WorkedHours; day?: string }): HourStat[] {
  const produced: Record<string, number> = {}
  for (const trip of input.trips) {
    const key = hourKeyOfTrip(String(trip.date), String(trip.time))
    if (!key) continue
    const net = Number(trip.net)
    if (!Number.isFinite(net) || net <= 0) continue
    produced[key] = round2((produced[key] ?? 0) + net)
  }

  const keys = new Set<string>([...Object.keys(produced), ...Object.keys(input.worked)])
  const stats: HourStat[] = []
  for (const key of keys) {
    if (input.day && !key.startsWith(`${input.day}T`)) continue
    const hour = parseInt(key.slice(11, 13), 10)
    if (!Number.isFinite(hour)) continue
    const workedSec = Math.max(0, Math.min(3600, Math.floor(Number(input.worked[key]) || 0)))
    const workedMin = Math.round((workedSec / 60) * 10) / 10
    const amount = round2(produced[key] ?? 0)
    stats.push({
      key,
      day: key.slice(0, 10),
      hour,
      label: `${key.slice(11, 13)}:00 – ${String((hour + 1) % 24).padStart(2, "0")}:00`,
      produced: amount,
      workedMin,
      rate: workedMin > 0 ? round2(amount / (workedMin / 60)) : null,
    })
  }
  // Más reciente primero: lo que acaba de pasar es lo que se quiere ver.
  return stats.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
}

export type HourTotals = {
  produced: number
  workedMin: number
  rate: number | null // $/hora real del conjunto
  hours: number // horas con algo (producción o tiempo)
  measuredHours: number // horas con tiempo medido
  goalHours: number // horas medidas que llegaron a la meta
  best: HourStat | null // mejor hora medida por ritmo
}

export function hourlyTotals(stats: HourStat[], goalRate: number): HourTotals {
  let produced = 0
  let workedSec = 0
  let measuredHours = 0
  let goalHours = 0
  let best: HourStat | null = null
  for (const stat of stats) {
    produced += stat.produced
    workedSec += stat.workedMin * 60
    if (stat.rate === null) continue
    measuredHours += 1
    if (stat.rate >= goalRate) goalHours += 1
    if (best === null || stat.rate > (best.rate ?? 0)) best = stat
  }
  const workedMin = Math.round((workedSec / 60) * 10) / 10
  return {
    produced: round2(produced),
    workedMin,
    rate: workedMin > 0 ? round2(produced / (workedMin / 60)) : null,
    hours: stats.length,
    measuredHours,
    goalHours,
    best,
  }
}

export type ImproveTip = { title: string; detail: string }

// Cómo mejorar, con los números del propio conductor. Regla de la casa: si el
// objetivo no es alcanzable con lo que de verdad está produciendo, se dice.
export function improveAdvice(input: { stats: HourStat[]; goalRate: number }): ImproveTip[] {
  const goal = Number(input.goalRate) > 0 ? Math.round(Number(input.goalRate)) : 55
  const totals = hourlyTotals(input.stats, goal)
  const tips: ImproveTip[] = []

  if (totals.measuredHours < 2) {
    return [
      {
        title: "Todavía no hay base para comparar",
        detail:
          "Deja el cronómetro encendido mientras trabajas. Con 2 o 3 horas medidas te digo tu ritmo real y en qué horas rindes más.",
      },
    ]
  }

  const rate = totals.rate ?? 0
  const best = totals.best

  if (rate >= goal) {
    tips.push({
      title: `Vas por encima de tu meta: $${rate.toFixed(0)}/h real`,
      detail: `Tu meta es $${goal}/h y tu ritmo medido va $${(rate - goal).toFixed(0)}/h arriba. Mantén la rutina: lo que estás haciendo ya funciona.`,
    })
  } else {
    const gap = goal - rate
    if (best && (best.rate ?? 0) >= goal) {
      tips.push({
        title: `Te faltan $${gap.toFixed(0)}/h para la meta`,
        detail: `Tu ritmo medido es $${rate.toFixed(0)}/h, pero tu mejor hora (${best.label}) llegó a $${(best.rate ?? 0).toFixed(0)}/h. Repite las condiciones de esa hora: es el ritmo que sí alcanza la meta.`,
      })
    } else {
      tips.push({
        title: `Te faltan $${gap.toFixed(0)}/h y tu mejor hora tampoco llegó`,
        detail: `Ritmo medido $${rate.toFixed(0)}/h y tu mejor hora $${(best?.rate ?? 0).toFixed(0)}/h. Forzar más velocidad no es realista: la mejora está en trabajar más horas o en apuntar a viajes más largos, no en correr.`,
      })
    }
  }

  // Mejor franja del día, sumando todo el historial guardado.
  const byHour: Record<number, { produced: number; workedSec: number }> = {}
  for (const stat of input.stats) {
    const acc = (byHour[stat.hour] ??= { produced: 0, workedSec: 0 })
    acc.produced += stat.produced
    acc.workedSec += stat.workedMin * 60
  }
  const ranked = Object.entries(byHour)
    .map(([hour, acc]) => ({
      hour: Number(hour),
      rate: acc.workedSec > 0 ? round2(acc.produced / (acc.workedSec / 3600)) : 0,
      produced: round2(acc.produced),
    }))
    .filter((row) => row.rate > 0)
    .sort((a, b) => b.rate - a.rate)
  if (ranked.length >= 2) {
    const top = ranked[0]
    tips.push({
      title: `Tu mejor franja es ${String(top.hour).padStart(2, "0")}:00`,
      detail: `En esa hora del día promedias $${top.rate.toFixed(0)}/h ($${top.produced.toFixed(2)} acumulados). Si puedes, concentra ahí las horas de trabajo.`,
    })
  }

  // Horas con viajes pero sin cronómetro: la estadística sale incompleta.
  const unmeasured = input.stats.filter((s) => s.rate === null && s.produced > 0).length
  if (unmeasured > 0) {
    tips.push({
      title: `${unmeasured} ${unmeasured === 1 ? "hora" : "horas"} sin tiempo medido`,
      detail: "Hubo producción pero el cronómetro estaba apagado, así que no se puede calcular el $/hora de esas horas. Enciéndelo al empezar y apágalo al terminar.",
    })
  }

  if (totals.measuredHours >= 3) {
    const pct = Math.round((totals.goalHours / totals.measuredHours) * 100)
    tips.push({
      title: `${totals.goalHours} de ${totals.measuredHours} horas llegaron a la meta (${pct} %)`,
      detail:
        pct >= 60
          ? `Llevas $${totals.produced.toFixed(2)} en ${(totals.workedMin / 60).toFixed(1)} h medidas. Con este porcentaje vas bien: cuida no perder las horas buenas.`
          : `Llevas $${totals.produced.toFixed(2)} en ${(totals.workedMin / 60).toFixed(1)} h medidas. Menos de 6 de cada 10 horas llegan a la meta: revisa las pausas y los huecos entre viajes.`,
    })
  }

  return tips.slice(0, 3)
}

// Suma de lo producido en la hora en curso (los viajes cuya hora coincide).
export function productionThisHour(trips: HourlyTrip[], now: Date): number {
  // Fecha LOCAL: las claves de los viajes se calculan con el día del conductor.
  const today = localDateKey(now)
  const hour = now.getHours()
  let total = 0
  for (const t of trips) {
    if (String(t.date).slice(0, 10) !== today) continue
    const hh = parseInt(String(t.time || "").split(":")[0] ?? "", 10)
    if (!Number.isFinite(hh) || hh !== hour) continue
    const net = Number(t.net)
    if (Number.isFinite(net) && net > 0) total += net
  }
  return Math.round(total * 100) / 100
}

export type HourlyAdvice = {
  earned: number
  goal: number
  // Ritmo proyectado de la hora ($/h) una vez transcurridos unos minutos.
  projectedRate: number | null
  onTrack: boolean
  // Cuánto falta para la meta y a qué ritmo habría que producir lo que resta.
  remainingToGoal: number
  neededRate: number | null
  tone: "goal-met" | "on-track" | "reachable" | "hard"
  message: string
}

// Consejo realista para la hora en curso.
export function hourlyAdvice(
  earnedInput: number,
  window: { elapsedMin: number; remainingMin: number },
  goal: number,
): HourlyAdvice {
  const earned = Math.round((Number(earnedInput) || 0) * 100) / 100
  const goalSafe = Number(goal) > 0 ? Number(goal) : 55
  const elapsed = Math.max(0, Number(window.elapsedMin) || 0)
  const remaining = Math.max(0, Number(window.remainingMin) || 0)
  const remainingToGoal = Math.max(0, Math.round((goalSafe - earned) * 100) / 100)

  // Antes de 3 minutos no hay base para proyectar.
  const projectedRate = elapsed >= 3 ? Math.round((earned / elapsed) * 60 * 100) / 100 : null

  if (earned >= goalSafe) {
    return {
      earned,
      goal: goalSafe,
      projectedRate,
      onTrack: true,
      remainingToGoal: 0,
      neededRate: null,
      tone: "goal-met",
      message:
        projectedRate !== null
          ? `🏆 Meta superada: $${earned.toFixed(2)} esta hora (ritmo $${projectedRate.toFixed(0)}/h). Todo lo que siga es ganancia extra.`
          : `🏆 Meta de la hora cumplida: $${earned.toFixed(2)}.`,
    }
  }

  if (remaining === 0) {
    return {
      earned,
      goal: goalSafe,
      projectedRate,
      onTrack: false,
      remainingToGoal,
      neededRate: null,
      tone: "hard",
      message: `Cerraste la hora con $${earned.toFixed(2)} ($${remainingToGoal.toFixed(2)} por debajo). Empieza la siguiente con un viaje más largo.`,
    }
  }

  const neededRate = Math.round((remainingToGoal / remaining) * 60 * 100) / 100

  // Si el ritmo proyectado ya alcanza la meta, va bien.
  if (projectedRate !== null && projectedRate >= goalSafe) {
    return {
      earned,
      goal: goalSafe,
      projectedRate,
      onTrack: true,
      remainingToGoal,
      neededRate,
      tone: "on-track",
      message: `✅ Vas en ritmo de $${projectedRate.toFixed(0)}/h. Te faltan $${remainingToGoal.toFixed(2)} en ${remaining} min para la meta de $${goalSafe}.`,
    }
  }

  // Realista: si el ritmo necesario es hasta 30% mayor que la meta, es alcanzable.
  if (neededRate <= goalSafe * 1.3) {
    return {
      earned,
      goal: goalSafe,
      projectedRate,
      onTrack: false,
      remainingToGoal,
      neededRate,
      tone: "reachable",
      message: `💪 Necesitas $${remainingToGoal.toFixed(2)} en ${remaining} min (ritmo $${neededRate.toFixed(0)}/h). Es alcanzable: prioriza viajes largos, sin pausas.`,
    }
  }

  // Honesto: pedir más de 30% sobre la meta a estas alturas no es realista.
  return {
    earned,
    goal: goalSafe,
    projectedRate,
    onTrack: false,
    remainingToGoal,
    neededRate,
    tone: "hard",
    message: `⚠️ Quedan ${remaining} min y faltan $${remainingToGoal.toFixed(2)}: haría falta un ritmo de $${neededRate.toFixed(0)}/h, por encima de tu meta. No es realista forzarlo — asegura la próxima hora completa.`,
  }
}

export type CoverPlan = {
  shortfall: number
  goalRate: number
  hoursPerDay: number
  daysUntilDue: number
  hoursNeeded: number
  daysNeeded: number
  feasible: boolean
  // Cuánto habría que producir por día para llegar a tiempo.
  dailyTarget: number
  message: string
}

// Plan realista para cubrir un faltante antes del vencimiento, a un ritmo de
// trabajo humano: cuántas horas y días hacen falta, y si cabe en el plazo.
export function planToCover(input: {
  shortfall: number
  goalRate: number
  hoursPerDay?: number
  daysUntilDue: number
}): CoverPlan {
  const shortfall = Math.max(0, Math.round((Number(input.shortfall) || 0) * 100) / 100)
  const goalRate = Number(input.goalRate) > 0 ? Number(input.goalRate) : 55
  const hoursPerDay = Number(input.hoursPerDay) > 0 ? Number(input.hoursPerDay) : 8
  const daysUntilDue = Math.max(0, Math.floor(Number(input.daysUntilDue) || 0))

  if (shortfall <= 0) {
    return {
      shortfall: 0,
      goalRate,
      hoursPerDay,
      daysUntilDue,
      hoursNeeded: 0,
      daysNeeded: 0,
      feasible: true,
      dailyTarget: 0,
      message: "✅ No falta nada: tus ingresos cubren los pagos de esta semana.",
    }
  }

  const hoursNeeded = Math.ceil(shortfall / goalRate)
  const daysNeeded = Math.ceil(hoursNeeded / hoursPerDay)
  const feasible = daysNeeded <= daysUntilDue
  const dailyTarget = Math.round((shortfall / Math.max(1, daysUntilDue)) * 100) / 100

  const base = `Faltan $${shortfall.toFixed(2)}: a tu meta de $${goalRate}/h son ~${hoursNeeded} h de trabajo (~${daysNeeded} día${daysNeeded === 1 ? "" : "s"} de ${hoursPerDay} h).`

  return {
    shortfall,
    goalRate,
    hoursPerDay,
    daysUntilDue,
    hoursNeeded,
    daysNeeded,
    feasible,
    dailyTarget,
    message: feasible
      ? `${base} Tienes ${daysUntilDue} día${daysUntilDue === 1 ? "" : "s"} → ✅ alcanzable. Meta diaria: $${dailyTarget.toFixed(2)}.`
      : `${base} Solo quedan ${daysUntilDue} día${daysUntilDue === 1 ? "" : "s"} → ⚠️ ajustado. Necesitarías ~${Math.ceil((shortfall / Math.max(1, daysUntilDue) / goalRate) * 10) / 10} h al día (más de ${hoursPerDay} h). Divide el pago o amplía el plazo.`,
  }
}
