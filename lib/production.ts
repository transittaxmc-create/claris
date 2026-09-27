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

// Cronómetro con encendido y apagado.
//
// Se enciende cuando el conductor empieza a trabajar y se apaga cuando termina.
// Apagado, el tiempo deja de correr (se queda congelado en el minuto en que se
// apagó) aunque el reloj de la hora siga avanzando. Al cambiar de hora el conteo
// se reinicia solo, así que un cronómetro que quedó apagado en una hora anterior
// vuelve a cero en la hora nueva: no arrastra tiempo de antes.
export type TimerReading = {
  elapsedSec: number // segundos contados en la hora en curso
  remainingMin: number // minutos que quedan de la hora (el reloj de la hora sigue)
  running: boolean // true si está contando ahora mismo
}

export function timerReading(input: { now: Date; on: boolean; stoppedAt: number | null }): TimerReading {
  const win = hourWindow(input.now)
  if (input.on) return { elapsedSec: win.elapsedSec, remainingMin: win.remainingMin, running: true }
  const stoppedAt = input.stoppedAt
  if (stoppedAt === null || !Number.isFinite(stoppedAt)) {
    return { elapsedSec: 0, remainingMin: win.remainingMin, running: false }
  }
  // Solo cuenta lo que se trabajó DENTRO de la hora en curso: si se apagó antes
  // de esta hora, el conteo de esta hora es cero.
  const hourStart = new Date(input.now)
  hourStart.setMinutes(0, 0, 0)
  const deltaSec = Math.floor((stoppedAt - hourStart.getTime()) / 1000)
  if (deltaSec < 0) return { elapsedSec: 0, remainingMin: win.remainingMin, running: false }
  const elapsedSec = Math.min(3600, deltaSec)
  return { elapsedSec, remainingMin: Math.max(0, 60 - Math.floor(elapsedSec / 60)), running: false }
}

// Suma de lo producido en la hora en curso (los viajes cuya hora coincide).
export function productionThisHour(trips: HourlyTrip[], now: Date): number {
  const today = now.toISOString().slice(0, 10)
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
