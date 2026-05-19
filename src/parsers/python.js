// Парсер Python (.py, .pyw)
// Поддерживает: def, async def, методы классов

import { esc } from "./utils.js"

export default {
  extensions: [".py", ".pyw"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\s*)(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(/)
      if (!m) continue
      const indent = m[1].length
      const name   = m[2]
      // Пропускаем deeply-nested (indent > 8 = внутри 2+ уровней), чтобы не было шума
      if (indent <= 8) results.push({ name: name + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const p = new RegExp(`(?:async\\s+)?def\\s+${esc(methodName)}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
    }
    return null
  }
}
