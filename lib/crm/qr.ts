/**
 * Codificador QR mínimo hecho en casa (modo byte, corrección M,
 * versiones 1–6, máscara 0) — puerto del prototipo.
 *
 * Uso en el CRM: el QR de cobro de los popups de pago. Zelle NO admite
 * monto dentro del QR: su QR lleva solo el identificador (el cliente
 * escanea, su app le muestra el destinatario y él escribe el monto).
 * Venmo y Cash App sí llevan el enlace con el monto precargado.
 * [PC-QR] El QR oficial es el de la app del banco de Miguel: cuando él
 * guarde esa imagen en Settings, reemplaza a este QR generado.
 */

const QR_EC_T: Record<number, [number, number]> = { 1: [10, 1], 2: [16, 1], 3: [26, 1], 4: [18, 2], 5: [24, 2], 6: [16, 4] }
const QR_TOT_T: Record<number, number> = { 1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172 }
const QR_ALN_T: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] }
const QR_REM_T: Record<number, number> = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7 }
const QR_EXP: number[] = []
const QR_LOG: number[] = []
;(function () {
  let x = 1
  for (let i = 0; i < 255; i++) {
    QR_EXP[i] = x
    QR_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) QR_EXP[i] = QR_EXP[i - 255]
})()

function qrMul(a: number, b: number): number {
  return a && b ? QR_EXP[QR_LOG[a] + QR_LOG[b]] : 0
}
function qrGenPoly(n: number): number[] {
  let poly = [1]
  for (let i = 0; i < n; i++) {
    const np = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      np[j] ^= qrMul(poly[j], QR_EXP[i])
      np[j + 1] ^= poly[j]
    }
    poly = np
  }
  return poly
}
function qrEc(data: number[], genHF: number[]): number[] {
  const n = genHF.length - 1
  const res = new Array(n).fill(0)
  for (const d of data) {
    const f = d ^ (res.shift() as number)
    res.push(0)
    for (let i = 0; i < n; i++) res[i] ^= qrMul(genHF[i + 1], f)
  }
  return res
}
function qrCodewords(bytes: number[], ver: number): number[] {
  const [ecLen, blocks] = QR_EC_T[ver]
  const dataCw = QR_TOT_T[ver] - ecLen * blocks
  const bits: number[] = []
  const push = (v: number, l: number) => {
    for (let i = l - 1; i >= 0; i--) bits.push((v >>> i) & 1)
  }
  push(4, 4)
  push(bytes.length, 8)
  bytes.forEach((b) => push(b, 8))
  push(0, Math.min(4, dataCw * 8 - bits.length))
  while (bits.length % 8) bits.push(0)
  const out: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]
    out.push(v)
  }
  const pads = [0xec, 0x11]
  let k = 0
  while (out.length < dataCw) out.push(pads[k++ % 2])
  const per = dataCw / blocks
  const gen = qrGenPoly(ecLen).slice().reverse()
  const bl: number[][] = []
  const ecs: number[][] = []
  for (let b = 0; b < blocks; b++) {
    const chunk = out.slice(b * per, (b + 1) * per)
    bl.push(chunk)
    ecs.push(qrEc(chunk, gen))
  }
  const all: number[] = []
  for (let i = 0; i < per; i++) for (let b = 0; b < blocks; b++) all.push(bl[b][i])
  for (let i = 0; i < ecLen; i++) for (let b = 0; b < blocks; b++) all.push(ecs[b][i])
  return all
}

/** Matriz del QR (1 = módulo oscuro) o null si el texto no cabe (v > 6). */
export function qrMatrix(text: string): number[][] | null {
  const bytes = [...new TextEncoder().encode(text)]
  let ver = 0
  for (let v = 1; v <= 6; v++) {
    const [e, b] = QR_EC_T[v]
    if (bytes.length <= QR_TOT_T[v] - e * b - 2) {
      ver = v
      break
    }
  }
  if (!ver) return null
  const codewords = qrCodewords(bytes, ver)
  const size = 21 + (ver - 1) * 4
  const m: (number | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null))
  const set = (x: number, y: number, v: number) => {
    m[y][x] = v
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy
        if (x < 0 || y < 0 || x >= size || y >= size) continue
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        set(x, y, d !== 2 && d !== 4 ? 1 : 0)
      }
  }
  finder(3, 3)
  finder(size - 4, 3)
  finder(3, size - 4)
  for (let i = 0; i < size; i++) {
    if (m[6][i] === null) set(i, 6, i % 2 === 0 ? 1 : 0)
    if (m[i][6] === null) set(6, i, i % 2 === 0 ? 1 : 0)
  }
  const ap = QR_ALN_T[ver]
  if (ap.length) {
    const a = ap[1]
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        set(a + dx, a + dy, d !== 1 ? 1 : 0)
      }
  }
  set(8, size - 8, 1)
  for (let i = 0; i <= 8; i++) {
    if (m[8][i] === null) m[8][i] = 0
    if (m[i][8] === null) m[i][8] = 0
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = 0
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = 0
  }
  const bits: number[] = []
  codewords.forEach((cw) => {
    for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1)
  })
  for (let i = 0; i < QR_REM_T[ver]; i++) bits.push(0)
  let bit = 0
  let upward = true
  for (let x = size - 1; x > 0; x -= 2) {
    if (x === 6) x = 5
    for (let i = 0; i < size; i++) {
      const y = upward ? size - 1 - i : i
      for (let dx = 0; dx < 2; dx++) {
        const cx = x - dx
        if (m[y][cx] === null) {
          let v = bit < bits.length ? bits[bit++] : 0
          if ((cx + y) % 2 === 0) v ^= 1
          set(cx, y, v)
        }
      }
    }
    upward = !upward
  }
  let rem = 0
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) & 1) ? 0x537 : 0)
  const fmt = ((0 << 10) | rem) ^ 0x5412 // nivel M (00), máscara 0
  const fb = (i: number) => (fmt >>> i) & 1
  for (let i = 0; i <= 5; i++) set(8, i, fb(i))
  set(8, 7, fb(6))
  set(8, 8, fb(7))
  set(7, 8, fb(8))
  for (let i = 9; i < 15; i++) set(14 - i, 8, fb(i))
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, fb(i))
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, fb(i))
  set(8, size - 8, 1)
  return m as number[][]
}

/** Path SVG de los módulos oscuros (con zona de silencio de 4). */
export function qrSvgPath(text: string): { d: string; total: number } | null {
  const m = qrMatrix(text)
  if (!m) return null
  const size = m.length
  const q = 4
  const total = size + q * 2
  let d = ""
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (m[y][x]) d += `M${x + q} ${y + q}h1v1h-1z`
  return { d, total }
}
