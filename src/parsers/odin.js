// Парсер Odin (.odin)
// Outline: процедуры (name :: proc), типы (name :: struct/union/enum), константы

import { esc } from "./utils.js"

export default {
  extensions: [".odin"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*\/\//.test(line)) continue
      // proc: name :: proc(...)
      const proc = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*::\s*proc\b/)
      if (proc) { results.push({ name: proc[1] + "()", line: i + 1 }); continue }
      // struct / union / enum / bit_set
      const typ = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*::\s*(struct|union|enum|bit_set)\b/)
      if (typ) { results.push({ name: typ[1] + ' :: ' + typ[2], line: i + 1 }); continue }
      // Константа / переменная уровня пакета
      const con = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*::\s*(?!\s*proc)/)
      if (con && !/\s*::\s*(struct|union|enum)/.test(line)) {
        results.push({ name: con[1], line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '').replace(/\s*::.*$/, '')
    const p = new RegExp(`^${esc(clean)}\\s*::`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
