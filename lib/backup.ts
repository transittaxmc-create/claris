// Copia de seguridad total: todos los datos en JSON + un índice legible en HTML.
//
// Lógica determinista (sin DOM ni localStorage): recibe los datos ya extraídos y
// devuelve las cadenas a descargar. Se prueba en Node.

export type BackupTripRow = { date: string; platform: string; gross: number; net: number }
export type BackupExpenseRow = {
  date: string
  vendor: string
  category: string
  amount: number
  classification?: string
}

export type BackupInput = {
  date: string // "YYYY-MM-DD"
  trips: BackupTripRow[]
  expenses: BackupExpenseRow[]
  keys: Record<string, string> // clave -> contenido crudo de localStorage
}

// Prefijos de las claves propias de la app. Se excluye cualquier otra cosa
// (extensiones, analytics) para que el backup no arrastre basura.
export const APP_KEY_PREFIXES = ["ic_", "claris_", "CURRENT_"]

export function isAppKey(key: string): boolean {
  return APP_KEY_PREFIXES.some((p) => key.startsWith(p))
}

// Extrae las claves de la app desde un almacenamiento tipo localStorage.
export function collectAppKeys(ls: {
  length: number
  key(i: number): string | null
  getItem(k: string): string | null
}): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (!k || !isAppKey(k)) continue
      const v = ls.getItem(k)
      out[k] = v ?? ""
    }
  } catch {}
  return out
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function money(n: number): string {
  return `$${(Number(n) || 0).toFixed(2)}`
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

// Índice HTML legible: sirve para reconstruir el contexto de un vistazo aunque
// se pierda la app. Incluye totales, tablas y qué claves se respaldaron.
export function buildBackupHtml(input: BackupInput): string {
  const gross = input.trips.reduce((s, t) => s + (Number(t.gross) || 0), 0)
  const net = input.trips.reduce((s, t) => s + (Number(t.net) || 0), 0)
  const expenseTotal = input.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const business = input.expenses
    .filter((e) => e.classification === "business")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const personal = input.expenses
    .filter((e) => e.classification === "personal")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const keyRows = Object.entries(input.keys)
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td class="n">${bytes(v.length)}</td></tr>`)
    .join("")

  const tripRows = input.trips
    .map(
      (t) =>
        `<tr><td>${esc(t.date)}</td><td>${esc(t.platform)}</td><td class="n">${money(t.gross)}</td><td class="n">${money(t.net)}</td></tr>`,
    )
    .join("")

  const expenseRows = input.expenses
    .map(
      (e) =>
        `<tr><td>${esc(e.date)}</td><td>${esc(e.vendor)}</td><td>${esc(e.category)}</td><td>${
          e.classification === "business" ? "💼 Business" : e.classification === "personal" ? "🏠 Personal" : "—"
        }</td><td class="n">${money(e.amount)}</td></tr>`,
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Índice de copia de seguridad · ${esc(input.date)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 2rem; background: #f7f8fa; color: #14181f; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  h2 { font-size: 1rem; margin: 1.75rem 0 .5rem; border-bottom: 2px solid #e3e6ec; padding-bottom: .25rem; }
  p.meta { color: #5a6472; margin: 0 0 1rem; font-size: .9rem; }
  .cards { display: flex; flex-wrap: wrap; gap: .75rem; margin-bottom: .5rem; }
  .card { background: #fff; border: 1px solid #e3e6ec; border-radius: .6rem; padding: .75rem 1rem; min-width: 9rem; }
  .card .k { font-size: .7rem; text-transform: uppercase; letter-spacing: .04em; color: #6b7686; }
  .card .v { font-size: 1.15rem; font-weight: 700; margin-top: .15rem; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e3e6ec; border-radius: .5rem; overflow: hidden; font-size: .85rem; }
  th, td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid #eef1f5; }
  th { background: #f2f4f8; font-size: .72rem; text-transform: uppercase; letter-spacing: .03em; color: #55606f; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  code { background: #eef1f5; padding: .1rem .3rem; border-radius: .25rem; font-size: .8em; }
  .note { background: #fff8e6; border: 1px solid #f0dca8; border-radius: .5rem; padding: .75rem 1rem; font-size: .85rem; }
</style>
</head>
<body>
  <h1>Índice de copia de seguridad</h1>
  <p class="meta">Generado el ${esc(input.date)} · IslandCity Tip Tracker / Claris</p>

  <div class="cards">
    <div class="card"><div class="k">Viajes</div><div class="v">${input.trips.length}</div></div>
    <div class="card"><div class="k">Bruto</div><div class="v">${money(gross)}</div></div>
    <div class="card"><div class="k">Neto</div><div class="v">${money(net)}</div></div>
    <div class="card"><div class="k">Gastos</div><div class="v">${money(expenseTotal)}</div></div>
    <div class="card"><div class="k">Business</div><div class="v">${money(business)}</div></div>
    <div class="card"><div class="k">Personal</div><div class="v">${money(personal)}</div></div>
    <div class="card"><div class="k">Resultado</div><div class="v">${money(net - expenseTotal)}</div></div>
  </div>

  <h2>Archivos respaldados (${Object.keys(input.keys).length})</h2>
  <table><thead><tr><th>Clave</th><th class="n">Tamaño</th></tr></thead><tbody>${keyRows}</tbody></table>

  <h2>Viajes (${input.trips.length})</h2>
  ${input.trips.length === 0 ? "<p class='meta'>Sin viajes registrados.</p>" : `<table><thead><tr><th>Fecha</th><th>Plataforma</th><th class="n">Bruto</th><th class="n">Neto</th></tr></thead><tbody>${tripRows}</tbody></table>`}

  <h2>Gastos (${input.expenses.length})</h2>
  ${input.expenses.length === 0 ? "<p class='meta'>Sin gastos registrados.</p>" : `<table><thead><tr><th>Fecha</th><th>Vendedor</th><th>Categoría</th><th>Clasificación</th><th class="n">Monto</th></tr></thead><tbody>${expenseRows}</tbody></table>`}

  <h2>Cómo restaurar</h2>
  <div class="note">
    Usa el archivo <strong>JSON</strong> descargado junto a este índice en la pestaña
    <strong>DATA → IMPORTAR JSON</strong> de la app. Este HTML es el índice legible: te dice
    qué había en cada archivo y los totales del momento del respaldo.
  </div>
</body>
</html>`
}

// Paquete JSON completo: todos los archivos + metadatos.
export function buildBackupBundle(input: BackupInput): string {
  return JSON.stringify(
    {
      app: "IslandCity Tip Tracker",
      kind: "full-backup",
      version: 3,
      exportDate: new Date(`${input.date}T12:00:00`).toISOString(),
      counts: { trips: input.trips.length, expenses: input.expenses.length },
      keys: input.keys,
    },
    null,
    2,
  )
}
