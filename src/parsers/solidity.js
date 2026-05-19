// Парсер Solidity (.sol)
// Поддерживает: contract, interface, library, function, modifier,
//               event, error, constructor, struct, enum

import { esc } from "./utils.js"

export default {
  extensions: [".sol"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*\/\//.test(line)) continue

      // contract/interface/library Name {
      const topM = line.match(/^\s*(contract|interface|library)\s+([A-Za-z_]\w*)\s*(?:is\s+[^{]+)?\{?/)
      if (topM) {
        results.push({ name: `${topM[2]} (${topM[1]})`, line: i + 1 })
        continue
      }

      // function name( / constructor( / fallback( / receive(
      const fnM = line.match(/^\s*function\s+([a-zA-Z_]\w*)\s*\(/)
      if (fnM) { results.push({ name: fnM[1] + "()", line: i + 1 }); continue }

      const ctorM = line.match(/^\s*(constructor|fallback|receive)\s*\(/)
      if (ctorM) { results.push({ name: ctorM[1] + "()", line: i + 1 }); continue }

      // modifier name(
      const modM = line.match(/^\s*modifier\s+([a-zA-Z_]\w*)\s*\(/)
      if (modM) { results.push({ name: `${modM[1]} (modifier)`, line: i + 1 }); continue }

      // event Name( / error Name(
      const evM = line.match(/^\s*(event|error)\s+([A-Za-z_]\w*)\s*\(/)
      if (evM) { results.push({ name: `${evM[2]} (${evM[1]})`, line: i + 1 }); continue }

      // struct Name { / enum Name {
      const seM = line.match(/^\s*(struct|enum)\s+([A-Za-z_]\w*)\s*\{/)
      if (seM) results.push({ name: `${seM[2]} (${seM[1]})`, line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\(\)|^\w+\.|\s*\(.*\)$/, '')
    const e = esc(name)
    const patterns = [
      new RegExp(`(?:contract|interface|library)\\s+${e}\\b`),
      new RegExp(`function\\s+${e}\\s*\\(`),
      new RegExp(`modifier\\s+${e}\\s*\\(`),
      new RegExp(`(?:event|error)\\s+${e}\\s*\\(`),
      new RegExp(`(?:struct|enum)\\s+${e}\\s*\\{`),
      new RegExp(`\\b(constructor|fallback|receive)\\s*\\(`)
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\/\//.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].includes(name)) return i + 1
      }
    }
    return null
  }
}
