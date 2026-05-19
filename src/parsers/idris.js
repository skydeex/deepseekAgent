// Парсер Idris (.idr, .lidr)
// Outline: type-аннотации + data/record/interface/namespace

import { esc } from "./utils.js"

export default {
  extensions: [".idr", ".lidr"],

  outline(lines) {
    const results = []
    const seen = new Set()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^--/.test(line) || /^\s/.test(line)) continue
      // Тип-аннотация: name : Type
      const ann = line.match(/^([a-z_][a-zA-Z0-9_']*)\s*:(?!:)/)
      if (ann && !seen.has(ann[1])) {
        seen.add(ann[1])
        results.push({ name: ann[1] + "()", line: i + 1 })
        continue
      }
      // data / record / interface / namespace / mutual
      const decl = line.match(/^(data|record|interface|namespace|mutual)\s+([A-Za-z_][a-zA-Z0-9_']*)/)
      if (decl && !seen.has(decl[2])) {
        seen.add(decl[2])
        results.push({ name: decl[1] + ' ' + decl[2], line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '').replace(/^\w+\s+/, '')
    const p = new RegExp(`^${esc(clean)}(?:\\s|$)`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i]) || lines[i].match(new RegExp(`^(?:data|record|interface|namespace)\\s+${esc(clean)}\\b`))) return i + 1
    }
    return null
  }
}
