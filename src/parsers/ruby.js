// Парсер Ruby (.rb, .rake, .gemspec)
// Поддерживает: def, def self.method, method?, method!, attr_*

import { esc } from "./utils.js"

export default {
  extensions: [".rb", ".rake", ".gemspec", ".ru"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*def\s+((?:self\.)?[a-zA-Z_]\w*[?!=]?)\s*(?:\(|$)/)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`def\\s+(?:self\\.)?${esc(methodName)}\\s*(?:\\(|$)`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
    }
    return null
  }
}
