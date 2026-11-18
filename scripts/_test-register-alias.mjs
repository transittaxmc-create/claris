// Bootstrap para las pruebas _test-*.mjs: instala el gancho que traduce el
// alias `@/` a la raíz del repo. Uso:
//   node --import ./scripts/_test-register-alias.mjs scripts/_test-....mjs
import { register } from "node:module"

register("./_test-alias-loader.mjs", import.meta.url)
