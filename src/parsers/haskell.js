// Парсер Haskell (.hs, .lhs)
// Стратегия: тип-сигнатуры (name :: Type) — самый надёжный сигнал.
// findMethodStart: первая строка определения (name args = / name args |)

import { esc } from "./utils.js"

export default {
  extensions: [".hs", ".lhs"],

  outline(lines) {
    const results = []
    const seen = new Set()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Тип-сигнатура: name :: ... (может быть несколько имён через запятую)
      const m = line.match(/^([a-z_'][a-zA-Z0-9_']*(?:\s*,\s*[a-z_'][a-zA-Z0-9_']*)*)\s*::/)
      if (m) {
        const names = m[1].split(",").map(s => s.trim())
        for (const name of names) {
          if (!seen.has(name)) {
            seen.add(name)
            results.push({ name: name + "()", line: i + 1 })
          }
        }
        continue
      }
      // Top-level definition без сигнатуры: строка начинается с lowercase, не отступ, содержит = или |
      // Пропускаем import/module/where/let/data/type/newtype/class/instance
      if (/^(import|module|where|let|data\s|type\s|newtype\s|class\s|instance\s|--)/.test(line)) continue
      const def = line.match(/^([a-z_'][a-zA-Z0-9_']*)\s+(?:[^=|]*)(?:=|\|)/)
      if (def && !seen.has(def[1])) {
        seen.add(def[1])
        results.push({ name: def[1] + "()", line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    // Ищем определение: name args = / name | / name args |
    const p = new RegExp(`^${esc(methodName)}\\s*(?:[^=|\\n]*(?:=|\\|)|\\s*$)`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i]) && lines[i].startsWith(methodName)) return i + 1
    }
    return null
  }
}
