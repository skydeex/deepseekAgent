// Парсер OCaml (.ml, .mli)
// Поддерживает: let/let rec, and (взаимно-рекурсивные), method (классы)

import { esc } from "./utils.js"

const SKIP_NAMES = new Set(['in', 'module', 'type', 'exception', 'external', 'open', '_'])

export default {
  extensions: [".ml", ".mli"],

  outline(lines) {
    const results = []
    const seen = new Set()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*\(\*/.test(line)) continue  // (* comment *)
      // top-level let [rec] name или and name (взаимно-рекурсивные)
      const letM = line.match(/^(?:let\s+(?:rec\s+)?|and\s+)([a-z_][a-zA-Z0-9_']*)/)
      if (letM) {
        const name = letM[1]
        if (!seen.has(name) && !SKIP_NAMES.has(name)) {
          seen.add(name)
          results.push({ name: name + "()", line: i + 1 })
        }
        continue
      }
      // method (внутри class ... end)
      const methM = line.match(/^\s*method\s+(?:private\s+|virtual\s+)*([a-zA-Z_][a-zA-Z0-9_']*)/)
      if (methM && !seen.has(methM[1])) {
        seen.add(methM[1])
        results.push({ name: methM[1] + "()", line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const e = esc(methodName)
    const patterns = [
      new RegExp(`^let\\s+(?:rec\\s+)?${e}\\b`),
      new RegExp(`^and\\s+${e}\\b`),
      new RegExp(`^\\s*method\\s+(?:private\\s+|virtual\\s+)*${e}\\b`)
    ]
    for (let i = 0; i < lines.length; i++) {
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
      }
    }
    return null
  }
}
