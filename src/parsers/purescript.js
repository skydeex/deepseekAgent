// Парсер PureScript (.purs)
// Аналог Haskell: type-аннотации + data/newtype/class/instance

import { esc } from "./utils.js"

export default {
  extensions: [".purs"],

  outline(lines) {
    const results = []
    const seen = new Set()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^--/.test(line) || /^\s/.test(line)) continue
      // Тип-аннотация
      const ann = line.match(/^([a-z_][a-zA-Z0-9_']*)\s*::/)
      if (ann && !seen.has(ann[1])) {
        seen.add(ann[1])
        results.push({ name: ann[1] + "()", line: i + 1 })
        continue
      }
      // data / newtype / type / class
      const decl = line.match(/^(data|newtype|type|class)\s+([A-Z][a-zA-Z0-9_']*)/)
      if (decl && !seen.has(decl[2])) {
        seen.add(decl[2])
        results.push({ name: decl[1] + ' ' + decl[2], line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, name) {
    const clean = name.replace(/\(\)$/, '').replace(/^(?:data|newtype|type|class)\s+/, '')
    const p = new RegExp(`^${esc(clean)}(?:\\s|$)`)
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i]) || lines[i].match(new RegExp(`^(?:data|newtype|type|class)\\s+${esc(clean)}\\b`))) return i + 1
    }
    return null
  }
}
