// Парсер GraphQL (.graphql, .gql)
// Поддерживает: type, interface, enum, input, union, query, mutation,
//               subscription, fragment, extend, scalar

import { esc } from "./utils.js"

const GQL_KINDS = "type|interface|enum|input|union|query|mutation|subscription|fragment|extend\\s+type|extend\\s+interface|scalar"
const GQL_RE = new RegExp(`^\\s*(${GQL_KINDS})\\s+([A-Za-z_][A-Za-z0-9_]*)`)

export default {
  extensions: [".graphql", ".gql"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      const m = lines[i].match(GQL_RE)
      if (m) {
        const kind = m[1].replace(/\s+/, ' ')
        results.push({ name: `${m[2]} (${kind})`, line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    // methodName может быть "User (type)" или просто "User"
    const name = methodName.replace(/\s*\(.*\)$/, '')
    const e = esc(name)
    const p = new RegExp(`(?:${GQL_KINDS})\\s+${e}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(name)) return i + 1
    }
    return null
  }
}
