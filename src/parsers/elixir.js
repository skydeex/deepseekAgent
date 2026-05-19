// Парсер Elixir (.ex, .exs)
// Поддерживает: def, defp, defmacro, defmacrop, defguard, defcallback

import { esc } from "./utils.js"

const DEF_TYPES = "def(?:p|macro|macrop|guard|guardp|callback|impl)?"

export default {
  extensions: [".ex", ".exs"],

  outline(lines) {
    const results = []
    const pattern = new RegExp(`^\\s*${DEF_TYPES}\\s+([a-zA-Z_]\\w*[?!]?)\\s*(?:\\(|,|\\bdo\\b)`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      const m = lines[i].match(pattern)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`${DEF_TYPES}\\s+${esc(methodName)}\\s*(?:\\(|,|\\bdo\\b)`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
    }
    return null
  }
}
