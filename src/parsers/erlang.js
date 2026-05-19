// Парсер Erlang (.erl, .hrl)
// Поддерживает: определения функций (name/arity), -spec аннотации

import { esc } from "./utils.js"

export default {
  extensions: [".erl", ".hrl"],

  outline(lines) {
    const results = []
    const seen = new Set()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*%/.test(line)) continue  // комментарии

      // -spec function_name( — хороший маркер публичных функций
      const specM = line.match(/^-spec\s+([a-z_][a-zA-Z0-9_@]*)\s*\(/)
      if (specM && !seen.has(specM[1])) {
        seen.add(specM[1])
        results.push({ name: specM[1] + "()", line: i + 1 })
        continue
      }

      // function_name(Args) -> — определение функции на нулевом отступе
      // Не матчим атрибуты вроде -module(, -export(
      if (line.startsWith('-')) continue
      const fnM = line.match(/^([a-z_][a-zA-Z0-9_@]*)\s*\(/)
      if (fnM && !seen.has(fnM[1])) {
        seen.add(fnM[1])
        results.push({ name: fnM[1] + "()", line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const e = esc(methodName)
    const patterns = [
      new RegExp(`^-spec\\s+${e}\\s*\\(`),
      new RegExp(`^${e}\\s*\\(`)
    ]
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*%/.test(lines[i])) continue
      for (const p of patterns) {
        if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
      }
    }
    return null
  }
}
