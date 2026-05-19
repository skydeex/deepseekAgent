// Парсер Crystal (.cr)
// Синтаксис близок к Ruby: def, def self.method, initialize, def name?/name!/name=

import { esc } from "./utils.js"

export default {
  extensions: [".cr"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      const m = lines[i].match(/^\s*def\s+((?:self\.)?[a-zA-Z_]\w*[?!=]?)\s*(?:\(|:|$)/)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`def\\s+(?:self\\.)?${esc(methodName)}\\s*(?:\\(|:|$)`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
    }
    return null
  }
}
