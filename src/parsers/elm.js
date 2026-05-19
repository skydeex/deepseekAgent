// Парсер Elm (.elm)
// Outline: type-аннотации name : Type + top-level функции

import { esc } from "./utils.js"

export default {
  extensions: [".elm"],

  outline(lines) {
    const results = []
    const seen = new Set()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^--/.test(line) || /^\s+/.test(line)) continue
      // Тип-аннотация: name : ...
      const ann = line.match(/^([a-z_][a-zA-Z0-9_']*)\s*:(?!:)/)
      if (ann && !seen.has(ann[1])) {
        seen.add(ann[1])
        results.push({ name: ann[1] + "()", line: i + 1 })
        continue
      }
      // type / type alias
      const typ = line.match(/^type(?:\s+alias)?\s+([A-Z][a-zA-Z0-9_]*)/)
      if (typ && !seen.has(typ[1])) {
        seen.add(typ[1])
        results.push({ name: 'type ' + typ[1], line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '')
    const p = new RegExp(`^${esc(clean)}(?:\\s|$)`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
