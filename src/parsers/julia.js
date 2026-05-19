// Парсер Julia (.jl)
// Поддерживает: function name(...), macro name(...), короткая форма name(args) = expr

import { esc } from "./utils.js"

export default {
  extensions: [".jl"],

  outline(lines) {
    const results = []
    const seen = new Set()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*#/.test(line)) continue

      // function name( или macro name(
      const fnM = line.match(/^\s*(?:function|macro)\s+([a-zA-Z_][a-zA-Z0-9_!.]*)\s*\(/)
      if (fnM && !seen.has(fnM[1])) {
        seen.add(fnM[1])
        results.push({ name: fnM[1] + "()", line: i + 1 })
        continue
      }

      // Короткая форма: name(args) = expr (не внутри блока, нет отступа)
      const shortM = line.match(/^([a-zA-Z_][a-zA-Z0-9_!.]*)\s*\([^)]*\)\s*=(?!=)/)
      if (shortM && !seen.has(shortM[1])) {
        seen.add(shortM[1])
        results.push({ name: shortM[1] + "()", line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const e = esc(methodName)
    const patterns = [
      new RegExp(`(?:function|macro)\\s+${e}\\s*\\(`),
      new RegExp(`^${e}\\s*\\([^)]*\\)\\s*=(?!=)`)
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#/.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
      }
    }
    return null
  }
}
