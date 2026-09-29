// Fechas del DÍA DEL CONDUCTOR (hora local), en un solo sitio.
//
// Nació de un error real: las fechas se sacaban con
// `new Date().toISOString().slice(0, 10)`, que da la fecha en UTC. En Nueva York
// (UTC-4 / UTC-5) eso significa que a partir de las 20:00 la fecha UTC ya es la
// de MAÑANA: los viajes de la tarde-noche quedaban fechados al día siguiente y el
// panorama semanal de FINANCE mostraba "INGRESO REAL $0.00" aunque el encabezado
// sí contara los viajes. La regla es simple: un viaje pertenece al día en que el
// conductor lo hizo, en su reloj.

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

// "YYYY-MM-DD" en hora LOCAL. Acepta Date, milisegundos o una cadena ISO.
export function localDateKey(input: Date | string | number = new Date()): string {
  const d =
    input instanceof Date
      ? input
      : typeof input === "number"
        ? new Date(input)
        : new Date(String(input))
  if (Number.isNaN(d.getTime())) return localDateKey(new Date())
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Suma días a una clave de fecha sin salir de la hora local.
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = String(key).split("-").map((part) => Number(part))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return key
  const date = new Date(y, m - 1, d, 12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

// Hora local "HH:mm" de un instante, para mostrar y para agrupar por hora.
export function localTimeLabel(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return "00:00"
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
