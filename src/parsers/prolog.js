// Парсер Prolog (.pro, .prolog, .pl — осторожно: .pl может конфликтовать с Perl)
// Outline: предикаты (functor/arity), директивы :- module, :- use_module

import { esc } from "./utils.js"

export default {
  extensions: [".pro", ".prolog"],
  // .pl не добавляем — занято Perl

  outline(lines) {
    const results = []
    const seen = new Set()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*%/.test(line)) continue
      // :- module(name, ...)
      const mod = line.match(/^:-\s*module\s*\(\s*([a-z_][a-zA-Z0-9_]*)/)
      if (mod) { results.push({ name: ':- module(' + mod[1] + ')', line: i + 1 }); continue }
      // Факт/правило: name(... :- или name(.
      const pred = line.match(/^([a-z_][a-zA-Z0-9_]*)\s*(?:\(|:-)/)
      if (pred && !seen.has(pred[1])) {
        seen.add(pred[1])
        results.push({ name: pred[1] + "/N", line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\/\w+$/, '').replace(/^\:-\s*module\((.+)\)$/, '$1')
    const p = new RegExp(`^${esc(clean)}\\s*(?:\\(|:-)`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*%/.test(lines[i])) continue
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
