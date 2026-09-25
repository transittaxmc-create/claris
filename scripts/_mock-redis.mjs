// Servidor falso que imita la API REST de Upstash/Vercel KV, sólo para probar
// /api/sync en local.  Ejecutar: node scripts/_mock-redis.mjs
import http from "node:http"

const store = new Map()

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost")
  const path = decodeURIComponent(url.pathname.replace(/^\//, ""))
  const slash = path.indexOf("/")
  const command = slash === -1 ? path : path.slice(0, slash)
  const key = slash === -1 ? "" : path.slice(slash + 1)

  const send = (body, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" })
    res.end(JSON.stringify(body))
  }

  if (req.method === "GET" && command === "get") return send({ result: store.get(key) ?? null })
  if (command === "dbsize") return send({ result: store.size })
  if (req.method === "POST" && command === "set") {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => {
      store.set(key, body)
      send({ result: "OK" })
    })
    return
  }
  send({ error: "comando_desconocido" }, 404)
})

server.listen(8787, () => console.log("mock KV escuchando en 8787"))
